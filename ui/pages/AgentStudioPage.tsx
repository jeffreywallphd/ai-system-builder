import { useEffect, useMemo, useState } from "react";
import { resolveDesktopAgentBridge } from "../composition/DesktopAgentBridgeAdapter";
import type { AgentStudioApiResponse } from "../../infrastructure/api/agents/AgentStudioBackendApi";
import type { AgentAuthoringApiReadModel } from "../../infrastructure/api/agents/AgentAuthoringBackendApi";
import type { AgentLaunchReadModel, AgentRunControlAction, AgentSessionDetailReadModel, AgentSessionSummaryReadModel } from "../../application/agents/contracts/AgentRunContracts";

interface AgentStudioSnapshotReadModel {
  readonly agent: AgentAuthoringApiReadModel;
  readonly sessions: ReadonlyArray<AgentSessionSummaryReadModel>;
  readonly latestSession?: AgentSessionDetailReadModel;
  readonly capabilities: {
    readonly launch: boolean;
    readonly triggerLaunch: boolean;
    readonly controls: ReadonlyArray<AgentRunControlAction>;
  };
}

export default function AgentStudioPage(): JSX.Element {
  const bridge = useMemo(() => resolveDesktopAgentBridge(), []);
  const [agents, setAgents] = useState<ReadonlyArray<AgentAuthoringApiReadModel>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<AgentStudioSnapshotReadModel | undefined>();
  const [latestLaunch, setLatestLaunch] = useState<AgentLaunchReadModel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);

  const loadAgents = async () => {
    if (!bridge) {
      setError("Desktop agent bridge is unavailable in this runtime.");
      return;
    }
    setIsBusy(true);
    try {
      const raw = await bridge.listAgents(true);
      const response = JSON.parse(raw) as AgentStudioApiResponse<ReadonlyArray<AgentAuthoringApiReadModel>>;
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to load agents.");
        return;
      }
      setAgents(response.data);
      if (!selectedAgentId && response.data[0]) {
        setSelectedAgentId(response.data[0].agent.id);
      }
      setError(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const loadSnapshot = async (agentId: string) => {
    if (!bridge || !agentId.trim()) {
      return;
    }
    setIsBusy(true);
    try {
      const raw = await bridge.getStudioSnapshot(agentId);
      const response = JSON.parse(raw) as AgentStudioApiResponse<AgentStudioSnapshotReadModel>;
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to load agent snapshot.");
        setSnapshot(undefined);
        return;
      }
      setSnapshot(response.data);
      setError(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const launchSelectedAgent = async () => {
    if (!bridge || !selectedAgentId.trim()) {
      return;
    }
    setIsBusy(true);
    try {
      const raw = await bridge.launchAgent(JSON.stringify({ agentId: selectedAgentId }));
      const response = JSON.parse(raw) as AgentStudioApiResponse<AgentLaunchReadModel>;
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Failed to launch agent.");
        return;
      }
      setLatestLaunch(response.data);
      setError(undefined);
      await loadSnapshot(selectedAgentId);
    } finally {
      setIsBusy(false);
    }
  };

  const cancelLatestSession = async () => {
    if (!bridge || !snapshot?.sessions[0]) {
      return;
    }
    setIsBusy(true);
    try {
      const raw = await bridge.controlRun(JSON.stringify({ sessionId: snapshot.sessions[0].sessionId, action: "cancel" }));
      const response = JSON.parse(raw) as AgentStudioApiResponse<AgentSessionSummaryReadModel>;
      if (!response.ok) {
        setError(response.error?.message ?? "Failed to control run.");
        return;
      }
      setError(undefined);
      await loadSnapshot(selectedAgentId);
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      void loadSnapshot(selectedAgentId);
    }
  }, [selectedAgentId]);

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="agent-studio-shell">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Agent Studio</h1>
          <p className="ui-page__subtitle">Thin shell over backend Agent Studio contracts for authoring, launch, and session operations.</p>
        </div>
      </div>

      <div className="ui-card ui-stack ui-stack--sm">
        <div className="ui-row ui-row--between">
          <h2 className="ui-heading-2">Agents</h2>
          <button className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void loadAgents(); }} disabled={isBusy}>Refresh</button>
        </div>
        <select
          className="ui-input"
          value={selectedAgentId}
          onChange={(event) => setSelectedAgentId(event.target.value)}
          disabled={isBusy || agents.length === 0}
        >
          {agents.map((entry) => (
            <option key={entry.agent.id} value={entry.agent.id}>{entry.agent.name} ({entry.agent.id})</option>
          ))}
        </select>
      </div>

      <div className="ui-card ui-stack ui-stack--sm">
        <h2 className="ui-heading-2">Run controls</h2>
        <div className="ui-row ui-row--wrap">
          <button className="ui-button ui-button--primary ui-button--sm" onClick={() => { void launchSelectedAgent(); }} disabled={isBusy || !snapshot?.capabilities.launch}>Launch agent</button>
          <button className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void cancelLatestSession(); }} disabled={isBusy || !snapshot?.sessions[0]}>Cancel latest run</button>
        </div>
      </div>

      <div className="ui-card ui-stack ui-stack--sm">
        <h2 className="ui-heading-2">Session list</h2>
        <ul className="ui-stack ui-stack--xs">
          {(snapshot?.sessions ?? []).map((session) => (
            <li key={session.sessionId}>
              <strong>{session.sessionId}</strong> — {session.status} ({session.completedStepCount}/{session.attemptedStepCount})
            </li>
          ))}
        </ul>
      </div>

      {latestLaunch ? (
        <div className="ui-card ui-stack ui-stack--sm">
          <h2 className="ui-heading-2">Latest launch</h2>
          <p className="ui-text-secondary">Execution {latestLaunch.launch.executionId} finished with status {latestLaunch.launch.status}.</p>
        </div>
      ) : null}

      {error ? <p className="ui-text-danger">{error}</p> : null}
    </section>
  );
}
