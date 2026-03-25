import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../domain/agents/Agent";
import type { AgentMemoryEntryReference } from "../../../domain/agents/AgentMemory";
import { AssetBackedAgentMemoryStore } from "../services/AssetBackedAgentMemoryStore";
import { AgentExecutionService } from "../services/AgentExecutionService";
import { DeterministicAgentPlanningService } from "../services/AgentPlanningInterface";
import { AgentService } from "../services/AgentService";
import { DefaultAgentMemoryRetrievalService } from "../services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../services/AgentMemoryWriteService";
import { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type { IAgentToolOrchestrator } from "../../ports/interfaces/IAgentToolOrchestrator";
import { Asset } from "../../../domain/assets/Asset";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { AssetId } from "../../../domain/assets/AssetId";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";

class InMemoryAgentRepository implements IAgentRepository {
  private readonly store = new Map<string, Agent>();

  async save(agent: Agent): Promise<Agent> {
    this.store.set(agent.id, agent);
    return agent;
  }

  async get(id: string): Promise<Agent | undefined> {
    return this.store.get(id);
  }

  async list(): Promise<ReadonlyArray<Agent>> {
    return [...this.store.values()];
  }
}

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

describe("Agent foundation services", () => {
  it("creates, lists, and projects stable agent read models", async () => {
    const service = new AgentService(new InMemoryAgentRepository());
    await service.createAgent({
      id: "agent-a",
      name: "Agent A",
      goals: [{ id: "goal-1", objective: "Collect facts", constraints: [], successCriteria: ["facts collected"], priority: "normal", priorityOrder: 1 }],
      policy: {
        toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: false }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } } },
      },
      memory: {
        agentId: "agent-a",
        assets: [{ assetId: new AssetId("asset:memory:a"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 10 },
        policy: {
          writableTypes: ["episodic", "semantic", "working"],
          retention: { mode: "bounded", maxDurableEntries: 100 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { maxExecutionUnits: 2, requireTrustedTools: true },
    });

    const readModels = await service.listAgentReadModels();
    expect(readModels[0]?.policy.toolAccess.allowedToolIds).toEqual(["mcp:local:echo"]);
    expect(readModels[0]?.memory.assetIds).toEqual(["asset:memory:a"]);
  });

  it("persists and retrieves asset-backed memory scoped by agent", async () => {
    const repo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(repo, repo);

    await memoryStore.add("agent-a", {
      assetId: new AssetId("asset:memory:a"),
      memoryType: "episodic",
      tags: ["planning", "facts"],
      metadata: { note: "hello" },
    });

    const entries = await memoryStore.query("agent-a", {
      assetIds: [new AssetId("asset:memory:a")],
      memoryTypes: ["episodic"],
      tags: ["planning"],
      maxEntries: 3,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.assetId.toString()).toBe("asset:memory:a");
    expect(entries[0]?.memoryType).toBe("episodic");
  });

  it("plans using goals, policy-allowed tools, and memory context", async () => {
    const repo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(repo, repo);
    await memoryStore.add("agent-plan", {
      assetId: new AssetId("asset:memory:plan"),
      memoryType: "semantic",
      tags: ["weather"],
      metadata: { city: "Seattle" },
    });

    const catalog: IToolCapabilityCatalog = {
      async listCapabilities() {
        return [
          {
            id: "mcp:local:get_weather",
            identity: { stableId: "mcp:local:get_weather", providerScopedId: "mcp:local:get_weather" },
            routingName: "get_weather",
            displayName: "Weather",
            provider: { kind: "mcp", id: "mcp", label: "MCP" },
            source: { kind: "mcp", serverId: "local", toolName: "get_weather" },
            publication: { isPublished: true },
          },
        ];
      },
    };

    const planner = new DeterministicAgentPlanningService(catalog, memoryStore);
    const plan = await planner.plan({ agent: {
      id: "agent-plan",
      name: "Planner",
      goals: [{ id: "goal-1", objective: "Fetch weather", constraints: [], successCriteria: ["forecast"], priority: "high", priorityOrder: 1, requiredToolIds: ["mcp:local:get_weather"] }],
      policy: {
        toolAccess: { allowedToolIds: ["mcp:local:get_weather"], scopeConstraints: [{ toolId: "mcp:local:get_weather", allowedScopes: ["forecast.read"] }] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: { maxSteps: 1 },
        safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: false }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } } },
      },
      toolAccess: { allowedToolIds: ["mcp:local:get_weather"], scopeConstraints: [{ toolId: "mcp:local:get_weather", allowedScopes: ["forecast.read"] }] },
      memory: {
        agentId: "agent-plan",
        assets: [{ assetId: new AssetId("asset:memory:plan"), memoryType: "semantic" }],
        retrieval: { strategy: "hybrid", requiredTags: ["weather"], maxEntries: 2 },
        policy: {
          retrievableTypes: ["semantic"],
          writableTypes: ["episodic", "semantic"],
          retention: { mode: "bounded", maxDurableEntries: 20 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { maxExecutionUnits: 1, requireTrustedTools: true },
      status: "ready",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
      description: undefined,
    } });

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.toolId).toBe("mcp:local:get_weather");
    expect(plan.steps[0]?.intent.inputReferences).toHaveLength(1);
  });

  it("executes through orchestrated tool path and persists execution memory", async () => {
    const assetRepo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(assetRepo, assetRepo);

    await memoryStore.add("agent-exec", {
      assetId: new AssetId("asset:memory:1"),
      memoryType: "working",
      tags: ["input"],
      metadata: { seed: true },
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

    const orchestrator: IAgentToolOrchestrator = {
      async execute(request) {
        return {
          executionId: request.executionId ?? "agent-exec",
          status: "completed",
          input: request.input,
          maxIterations: request.maxIterations,
          iterationCount: 1,
          stoppedReason: "completed",
          availableTools: request.availableTools,
          selectedTools: request.selectedTools,
          steps: [],
          finalOutput: `ok:${request.input}`,
        };
      },
    };

    const useCase = new ExecuteAgentToolsUseCase(catalog, orchestrator);
    const planner = new DeterministicAgentPlanningService(catalog, memoryStore);
    const service = new AgentExecutionService(
      planner,
      useCase,
      new DefaultAgentMemoryRetrievalService(memoryStore),
      new AgentMemoryWriteService(memoryStore),
    );
    const agent: Agent = {
      id: "agent-exec",
      name: "Exec Agent",
      goals: [{ id: "goal-1", objective: "Echo this", constraints: [], successCriteria: ["response"], priority: "normal", priorityOrder: 1 }],
      policy: {
        toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: { maxSteps: 1 },
        safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: false }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } } },
      },
      toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
      memory: {
        agentId: "agent-exec",
        assets: [{ assetId: new AssetId("asset:memory:1"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 10 },
        policy: {
          retrievableTypes: ["working"],
          writableTypes: ["episodic", "working"],
          retention: { mode: "bounded", maxDurableEntries: 30 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { maxExecutionUnits: 1, requireTrustedTools: true },
      status: "ready",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
      description: undefined,
    };

    const graph = await service.buildExecutionGraph(agent);
    expect(graph.steps).toHaveLength(1);
    expect(graph.steps[0]?.toolId).toBe("mcp:local:echo");

    const result = await service.execute(agent);
    expect(result.status).toBe("completed");

    const persisted = await memoryStore.query("agent-exec", { assetIds: [new AssetId("asset:memory:1")], tags: ["agent-execution"] });
    expect(persisted).toHaveLength(1);
    expect((persisted[0]?.metadata as AgentMemoryEntryReference["metadata"] | undefined)).toBeDefined();
  });
});
