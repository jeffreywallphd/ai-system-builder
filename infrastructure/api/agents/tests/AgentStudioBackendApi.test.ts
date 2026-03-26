import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../../domain/agents/Agent";
import { createAgent } from "../../../../domain/agents/Agent";
import { AssetId } from "../../../../domain/assets/AssetId";
import type { IAgentRepository } from "../../../../application/ports/interfaces/IAgentRepository";
import type { IAgentExecutionSessionRepository, AgentExecutionSessionTransitionRecord } from "../../../../application/ports/interfaces/IAgentExecutionSessionRepository";
import type { AgentExecutionSession } from "../../../../domain/agents/AgentExecutionSession";
import { AgentExecutionSessionStatuses, createAgentExecutionSession, transitionAgentExecutionSession } from "../../../../domain/agents/AgentExecutionSession";
import { AgentStudioBackendApi } from "../AgentStudioBackendApi";
import { AgentRunControlActions } from "../../../../application/agents/contracts/AgentRunContracts";
import { AgentRunnerService } from "../../../../application/agents/services/AgentRunnerService";
import { DeterministicAgentPlanningService } from "../../../../application/agents/services/AgentPlanningInterface";
import { ExecuteAgentToolsUseCase } from "../../../../application/agents/ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../../../../application/agents/services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../../../../application/agents/services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../../../../application/agents/services/AssetBackedAgentMemoryStore";
import type { IToolCapabilityCatalog } from "../../../../application/ports/interfaces/IToolCapabilityCatalog";
import type { IAgentToolOrchestrator } from "../../../../application/ports/interfaces/IAgentToolOrchestrator";
import type { IAssetCatalog } from "../../../../application/ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../../../application/ports/interfaces/IAssetVersionRepository";
import { Asset } from "../../../../domain/assets/Asset";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";

class InMemoryAgentRepository implements IAgentRepository {
  private readonly store = new Map<string, Agent>();
  async save(agent: Agent): Promise<Agent> { this.store.set(agent.id, agent); return agent; }
  async get(id: string): Promise<Agent | undefined> { return this.store.get(id.trim()); }
  async list(): Promise<ReadonlyArray<Agent>> { return [...this.store.values()]; }
  async delete(id: string): Promise<boolean> { return this.store.delete(id.trim()); }
}

class InMemorySessionRepository implements IAgentExecutionSessionRepository {
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
  async getById(sessionId: string): Promise<AgentExecutionSession | undefined> { return this.sessions.get(sessionId); }
  async listByAgentId(agentId: string): Promise<ReadonlyArray<AgentExecutionSession>> {
    return [...this.sessions.values()].filter((session) => session.agentId === agentId);
  }
  async listTransitionHistory(sessionId: string): Promise<ReadonlyArray<AgentExecutionSessionTransitionRecord>> {
    return Object.freeze([...(this.transitions.get(sessionId) ?? [])]);
  }
}

class InMemoryAssetRepository implements IAssetCatalog, IAssetVersionRepository {
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

function buildRequest(id: string) {
  return {
    id,
    name: "Studio API Agent",
    goals: [{ id: "goal-1", objective: "Echo", constraints: [], successCriteria: ["done"], priority: "normal" as const, priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] }],
    policy: {
      toolAccess: { allowedToolIds: ["mcp:local:echo"], allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }], scopeConstraints: [] },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 1 },
      safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: true }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" as const } } },
    },
    memory: {
      agentId: id,
      assets: [{ assetId: new AssetId("asset:memory:studio"), memoryType: "working" as const }],
      retrieval: { strategy: "latest-first" as const, maxEntries: 5 },
      policy: { retrievableTypes: ["working" as const], writableTypes: ["working" as const], retention: { mode: "bounded" as const, maxDurableEntries: 10 } },
      revision: 1,
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" as const },
    execution: { maxExecutionUnits: 1, requireTrustedTools: true },
  };
}

function buildRunner(sessionRepository: IAgentExecutionSessionRepository): AgentRunnerService {
  const assets = new InMemoryAssetRepository();
  const memoryStore = new AssetBackedAgentMemoryStore(assets, assets);
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
        executionId: request.executionId ?? "exec-studio",
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
    sessionRepository,
  );
}

describe("AgentStudioBackendApi", () => {
  it("exposes coherent authoring + session + snapshot contracts", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepository();
    const api = new AgentStudioBackendApi(agents, sessions);

    const created = await api.createAgent(buildRequest("agent:studio:1"));
    expect(created.ok).toBe(true);
    expect(created.data?.taxonomy.semanticRole).toBe("agent");

    const pending = createAgentExecutionSession({ id: "session:studio:1", agentId: "agent:studio:1" });
    const ready = transitionAgentExecutionSession(pending, { status: AgentExecutionSessionStatuses.ready });
    const running = transitionAgentExecutionSession(ready, { status: AgentExecutionSessionStatuses.running });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendStepOutcome: { stepId: "step-1", status: "completed", attempts: 1, outputAssetId: new AssetId("asset:output:studio:1") },
    });
    await sessions.save(pending);
    await sessions.save(ready);
    await sessions.save(running);
    await sessions.save(completed);

    const listedSessions = await api.listSessions("agent:studio:1");
    expect(listedSessions.ok).toBe(true);
    expect(listedSessions.data?.[0]?.composition.taxonomy.semanticRole).toBe("system");

    const snapshot = await api.getStudioSnapshot("agent:studio:1");
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.agent.contract?.version).toBe("1.0.0");
    expect(snapshot.data?.latestSession?.operational.outcomeSummary.outputAssetIds).toEqual(["asset:output:studio:1"]);
    expect(snapshot.data?.capabilities.launch).toBe(false);
  });

  it("maps runtime errors deterministically", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepository();
    const api = new AgentStudioBackendApi(agents, sessions);

    const invalidList = await api.listSessions("  ");
    expect(invalidList.ok).toBe(false);
    expect(invalidList.error?.code).toBe("invalid-request");

    const notFoundDetail = await api.getSessionDetail("missing");
    expect(notFoundDetail.ok).toBe(false);
    expect(notFoundDetail.error?.code).toBe("not-found");

    const unsupported = await api.controlRun({ sessionId: "missing", action: AgentRunControlActions.pause });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.error?.code).toBe("unsupported-control");
  });

  it("returns deterministic unsupported-operation for launch when runner is not configured", async () => {
    const api = new AgentStudioBackendApi(new InMemoryAgentRepository(), new InMemorySessionRepository());
    const launched = await api.launchAgent({ agentId: "agent:missing" });
    expect(launched.ok).toBe(false);
    expect(launched.error?.code).toBe("unsupported-operation");

    const triggered = await api.triggerLaunch({ agentId: "agent:missing", trigger: { kind: "manual" } });
    expect(triggered.ok).toBe(false);
    expect(triggered.error?.code).toBe("unsupported-operation");
  });

  it("launches and trigger-launches through the runtime runner when configured", async () => {
    const agents = new InMemoryAgentRepository();
    const sessions = new InMemorySessionRepository();
    const api = new AgentStudioBackendApi(agents, sessions, buildRunner(sessions));
    await api.createAgent(buildRequest("agent:studio:launch"));

    const launch = await api.launchAgent({ agentId: "agent:studio:launch", input: { task: "echo" } });
    expect(launch.ok).toBe(true);
    expect(launch.data?.launch.status).toBe("completed");
    expect(launch.data?.session.composition.taxonomy.semanticRole).toBe("agent");

    const trigger = await api.triggerLaunch({
      agentId: "agent:studio:launch",
      trigger: { kind: "backend", source: "test-suite" },
    });
    expect(trigger.ok).toBe(true);
    expect(trigger.data?.binding.trigger.kind).toBe("backend");
  });
});
