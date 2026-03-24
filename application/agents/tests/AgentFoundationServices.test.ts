import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../domain/agents/Agent";
import type { AgentMemoryEntryReference } from "../../../domain/agents/AgentMemory";
import { AssetBackedAgentMemoryStore } from "../services/AssetBackedAgentMemoryStore";
import { AgentExecutionService } from "../services/AgentExecutionService";
import { DeterministicAgentPlanningService } from "../services/AgentPlanningInterface";
import { AgentService } from "../services/AgentService";
import { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type { IAgentToolOrchestrator } from "../../ports/interfaces/IAgentToolOrchestrator";
import { Asset } from "../../../domain/assets/Asset";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
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
      goals: [{ goalId: "goal-1", title: "Collect facts", successCriteria: ["facts collected"] }],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:a"] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    });

    const agents = await service.listAgents();
    expect(agents).toHaveLength(1);

    const readModels = await service.listAgentReadModels();
    expect(readModels[0]?.allowedToolIds).toEqual(["mcp:local:echo"]);
    expect(readModels[0]?.memory.assetIds).toEqual(["asset:memory:a"]);
  });

  it("persists and retrieves asset-backed memory scoped by agent", async () => {
    const repo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(repo, repo);

    await memoryStore.add("agent-a", {
      assetId: "asset:memory:a",
      tags: ["planning", "facts"],
      metadata: { note: "hello" },
    });

    const entries = await memoryStore.query("agent-a", {
      assetIds: ["asset:memory:a"],
      tags: ["planning"],
      maxEntries: 3,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.assetId).toBe("asset:memory:a");
    expect(entries[0]?.tags).toContain("planning");
  });

  it("plans using goals, allowed tools, and memory context", async () => {
    const repo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(repo, repo);
    await memoryStore.add("agent-plan", {
      assetId: "asset:memory:plan",
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
    const plan = await planner.plan({
      id: "agent-plan",
      name: "Planner",
      goals: [{ goalId: "goal-1", title: "Fetch weather", successCriteria: ["forecast"], requiredToolIds: ["mcp:local:get_weather"] }],
      allowedTools: [{ toolId: "mcp:local:get_weather" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:plan"], retrieval: { tags: ["weather"], maxEntries: 2 } },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      executionPolicy: { maxExecutionSteps: 1, requireTrustedTools: true },
      status: "ready",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    });

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.toolId).toBe("mcp:local:get_weather");
    expect(plan.steps[0]?.memoryContext[0]?.assetId).toBe("asset:memory:plan");
  });

  it("rejects planning when allowed tools are unavailable in catalog", async () => {
    const repo = new InMemoryAssetRepo();
    const planner = new DeterministicAgentPlanningService({ listCapabilities: async () => [] }, new AssetBackedAgentMemoryStore(repo, repo));

    await expect(planner.plan({
      id: "agent-plan-reject",
      name: "Reject",
      goals: [{ goalId: "goal-1", title: "Fetch weather", successCriteria: ["forecast"] }],
      allowedTools: [{ toolId: "mcp:local:get_weather" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:reject"] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      executionPolicy: {},
      status: "ready",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    })).rejects.toThrow("no executable allowed tools");
  });

  it("executes through orchestrated tool path and persists execution memory", async () => {
    const assetRepo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(assetRepo, assetRepo);

    await memoryStore.add("agent-exec", {
      assetId: "asset:memory:1",
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
    const service = new AgentExecutionService(planner, useCase, memoryStore);
    const agent: Agent = {
      id: "agent-exec",
      name: "Exec Agent",
      goals: [{ goalId: "goal-1", title: "Echo this", successCriteria: ["response"] }],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:1"] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      executionPolicy: { maxExecutionSteps: 1, requireTrustedTools: true },
      status: "ready",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    };

    const graph = await service.buildExecutionGraph(agent);
    expect(graph.steps).toHaveLength(1);
    expect(graph.steps[0]?.toolId).toBe("mcp:local:echo");

    const result = await service.execute(agent);
    expect(result.status).toBe("completed");
    expect(result.outcomes[0]?.status).toBe("completed");

    const persisted = await memoryStore.query("agent-exec", { assetIds: ["asset:memory:1"], tags: ["agent-execution"] });
    expect(persisted).toHaveLength(1);
    expect((persisted[0]?.metadata as AgentMemoryEntryReference["metadata"] | undefined)).toBeDefined();
  });
});
