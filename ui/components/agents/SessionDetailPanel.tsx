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
      <p className="ui-text-secondary">Terminal reason: {props.session.summary.terminalReason ?? "n/a"}</p>
      <p className="ui-text-secondary">
        Steps: {props.session.operational.executionProgress.completedStepCount}/{props.session.operational.executionProgress.attemptedStepCount}
      </p>
      <p className="ui-text-secondary">Retry summary: attempted {props.session.operational.retrySummary.attemptedSteps}, total attempts {props.session.operational.retrySummary.totalAttempts}, retried steps {props.session.operational.retrySummary.retriedSteps}</p>
      <p className="ui-text-secondary">Outcome summary: completed {props.session.operational.outcomeSummary.completed}, failed {props.session.operational.outcomeSummary.failed}, cancelled {props.session.operational.outcomeSummary.cancelled}, blocked {props.session.operational.outcomeSummary.blocked}</p>
      <p className="ui-text-secondary">Output asset references: {props.session.operational.outcomeSummary.outputAssetIds.join(", ") || "none"}</p>
      <p className="ui-text-secondary">Composition taxonomy: {props.session.composition.taxonomy.structuralKind}/{props.session.composition.taxonomy.semanticRole}/{props.session.composition.taxonomy.behaviorKind}</p>
      <details>
        <summary><strong>Transition history ({props.session.transitionHistory.length})</strong></summary>
        <ul className="ui-stack ui-stack--xs">
          {props.session.transitionHistory.map((entry, index) => (
            <li key={`${entry.status}-${entry.recordedAt}-${index}`}>{entry.recordedAt}: {entry.status}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
