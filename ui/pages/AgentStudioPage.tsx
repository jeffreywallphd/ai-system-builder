import { useEffect, useMemo, useState } from "react";
import type { AgentMemoryConfiguration } from "../../domain/agents/AgentMemory";
import { AssetId } from "../../domain/assets/AssetId";
import type { AgentPlanningStrategy } from "../../domain/agents/Agent";
import type { AgentPolicy, AgentToolAccessPolicy } from "../../domain/agents/AgentPolicy";
import type {
  AgentLaunchReadModel,
  AgentRunControlAction,
  AgentRunRequest,
  AgentSessionDetailReadModel,
  AgentSessionSummaryReadModel,
} from "../../application/agents/contracts/AgentRunContracts";
import type { TriggerAgentLaunchRequest } from "../../application/agents/TriggerAgentLaunchUseCase";
import type { AgentAuthoringApiReadModel } from "../../infrastructure/api/agents/AgentAuthoringBackendApi";
import type { AgentStudioSnapshotReadModel } from "../../infrastructure/api/agents/AgentStudioBackendApi";
import { AgentStudioService } from "../services/AgentStudioService";
import { AgentListPanel } from "../components/agents/AgentListPanel";
import { AgentDetailPanel } from "../components/agents/AgentDetailPanel";
import { AgentLaunchPanel } from "../components/agents/AgentLaunchPanel";
import { SessionListPanel } from "../components/agents/SessionListPanel";
import { SessionDetailPanel } from "../components/agents/SessionDetailPanel";
import { useUiDependencies } from "../composition/AppProviders";

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

function toIssueList(value: unknown): ReadonlyArray<unknown> {
  return Array.isArray(value) ? value : [];
}

export default function AgentStudioPage(): JSX.Element {
  const { canonicalAssetManagementService } = useUiDependencies();
  const service = useMemo(() => new AgentStudioService(), []);
  const [agents, setAgents] = useState<ReadonlyArray<AgentAuthoringApiReadModel>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<AgentStudioSnapshotReadModel | undefined>();
  const [sessions, setSessions] = useState<ReadonlyArray<AgentSessionSummaryReadModel>>([]);
  const [selectedSession, setSelectedSession] = useState<AgentSessionDetailReadModel | undefined>();
  const [latestLaunch, setLatestLaunch] = useState<AgentLaunchReadModel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [validationIssues, setValidationIssues] = useState<ReadonlyArray<unknown>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingControlAction, setPendingControlAction] = useState<AgentRunControlAction | undefined>();

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
        setValidationIssues(toIssueList(response.error?.validationIssues));
        return;
      }
      setSelectedAgentId(response.data.agent.id);
      await refreshAgents();
      await refreshSnapshot(response.data.agent.id);
    } finally {
      setIsBusy(false);
    }
  };

  const launchAgent = async (request: AgentRunRequest) => {
    if (!selectedAgentId || request.agentId !== selectedAgentId) {
      return;
    }
    setIsBusy(true);
    try {
      const response = await service.launchAgent(request);
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

  const triggerLaunch = async (request: TriggerAgentLaunchRequest) => {
    if (!selectedAgentId || request.agentId !== selectedAgentId) {
      return;
    }
    setIsBusy(true);
    try {
      const response = await service.triggerLaunch(request);
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to launch agent.");
        return;
      }
      setLatestLaunch(response.data);
      await refreshSnapshot(selectedAgentId);
      setError(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const controlSession = async (sessionId: string, action: AgentRunControlAction) => {
    if (!sessionId) {
      return;
    }
    setPendingControlAction(action);
    setIsBusy(true);
    try {
      const response = await service.controlRun(sessionId, action);
      if (!response.ok) {
        setError(response.error?.message ?? "Failed to control run.");
        return;
      }
      await refreshSnapshot(selectedAgentId);
      setError(undefined);
    } finally {
      setPendingControlAction(undefined);
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
        setValidationIssues(toIssueList(response.error?.validationIssues));
        return;
      }
      setValidationIssues([]);
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
            isBusy={isBusy}
            canonicalAssetManagementService={canonicalAssetManagementService}
            onSaveGoals={(request) => { void runConfigUpdate(() => service.configureGoals(request)); }}
            onSavePolicy={(policy: AgentPolicy) => { void runConfigUpdate(() => service.configurePolicy(selectedAgentId, policy)); }}
            onSaveTools={(tools: AgentToolAccessPolicy) => { void runConfigUpdate(() => service.configureTools(selectedAgentId, tools)); }}
            onSaveMemory={(memory: AgentMemoryConfiguration) => { void runConfigUpdate(() => service.configureMemory(selectedAgentId, memory)); }}
            onSaveStrategy={(strategy: AgentPlanningStrategy) => { void runConfigUpdate(() => service.configureStrategy(selectedAgentId, strategy)); }}
          />
          <AgentLaunchPanel
            snapshot={snapshot}
            latestLaunch={latestLaunch}
            selectedSession={sessions.find((entry) => entry.sessionId === selectedSession?.summary.sessionId)}
            isBusy={isBusy}
            canonicalAssetManagementService={canonicalAssetManagementService}
            onLaunch={(request) => { void launchAgent(request); }}
            onTriggerLaunch={(request) => { void triggerLaunch(request); }}
            pendingControlAction={pendingControlAction}
            onControlRun={(sessionId, action) => { void controlSession(sessionId, action); }}
          />
          <SessionListPanel
            sessions={sessions}
            controls={snapshot?.capabilities.controls ?? []}
            selectedSessionId={selectedSession?.summary.sessionId}
            isBusy={isBusy}
            pendingControlAction={pendingControlAction}
            onSelectSession={(sessionId) => { void loadSessionDetail(sessionId); }}
            onControlRun={(sessionId, action) => { void controlSession(sessionId, action); }}
          />
          <SessionDetailPanel
            session={selectedSession}
            controls={snapshot?.capabilities.controls ?? []}
            isBusy={isBusy}
            pendingControlAction={pendingControlAction}
            canonicalAssetManagementService={canonicalAssetManagementService}
            onControlRun={(sessionId, action) => { void controlSession(sessionId, action); }}
          />
        </div>
      </div>

      {error ? <div className="ui-banner ui-banner--danger">{error}</div> : null}
      {validationIssues.length > 0 ? (
        <div className="ui-card ui-stack ui-stack--xs">
          <h3 className="ui-heading-3">Validation issues</h3>
          <ul className="ui-stack ui-stack--xs">
            {validationIssues.map((issue, index) => (
              <li key={`validation-issue-${index}`}>{typeof issue === "string" ? issue : JSON.stringify(issue)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
