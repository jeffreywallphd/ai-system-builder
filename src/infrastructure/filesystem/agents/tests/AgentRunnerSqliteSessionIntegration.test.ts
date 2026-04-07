import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createAgent, type Agent } from "@domain/agents/Agent";
import { Asset } from "@domain/assets/Asset";
import { AssetId } from "@domain/assets/AssetId";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { ExecuteAgentToolsUseCase } from "@application/agents/ExecuteAgentToolsUseCase";
import { DeterministicAgentPlanningService } from "@application/agents/services/AgentPlanningInterface";
import { AgentRunnerService } from "@application/agents/services/AgentRunnerService";
import { DefaultAgentMemoryRetrievalService } from "@application/agents/services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "@application/agents/services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "@application/agents/services/AssetBackedAgentMemoryStore";
import type { IAssetCatalog } from "@application/ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "@application/ports/interfaces/IAssetVersionRepository";
import type { IToolCapabilityCatalog } from "@application/ports/interfaces/IToolCapabilityCatalog";
import type { IAgentToolOrchestrator } from "@application/ports/interfaces/IAgentToolOrchestrator";
import { AgentMcpToolGovernanceService } from "@application/agents/services/AgentMcpToolGovernanceService";
import type { IMcpToolRegistryRepository } from "@application/ports/interfaces/IMcpToolRegistryRepository";
import { createInstalledMcpToolRecord, type InstalledMcpToolRecord } from "@domain/mcp/InstalledMcpTool";
import { SqliteAgentExecutionSessionRepository } from "../SqliteAgentExecutionSessionRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

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

function makeRegistry(tool?: InstalledMcpToolRecord): IMcpToolRegistryRepository {
  return {
    async listInstalledTools() { return tool ? [tool] : []; },
    async getInstalledTool(toolId: string) { return tool?.toolId === toolId ? tool : undefined; },
    async findInstalledToolByBinding() { return undefined; },
    async saveInstalledTool(record: InstalledMcpToolRecord) { return record; },
    async removeInstalledTool() { return false; },
  };
}

function makeCatalog(toolId = "mcp:local:echo"): IToolCapabilityCatalog {
  return {
    async listCapabilities() {
      return [{
        id: toolId,
        identity: { stableId: toolId, providerScopedId: toolId },
        routingName: "echo",
        displayName: "Echo",
        provider: { kind: "mcp", id: "mcp", label: "MCP" },
        source: { kind: "mcp", serverId: "local", toolName: "echo" },
        publication: { isPublished: true },
      }];
    },
  };
}

function makeAgent(toolId = "mcp:local:echo"): Agent {
  return createAgent({
    id: "agent-runtime",
    name: "Runtime Agent",
    goals: [
      { id: "goal-1", objective: "Echo one", constraints: [], successCriteria: ["response"], priority: "normal", priorityOrder: 1, requiredToolIds: [toolId] },
      { id: "goal-2", objective: "Echo two", constraints: [], successCriteria: ["response"], priority: "normal", priorityOrder: 2, requiredToolIds: [toolId] },
    ],
    policy: {
      toolAccess: {
        allowedToolIds: [toolId],
        allowedMcpTools: [{ toolId, serverId: "local", toolName: "echo" }],
        scopeConstraints: [],
      },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 2 },
      safetyConstraints: {
        requiredApprovals: [],
        deniedPermissionIds: [],
        sandbox: { network: { allowed: true }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } },
      },
    },
    memory: {
      agentId: "agent-runtime",
      assets: [{ assetId: new AssetId("asset:memory:runtime"), memoryType: "working" }],
      retrieval: { strategy: "latest-first", maxEntries: 5 },
      policy: {
        retrievableTypes: ["working"],
        writableTypes: ["episodic", "working"],
        retention: { mode: "bounded", maxDurableEntries: 20 },
      },
      revision: 1,
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    execution: { maxExecutionUnits: 2, requireTrustedTools: true },
  });
}

describe("Agent runner + sqlite execution-session integration", () => {
  it("persists partial outcomes and transition history for terminal failure", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-runtime-"));
    createdRoots.push(root);
    const sessionRepository = new SqliteAgentExecutionSessionRepository(path.join(root, "agent-sessions.sqlite"));

    const assetRepo = new InMemoryAssetRepo();
    const memoryStore = new AssetBackedAgentMemoryStore(assetRepo, assetRepo);
    await memoryStore.add("agent-runtime", { assetId: new AssetId("asset:memory:runtime"), memoryType: "working" });

    const installed = createInstalledMcpToolRecord({
      definition: {
        id: "mcp:local:echo",
        version: "1.0.0",
        displayName: "Echo",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        sideEffects: "none",
        auth: { kind: "none" },
        tags: [],
        categories: ["utility"],
      },
      source: { kind: "inline", location: "test" },
      status: "enabled",
    });

    let calls = 0;
    const orchestrator: IAgentToolOrchestrator = {
      async execute(request) {
        calls += 1;
        if (calls === 1) {
          return {
            executionId: request.executionId ?? "exec-runtime",
            status: "completed",
            input: request.input,
            maxIterations: request.maxIterations,
            iterationCount: 1,
            stoppedReason: "completed",
            availableTools: request.availableTools,
            selectedTools: request.selectedTools,
            steps: [],
            finalOutput: "first",
          };
        }
        return {
          executionId: request.executionId ?? "exec-runtime",
          status: "failed",
          input: request.input,
          maxIterations: request.maxIterations,
          iterationCount: 1,
          stoppedReason: "tool-failed",
          availableTools: request.availableTools,
          selectedTools: request.selectedTools,
          steps: [],
          errorMessage: "invalid arguments",
          metadata: { retryable: false },
        };
      },
    };

    const runner = new AgentRunnerService(
      new DeterministicAgentPlanningService(makeCatalog(), memoryStore),
      new ExecuteAgentToolsUseCase(makeCatalog(), orchestrator),
      new DefaultAgentMemoryRetrievalService(memoryStore),
      new AgentMemoryWriteService(memoryStore),
      undefined,
      new AgentMcpToolGovernanceService(makeRegistry(installed)),
      sessionRepository,
    );

    const result = await runner.run({ agent: makeAgent(), retryPolicy: { maxAttemptsPerStep: 2 } });
    expect(result.status).toBe("failed");
    expect(result.outcomes).toHaveLength(2);

    const loadedSession = await sessionRepository.getById(result.session.id);
    expect(loadedSession?.status).toBe("failed");
    expect(loadedSession?.stepOutcomes).toHaveLength(2);
    expect(loadedSession?.stepOutcomes[0]?.status).toBe("completed");
    expect(loadedSession?.stepOutcomes[1]?.status).toBe("failed");
    expect(loadedSession?.terminalState?.reason).toBe("failed");
    expect(loadedSession?.terminalState?.hadPartialProgress).toBe(true);
    expect(loadedSession?.executionRuns[0]?.runId).toBe(result.executionId);

    const transitions = await sessionRepository.listTransitionHistory(result.session.id);
    expect(transitions.map((entry) => entry.status)).toEqual(["pending", "ready", "running", "failed"]);

    sessionRepository.dispose();
  });
});

