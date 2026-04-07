import type { AgentSessionDetailReadModel } from "../../../application/agents/contracts/AgentRunContracts";

interface SessionOperationalSummaryProps {
  readonly session: AgentSessionDetailReadModel;
}

export function SessionOperationalSummary(props: SessionOperationalSummaryProps): JSX.Element {
  const { summary, operational } = props.session;
  return (
    <section className="ui-stack ui-stack--xs" aria-label="Operational summary">
      <h4 className="ui-heading-4">Operational summary</h4>
      <p className="ui-text-secondary">Status: {summary.status}</p>
      <p className="ui-text-secondary">Terminal reason: {summary.terminalReason ?? "n/a"}</p>
      <p className="ui-text-secondary">
        Progress: {operational.executionProgress.completedStepCount}/{operational.executionProgress.attemptedStepCount}
        {` (${operational.executionProgress.hadPartialProgress ? "partial progress" : "no partial progress"})`}
      </p>
      <p className="ui-text-secondary">
        Retry summary: attempted {operational.retrySummary.attemptedSteps}, total attempts {operational.retrySummary.totalAttempts}, retried steps {operational.retrySummary.retriedSteps}
      </p>
      <p className="ui-text-secondary">
        Outcomes: completed {operational.outcomeSummary.completed}, failed {operational.outcomeSummary.failed}, cancelled {operational.outcomeSummary.cancelled}, blocked {operational.outcomeSummary.blocked}
      </p>
    </section>
  );
}
