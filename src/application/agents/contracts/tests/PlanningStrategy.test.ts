import { describe, expect, it } from "bun:test";
import { AssetBackedAgentMemoryStore } from "../../services/AssetBackedAgentMemoryStore";
import { DeterministicAgentPlanningStrategy } from "../../services/DeterministicAgentPlanningStrategy";
import { Asset } from "@domain/assets/Asset";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { AssetId } from "@domain/assets/AssetId";
import type { Agent } from "@domain/agents/Agent";
import type { IAssetCatalog } from "../../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../../ports/interfaces/IAssetVersionRepository";
import type { IToolCapabilityCatalog } from "../../../ports/interfaces/IToolCapabilityCatalog";

class InMemoryAssetRepo implements IAssetCatalog, IAssetVersionRepository {
  private readonly assets = new Map<string, Asset>();
  private readonly versions = new Map<string, AssetVersion>();

  async list(): Promise<ReadonlyArray<Asset>> { return [...this.assets.values()]; }
  async getById(id: string): Promise<Asset | undefined> { return this.assets.get(id.trim()); }
  async save(asset: Asset): Promise<void> { this.assets.set(asset.id, asset); }
  async remove(id: string): Promise<boolean> { return this.assets.delete(id.trim()); }
  async exists(id: string): Promise<boolean> { return this.assets.has(id.trim()); }
  async saveVersion(version: AssetVersion): Promise<void> { this.versions.set(version.versionId, version); }
  async getByVersionId(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId.trim()); }
  async listVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((version) => version.assetId.value === assetId.trim());
  }
}

const baseAgent: Agent = {
  id: "agent-p",
  name: "Planner",
  goals: [
    { id: "g1", objective: "Fetch", constraints: [], successCriteria: ["done"], priority: "high" as const, priorityOrder: 1 },
    { id: "g2", objective: "Summarize", constraints: [], successCriteria: ["done"], priority: "normal" as const, priorityOrder: 2 },
  ],
  policy: {
    toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
    restrictedActions: [],
    costLimits: {},
    executionLimits: {},
    safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: false }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } } },
  },
  toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
  memory: {
    agentId: "agent-p",
    assets: [{ assetId: new AssetId("asset:memory:p"), memoryType: "semantic" as const }],
    retrieval: { strategy: "latest-first" as const, maxEntries: 10 },
    policy: {
      retrievableTypes: ["semantic"],
      writableTypes: ["episodic", "semantic"],
      retention: { mode: "bounded", maxDurableEntries: 100 },
    },
    revision: 1,
  },
  planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
  execution: { maxExecutionUnits: 2, requireTrustedTools: true },
  status: "ready" as const,
  createdAt: "2026-03-24T00:00:00.000Z",
  updatedAt: "2026-03-24T00:00:00.000Z",
};

describe("PlanningStrategy", () => {
  it("produces execution-oriented AgentPlan output from deterministic strategy", async () => {
    const assets = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(assets, assets);
    await memoryStore.add("agent-p", {
      assetId: new AssetId("asset:memory:p"),
      memoryType: "semantic",
      metadata: { note: "seed" },
      tags: ["seed"],
    });

    const catalog: IToolCapabilityCatalog = {
      async listCapabilities() {
        return [{
          id: "mcp:local:echo",
          identity: { stableId: "mcp:local:echo", providerScopedId: "mcp:local:echo" },
          routingName: "echo",
          displayName: "Echo",
          provider: { kind: "mcp", id: "mcp", label: "MCP" },
          source: { kind: "mcp", serverId: "local", toolName: "echo" },
          publication: { isPublished: true },
        }];
      },
    };

    const strategy = new DeterministicAgentPlanningStrategy(catalog, memoryStore);
    const plan = await strategy.plan({ agent: baseAgent });

    expect(strategy.descriptor.id).toBe("deterministic");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1]?.dependsOnStepIds).toEqual([plan.steps[0]!.stepId]);
    expect(plan.steps[0]?.intent.inputReferences[0]?.kind).toBe("asset");
  });

  it("fails planning when no allowed tools are executable", async () => {
    const assets = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(assets, assets);
    const emptyCatalog: IToolCapabilityCatalog = { async listCapabilities() { return []; } };
    const strategy = new DeterministicAgentPlanningStrategy(emptyCatalog, memoryStore);

    await expect(strategy.plan({ agent: baseAgent })).rejects.toThrow("no executable allowed tools");
  });
});

