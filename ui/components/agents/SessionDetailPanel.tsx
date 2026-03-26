import type { AgentSessionDetailReadModel } from "../../../application/agents/contracts/AgentRunContracts";

interface SessionDetailPanelProps {
  readonly session?: AgentSessionDetailReadModel;
}

export function SessionDetailPanel(props: SessionDetailPanelProps): JSX.Element {
  if (!props.session) {
    return (
      <div className="ui-card ui-stack ui-stack--sm" data-testid="session-detail-panel">
        <h3 className="ui-heading-3">Session detail</h3>
        <p className="ui-text-secondary">Select a session to view detail.</p>
      </div>
    );
  }

  return (
    <div className="ui-card ui-stack ui-stack--sm" data-testid="session-detail-panel">
      <h3 className="ui-heading-3">Session detail</h3>
      <p className="ui-text-secondary">Session {props.session.summary.sessionId} is {props.session.summary.status}.</p>
      <p className="ui-text-secondary">
        Steps: {props.session.operational.executionProgress.completedStepCount}/{props.session.operational.executionProgress.attemptedStepCount}
      </p>
      <p className="ui-text-secondary">Transitions: {props.session.transitionHistory.length}</p>
    </div>
  );
}
