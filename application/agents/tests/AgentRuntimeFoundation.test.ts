import { describe, expect, it } from "bun:test";
import { createAgent, type Agent } from "../../../domain/agents/Agent";
import { AssetId } from "../../../domain/assets/AssetId";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import { AssetBackedAgentMemoryStore } from "../services/AssetBackedAgentMemoryStore";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import { Asset } from "../../../domain/assets/Asset";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { IAgentToolOrchestrator } from "../../ports/interfaces/IAgentToolOrchestrator";
import { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../services/AgentMemoryWriteService";
import { DeterministicAgentPlanningService } from "../services/AgentPlanningInterface";
import { AgentRunnerService } from "../services/AgentRunnerService";
import type { AgentExecutionSession } from "../../../domain/agents/AgentExecutionSession";
import type { IAgentExecutionSessionRepository } from "../../ports/interfaces/IAgentExecutionSessionRepository";
import { AgentMcpToolGovernanceService } from "../services/AgentMcpToolGovernanceService";
import { createInstalledMcpToolRecord, type InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import { createAgentPlan } from "../../../domain/agents/AgentPlan";

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

class InMemorySessionRepo implements IAgentExecutionSessionRepository {
  private readonly sessions = new Map<string, AgentExecutionSession>();

  async save(session: AgentExecutionSession): Promise<AgentExecutionSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async getById(sessionId: string): Promise<AgentExecutionSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async listByAgentId(agentId: string): Promise<ReadonlyArray<AgentExecutionSession>> {
    return [...this.sessions.values()].filter((session) => session.agentId === agentId);
  }
}

function makeAgent(toolId = "mcp:local:echo"): Agent {
  return createAgent({
    id: "agent-runtime",
    name: "Runtime Agent",
    goals: [{ id: "goal-1", objective: "Echo this", constraints: [], successCriteria: ["response"], priority: "normal", priorityOrder: 1, requiredToolIds: [toolId] }],
    policy: {
      toolAccess: {
        allowedToolIds: [toolId],
        allowedMcpTools: [{ toolId, serverId: "local", toolName: toolId.split(":")[2] ?? "echo" }],
        scopeConstraints: [],
      },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 1 },
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
    execution: { maxExecutionUnits: 1, requireTrustedTools: true },
  });
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

function makeOrchestrator(response: "success" | "retryable-failure"): IAgentToolOrchestrator {
  let calls = 0;
  return {
    async execute(request) {
      calls += 1;
      const failed = response === "retryable-failure" && calls === 1;
      return {
        executionId: request.executionId ?? "exec-runtime",
        status: failed ? "failed" : "completed",
        input: request.input,
        maxIterations: request.maxIterations,
        iterationCount: 1,
        stoppedReason: failed ? "tool-failed" : "completed",
        availableTools: request.availableTools,
        selectedTools: request.selectedTools,
        steps: [],
        finalOutput: failed ? undefined : `ok:${request.input}`,
        errorMessage: failed ? "temporary timeout" : undefined,
      };
    },
  };
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

describe("Agent runtime foundation", () => {
  it("blocks execution with deterministic governance decision semantics", async () => {
    const installed = createInstalledMcpToolRecord({
      definition: {
        id: "mcp:local:echo",
        version: "1.0.0",
        displayName: "Echo",
        inputSchema: { type: "object" },
        sideEffects: "none",
        auth: { kind: "none" },
        tags: [],
        categories: ["utility"],
      },
      source: { kind: "inline", location: "test" },
      status: "disabled",
    });
    const governance = new AgentMcpToolGovernanceService(makeRegistry(installed));
    const result = await governance.validatePlan(makeAgent(), createAgentPlan({
      planId: "agent-plan:blocked",
      agentId: "agent-runtime",
      strategyId: "deterministic",
      steps: [{
        stepId: "s1",
        toolId: "mcp:local:echo",
        dependsOnStepIds: [],
        intent: { action: "Echo this", inputReferences: [] },
      }],
    }));

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("unavailable");
    expect(result.issues.some((issue) => issue.code === "tool-disabled")).toBe(true);
  });

  it("retries retryable runtime failures and persists terminal session state", async () => {
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

    const catalog = makeCatalog();
    const planner = new DeterministicAgentPlanningService(catalog, memoryStore, new AgentMcpToolGovernanceService(makeRegistry(installed)));
    const useCase = new ExecuteAgentToolsUseCase(catalog, makeOrchestrator("retryable-failure"));
    const sessionRepo = new InMemorySessionRepo();
    const runner = new AgentRunnerService(
      planner,
      useCase,
      new DefaultAgentMemoryRetrievalService(memoryStore),
      new AgentMemoryWriteService(memoryStore),
      undefined,
      new AgentMcpToolGovernanceService(makeRegistry(installed)),
      sessionRepo,
    );

    const events: string[] = [];
    const result = await runner.run({
      agent: makeAgent(),
      retryPolicy: { maxAttemptsPerStep: 2 },
      onProgress: (event) => events.push(event.type),
    });

    expect(result.status).toBe("completed");
    expect(result.outcomes[0]?.attempts).toBe(2);
    expect(events).toContain("memory-persisted");

    const sessions = await sessionRepo.listByAgentId("agent-runtime");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("completed");
  });
});
