import { describe, expect, it } from "bun:test";
import type { Agent } from "@domain/agents/Agent";
import { createAgent } from "@domain/agents/Agent";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
  type AgentExecutionSession,
} from "@domain/agents/AgentExecutionSession";
import { AssetId } from "@domain/assets/AssetId";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";
import type {
  AgentExecutionSessionTransitionRecord,
  IAgentExecutionSessionRepository,
} from "../../ports/interfaces/IAgentExecutionSessionRepository";
import {
  AgentRunControlActions,
  AgentTriggerKinds,
  createAgentRuntimeBinding,
} from "../contracts/AgentRunContracts";
import { LaunchAgentUseCase } from "../LaunchAgentUseCase";
import { TriggerAgentLaunchUseCase } from "../TriggerAgentLaunchUseCase";
import { ListAgentSessionsUseCase } from "../ListAgentSessionsUseCase";
import { GetAgentSessionDetailUseCase } from "../GetAgentSessionDetailUseCase";
import { ControlAgentRunUseCase } from "../ControlAgentRunUseCase";
import {
  AgentRuntimeInvalidControlStateError,
  AgentRuntimeInvalidRequestError,
  AgentRuntimeUnsupportedControlError,
} from "../AgentRuntimeErrors";
import { AgentRunnerService } from "../services/AgentRunnerService";
import { DeterministicAgentPlanningService } from "../services/AgentPlanningInterface";
import { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../services/AssetBackedAgentMemoryStore";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type { IAgentToolOrchestrator } from "../../ports/interfaces/IAgentToolOrchestrator";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import { Asset } from "@domain/assets/Asset";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";

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

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id.trim());
  }
}

class InMemorySessionRepo implements IAgentExecutionSessionRepository {
  private readonly sessions = new Map<string, AgentExecutionSession>();
  private readonly transitions = new Map<string, AgentExecutionSessionTransitionRecord[]>();

  async save(session: AgentExecutionSession): Promise<AgentExecutionSession> {
    const history = this.transitions.get(session.id) ?? [];
    if (history[history.length - 1]?.status !== session.status) {
      history.push(Object.freeze({ status: session.status, recordedAt: new Date().toISOString() }));
      this.transitions.set(session.id, history);
    }
    this.sessions.set(session.id, session);
    return session;
  }

  async getById(sessionId: string): Promise<AgentExecutionSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async listByAgentId(agentId: string): Promise<ReadonlyArray<AgentExecutionSession>> {
    return [...this.sessions.values()].filter((session) => session.agentId === agentId);
  }

  async listTransitionHistory(sessionId: string): Promise<ReadonlyArray<AgentExecutionSessionTransitionRecord>> {
    return Object.freeze([...(this.transitions.get(sessionId) ?? [])]);
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

function buildAgent(id = "agent-phase7"): Agent {
  return createAgent({
    id,
    name: "Phase 7 Agent",
    goals: [{ id: "goal-1", objective: "Echo", constraints: [], successCriteria: ["echoed"], priority: "normal", priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] }],
    policy: {
      toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 1 },
      safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: true }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } } },
    },
    memory: {
      agentId: id,
      assets: [{ assetId: new AssetId("asset:memory:phase7"), memoryType: "working" }],
      retrieval: { strategy: "latest-first", maxEntries: 3 },
      policy: { retrievableTypes: ["working"], writableTypes: ["working", "episodic"], retention: { mode: "bounded", maxDurableEntries: 10 } },
      revision: 1,
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    execution: { maxExecutionUnits: 1, requireTrustedTools: true },
  });
}

function buildRunner(
  sessionRepo: IAgentExecutionSessionRepository,
  observeExecutionRequest?: (request: Parameters<IAgentToolOrchestrator["execute"]>[0]) => void,
): AgentRunnerService {
  const assetRepo = new InMemoryAssetRepo();
  const memoryStore = new AssetBackedAgentMemoryStore(assetRepo, assetRepo);
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
      observeExecutionRequest?.(request);
      return {
        executionId: request.executionId ?? "exec-phase7",
        status: "completed",
        input: request.input,
        maxIterations: request.maxIterations,
        iterationCount: 1,
        stoppedReason: "completed",
        availableTools: request.availableTools,
        selectedTools: request.selectedTools,
        steps: [],
        finalOutput: "ok",
      };
    },
  };

  return new AgentRunnerService(
    new DeterministicAgentPlanningService(catalog, memoryStore),
    new ExecuteAgentToolsUseCase(catalog, orchestrator),
    new DefaultAgentMemoryRetrievalService(memoryStore),
    new AgentMemoryWriteService(memoryStore),
    undefined,
    undefined,
    sessionRepo,
  );
}

describe("Agent operations phase 7 contracts", () => {
  it("launches authored agents through the runner backbone and persists linked sessions", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepo();
    await agents.save(buildAgent("agent-launch"));

    const useCase = new LaunchAgentUseCase(agents, buildRunner(sessions));
    const launched = await useCase.execute({
      agentId: "agent-launch",
      input: { prompt: "hello" },
      contextOverrides: { locale: "en-US" },
      metadata: { caller: "tests" },
      trigger: { kind: AgentTriggerKinds.backend, source: "integration-test", invokedBy: "ci" },
    });

    expect(launched.launch.status).toBe("completed");
    expect(launched.binding.input).toEqual({ prompt: "hello" });
    expect(launched.binding.contextOverrides).toEqual({ locale: "en-US" });
    expect(launched.binding.trigger.kind).toBe("backend");
    expect(launched.session.agentId).toBe("agent-launch");
    expect(launched.operational.memoryWriteSummary.persistedCount).toBeGreaterThanOrEqual(0);

    const persisted = await sessions.getById(launched.session.sessionId);
    expect(persisted?.agentId).toBe("agent-launch");
    expect(persisted?.status).toBe("completed");
    expect(launched.session.composition.taxonomy.semanticRole).toBe("agent");
  });

  it("validates run request and trigger contract deterministically", async () => {
    const agent = buildAgent("agent-bind");
    expect(() => createAgentRuntimeBinding({ agent, request: { agentId: " ", trigger: { kind: AgentTriggerKinds.manual } } })).toThrow("agentId is required");
    expect(() => createAgentRuntimeBinding({ agent, request: { agentId: agent.id, trigger: { kind: AgentTriggerKinds.backend } } })).toThrow("require a non-empty source");
    expect(() => createAgentRuntimeBinding({ agent, request: { agentId: agent.id, metadata: { " ": "x" } } })).toThrow("non-empty");
    expect(() => createAgentRuntimeBinding({ agent, request: { agentId: agent.id, input: { overlap: "x" }, contextOverrides: { overlap: "y" } } })).toThrow("keys overlap");
  });

  it("reads session detail and list views from persisted session truth", async () => {
    const sessions = new InMemorySessionRepo();
    const base = createAgentExecutionSession({ id: "sess-read", agentId: "agent-read", planId: "plan-read" });
    const running = transitionAgentExecutionSession(base, { status: AgentExecutionSessionStatuses.running });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendStepOutcome: { stepId: "step-1", status: "completed", attempts: 2, outputAssetId: new AssetId("asset:output:1") },
      appendDiagnostic: { assetId: new AssetId("asset:diag:1"), assetVersionId: "v1" },
    });
    await sessions.save(base);
    await sessions.save(running);
    await sessions.save(completed);

    const agents = new InMemoryAgentRepository();
    await agents.save(buildAgent("agent-read"));
    const listUseCase = new ListAgentSessionsUseCase(sessions);
    const detailUseCase = new GetAgentSessionDetailUseCase(
      sessions,
      undefined,
      new CompositionAssetContractResolver({ agentRepository: agents }),
    );

    const list = await listUseCase.execute("agent-read");
    expect(list).toHaveLength(1);
    expect(list[0]?.terminalReason).toBe("completed");
    expect(list[0]?.composition.taxonomy.semanticRole).toBe("system");

    const detail = await detailUseCase.execute("sess-read");
    expect(detail.operational.retrySummary.totalAttempts).toBe(2);
    expect(detail.operational.outcomeSummary.outputAssetIds).toEqual(["asset:output:1"]);
    expect(detail.operational.stepOutcomes).toEqual([
      expect.objectContaining({
        stepId: "step-1",
        status: "completed",
        attempts: 2,
        outputAssetId: "asset:output:1",
      }),
    ]);
    expect(detail.operational.diagnosticSummary).toEqual({
      count: 1,
      assetReferences: [{ assetId: "asset:diag:1", assetVersionId: "v1" }],
    });
    expect(detail.composition.taxonomy.semanticRole).toBe("system");
    expect(detail.summary.composition.taxonomy.semanticRole).toBe("system");
    expect(detail.composition.contract?.output?.description).toContain("session outcome");
  });



  it("routes trigger-driven launch requests through canonical launch path", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepo();
    await agents.save(buildAgent("agent-trigger"));

    const launch = new LaunchAgentUseCase(agents, buildRunner(sessions));
    const triggerLaunch = new TriggerAgentLaunchUseCase(launch);
    const result = await triggerLaunch.execute({
      agentId: "agent-trigger",
      trigger: { kind: AgentTriggerKinds.manual, invokedBy: "tester" },
      input: { message: "trigger" },
    });

    expect(result.binding.trigger.kind).toBe("manual");
    expect(result.session.agentId).toBe("agent-trigger");
  });

  it("supports cancel control for active states and rejects unsupported/terminal controls", async () => {
    const sessions = new InMemorySessionRepo();
    const controlUseCase = new ControlAgentRunUseCase(sessions);

    for (const status of [AgentExecutionSessionStatuses.pending, AgentExecutionSessionStatuses.ready, AgentExecutionSessionStatuses.running]) {
      const sessionId = `sess-control-${status}`;
      await sessions.save(createAgentExecutionSession({ id: sessionId, agentId: "agent-control", status }));
      const cancelled = await controlUseCase.execute({ sessionId, action: AgentRunControlActions.cancel });
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.composition.taxonomy.semanticRole).toBe("system");
      const transitionHistory = await sessions.listTransitionHistory(sessionId);
      expect(transitionHistory[transitionHistory.length - 1]?.status).toBe("cancelled");
    }

    await expect(controlUseCase.execute({ sessionId: "sess-control-running", action: AgentRunControlActions.pause })).rejects.toBeInstanceOf(AgentRuntimeUnsupportedControlError);

    await sessions.save(transitionAgentExecutionSession(
      createAgentExecutionSession({ id: "sess-control-terminal", agentId: "agent-control", status: AgentExecutionSessionStatuses.running }),
      { status: AgentExecutionSessionStatuses.completed },
    ));
    await expect(controlUseCase.execute({ sessionId: "sess-control-terminal", action: AgentRunControlActions.cancel })).rejects.toBeInstanceOf(AgentRuntimeInvalidControlStateError);
  });

  it("rejects invalid launch requests before execution", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepo();
    await agents.save(buildAgent("agent-invalid"));
    const useCase = new LaunchAgentUseCase(agents, buildRunner(sessions));

    await expect(useCase.execute({ agentId: "  " })).rejects.toBeInstanceOf(AgentRuntimeInvalidRequestError);
  });

  it("binds run input/context through the runtime execution request", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepo();
    await agents.save(buildAgent("agent-binding-runtime"));
    let capturedRequest: Parameters<IAgentToolOrchestrator["execute"]>[0] | undefined;
    const useCase = new LaunchAgentUseCase(agents, buildRunner(sessions, (request) => { capturedRequest = request; }));

    await useCase.execute({
      agentId: "agent-binding-runtime",
      input: { prompt: "hello runtime" },
      contextOverrides: { locale: "en-US", tenant: "demo" },
      metadata: { caller: "phase7" },
    });

    expect(capturedRequest?.input).toContain("run-input=");
    expect(capturedRequest?.input).toContain("hello runtime");
    expect(capturedRequest?.input).toContain("run-context=");
    expect(capturedRequest?.metadata?.runtimeBinding).toBeDefined();
  });
});

