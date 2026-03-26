import { useEffect, useMemo, useState } from "react";
import type { AgentMemoryConfiguration } from "../../domain/agents/AgentMemory";
import { AssetId } from "../../domain/assets/AssetId";
import type { AgentPlanningStrategy } from "../../domain/agents/Agent";
import type { AgentPolicy, AgentToolAccessPolicy } from "../../domain/agents/AgentPolicy";
import type { AgentLaunchReadModel, AgentSessionDetailReadModel, AgentSessionSummaryReadModel } from "../../application/agents/contracts/AgentRunContracts";
import type { AgentAuthoringApiReadModel } from "../../infrastructure/api/agents/AgentAuthoringBackendApi";
import type { AgentStudioSnapshotReadModel } from "../../infrastructure/api/agents/AgentStudioBackendApi";
import { AgentStudioService } from "../services/AgentStudioService";
import { AgentListPanel } from "../components/agents/AgentListPanel";
import { AgentDetailPanel } from "../components/agents/AgentDetailPanel";
import { SessionListPanel } from "../components/agents/SessionListPanel";
import { SessionDetailPanel } from "../components/agents/SessionDetailPanel";

function buildCreateRequest(id: string) {
  return {
    id,
    name: `Agent ${id}`,
    goals: [{ id: "goal-1", objective: "Complete goal", constraints: [], successCriteria: ["done"], priority: "normal" as const, priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] }],
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

export default function AgentStudioPage(): JSX.Element {
  const service = useMemo(() => new AgentStudioService(), []);
  const [agents, setAgents] = useState<ReadonlyArray<AgentAuthoringApiReadModel>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<AgentStudioSnapshotReadModel | undefined>();
  const [sessions, setSessions] = useState<ReadonlyArray<AgentSessionSummaryReadModel>>([]);
  const [selectedSession, setSelectedSession] = useState<AgentSessionDetailReadModel | undefined>();
  const [latestLaunch, setLatestLaunch] = useState<AgentLaunchReadModel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);

  const refreshAgents = async () => {
    setIsBusy(true);
    try {
      const response = await service.listAgents(true);
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to load agents.");
        return;
      }
      setAgents(response.data);
      if (!selectedAgentId && response.data[0]) {
        setSelectedAgentId(response.data[0].agent.id);
      }
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load agents.");
    } finally {
      setIsBusy(false);
    }
  };

  const refreshSnapshot = async (agentId: string) => {
    if (!agentId.trim()) {
      return;
    }
    setIsBusy(true);
    try {
      const snapshotResponse = await service.getStudioSnapshot(agentId);
      if (!snapshotResponse.ok || !snapshotResponse.data) {
        setError(snapshotResponse.error?.message ?? "Failed to load studio snapshot.");
        return;
      }
      setSnapshot(snapshotResponse.data);
      const sessionList = await service.listSessions(agentId);
      if (!sessionList.ok || !sessionList.data) {
        setError(sessionList.error?.message ?? "Failed to list sessions.");
        return;
      }
      setSessions(sessionList.data);
      if (sessionList.data[0]) {
        const detail = await service.getSessionDetail(sessionList.data[0].sessionId);
        if (detail.ok && detail.data) {
          setSelectedSession(detail.data);
        }
      } else {
        setSelectedSession(undefined);
      }
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load agent snapshot.");
    } finally {
      setIsBusy(false);
    }
  };

  const createAgent = async () => {
    const draftId = `agent:studio:${Date.now()}`;
    setIsBusy(true);
    try {
      const response = await service.createAgent(buildCreateRequest(draftId));
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to create agent.");
        setValidationError(response.error?.validationIssues ? JSON.stringify(response.error.validationIssues, null, 2) : undefined);
        return;
      }
      setSelectedAgentId(response.data.agent.id);
      await refreshAgents();
      await refreshSnapshot(response.data.agent.id);
    } finally {
      setIsBusy(false);
    }
  };

  const launchAgent = async () => {
    if (!selectedAgentId) {
      return;
    }
    setIsBusy(true);
    try {
      const response = await service.launchAgent({ agentId: selectedAgentId });
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to launch agent.");
        return;
      }
      setLatestLaunch(response.data);
      await refreshSnapshot(selectedAgentId);
    } finally {
      setIsBusy(false);
    }
  };

  const cancelLatestSession = async () => {
    const latest = sessions[0];
    if (!latest) {
      return;
    }
    setIsBusy(true);
    try {
      const response = await service.cancelSession(latest.sessionId);
      if (!response.ok) {
        setError(response.error?.message ?? "Failed to cancel run.");
        return;
      }
      await refreshSnapshot(selectedAgentId);
    } finally {
      setIsBusy(false);
    }
  };

  const loadSessionDetail = async (sessionId: string) => {
    setIsBusy(true);
    try {
      const response = await service.getSessionDetail(sessionId);
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to load session detail.");
        return;
      }
      setSelectedSession(response.data);
      setError(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const runConfigUpdate = async (action: () => Promise<{ ok: boolean; error?: { message: string; validationIssues?: unknown } }>) => {
    setIsBusy(true);
    try {
      const response = await action();
      if (!response.ok) {
        setError(response.error?.message ?? "Configuration update failed.");
        setValidationError(response.error?.validationIssues ? JSON.stringify(response.error.validationIssues, null, 2) : undefined);
        return;
      }
      setValidationError(undefined);
      await refreshSnapshot(selectedAgentId);
      setError(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void refreshAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      void refreshSnapshot(selectedAgentId);
    }
  }, [selectedAgentId]);

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="agent-studio-shell">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Agent Studio</h1>
          <p className="ui-page__subtitle">Thin shell over backend contracts for authoring, launch, sessions, and run control.</p>
        </div>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: "1rem" }}>
        <AgentListPanel
          agents={agents}
          selectedAgentId={selectedAgentId}
          isBusy={isBusy}
          onRefresh={() => { void refreshAgents(); }}
          onSelectAgent={setSelectedAgentId}
          onCreateAgent={() => { void createAgent(); }}
        />

        <div className="ui-stack ui-stack--sm">
          <AgentDetailPanel
            snapshot={snapshot}
            latestLaunch={latestLaunch}
            isBusy={isBusy}
            onLaunch={() => { void launchAgent(); }}
            onCancelLatest={() => { void cancelLatestSession(); }}
            onSaveGoals={(request) => { void runConfigUpdate(() => service.configureGoals(request)); }}
            onSavePolicy={(policy: AgentPolicy) => { void runConfigUpdate(() => service.configurePolicy(selectedAgentId, policy)); }}
            onSaveTools={(tools: AgentToolAccessPolicy) => { void runConfigUpdate(() => service.configureTools(selectedAgentId, tools)); }}
            onSaveMemory={(memory: AgentMemoryConfiguration) => { void runConfigUpdate(() => service.configureMemory(selectedAgentId, memory)); }}
            onSaveStrategy={(strategy: AgentPlanningStrategy) => { void runConfigUpdate(() => service.configureStrategy(selectedAgentId, strategy)); }}
          />
          <SessionListPanel
            sessions={sessions}
            selectedSessionId={selectedSession?.summary.sessionId}
            isBusy={isBusy}
            onSelectSession={(sessionId) => { void loadSessionDetail(sessionId); }}
          />
          <SessionDetailPanel session={selectedSession} />
        </div>
      </div>

      {error ? <div className="ui-banner ui-banner--danger">{error}</div> : null}
      {validationError ? <pre className="ui-card">{validationError}</pre> : null}
    </section>
  );
}
