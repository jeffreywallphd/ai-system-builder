import { Link } from "react-router-dom";
import type {
  RunWorkflowStudioDraftReadModel,
  WorkflowExecutionReadinessReadModel,
} from "../../../../src/infrastructure/api/studio-shell/StudioShellBackendApi";

export interface WorkflowStudioRunFeedback {
  readonly status: "running" | "blocked" | "launched" | "failed";
  readonly message: string;
  readonly result?: RunWorkflowStudioDraftReadModel;
}

interface WorkflowStudioExecutionFeedbackPanelProps {
  readonly readiness?: WorkflowExecutionReadinessReadModel;
  readonly isReadinessPending?: boolean;
  readonly runFeedback?: WorkflowStudioRunFeedback;
  readonly runHistoryPath?: string;
  readonly runDetailPath?: string;
}

function getBadgeTone(status: "success" | "warning" | "danger" | "neutral"): string {
  if (status === "success") {
    return "success";
  }
  if (status === "warning") {
    return "warning";
  }
  if (status === "danger") {
    return "danger";
  }
  return "neutral";
}

export default function WorkflowStudioExecutionFeedbackPanel({
  readiness,
  isReadinessPending = false,
  runFeedback,
  runHistoryPath,
  runDetailPath,
}: WorkflowStudioExecutionFeedbackPanelProps): JSX.Element {
  const readinessState = isReadinessPending
    ? Object.freeze({
      tone: "warning" as const,
      label: "Checking",
      message: "Checking execution readiness through the canonical validation pipeline.",
    })
    : readiness
      ? readiness.ready
        ? Object.freeze({
          tone: "success" as const,
          label: "Ready to run",
          message: "Execution readiness checks passed. Launch is eligible.",
        })
        : Object.freeze({
          tone: "danger" as const,
          label: "Not ready",
          message: "Execution launch is blocked until blocking validation issues are resolved.",
        })
      : Object.freeze({
        tone: "neutral" as const,
        label: "Unknown",
        message: "Run Validation to refresh execution readiness before launch.",
      });

  const launchBadgeTone = runFeedback?.status === "launched"
    ? "success"
    : runFeedback?.status === "running"
      ? "warning"
      : runFeedback
        ? "danger"
        : "neutral";

  return (
    <div className="ui-card ui-card--padded ui-stack ui-stack--xs ui-studio-shell__workflow-feedback" data-testid="studio-shell-workflow-run-feedback">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Workflow execution feedback</strong>
        <span className={`ui-badge ui-badge--${getBadgeTone(readinessState.tone)}`} data-testid="studio-shell-workflow-readiness-badge">
          {readinessState.label}
        </span>
      </div>
      <p className="ui-text-small ui-text-secondary">{readinessState.message}</p>
      {readiness ? (
        <div className="ui-stack ui-stack--2xs ui-text-small ui-text-secondary">
          <div>
            Validation: {readiness.blockingIssueCount} blocking, {readiness.warningIssueCount} warning issue(s).
          </div>
          {readiness.issues.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs">
              {readiness.issues.slice(0, 5).map((issue) => (
                <li key={`${issue.code}-${issue.path ?? issue.message}`}>
                  [{issue.severity}] {issue.code}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {runFeedback ? (
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <div className="ui-row ui-row--between ui-row--wrap">
            <strong>Launch status</strong>
            <span className={`ui-badge ui-badge--${getBadgeTone(launchBadgeTone)}`}>
              {runFeedback.status}
            </span>
          </div>
          <p className="ui-text-small ui-text-secondary">{runFeedback.message}</p>
          {runFeedback.result ? (
            <div className="ui-stack ui-stack--2xs ui-text-small ui-text-secondary">
              <div>
                Execution state: {runFeedback.result.execution.state} ({runFeedback.result.execution.launchAccepted ? "accepted" : "not accepted"})
              </div>
              {runFeedback.result.execution.failure ? (
                <div>
                  Failure: [{runFeedback.result.execution.failure.kind}] {runFeedback.result.execution.failure.message}
                </div>
              ) : null}
              {runFeedback.result.execution.transitions.length > 0 ? (
                <ul className="ui-stack ui-stack--2xs">
                  {runFeedback.result.execution.transitions.map((entry) => (
                    <li key={`${entry.state}-${entry.occurredAt}`}>
                      {entry.state}: {entry.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {runFeedback.result.runtime?.outputDelivery ? (
                <div className="ui-stack ui-stack--2xs">
                  <div>
                    Result handoff: {runFeedback.result.runtime.outputDelivery.deliveredCount} delivered, {" "}
                    {runFeedback.result.runtime.outputDelivery.failedCount} failed.
                  </div>
                  {runFeedback.result.runtime.outputDelivery.results.length > 0 ? (
                    <ul className="ui-stack ui-stack--2xs">
                      {runFeedback.result.runtime.outputDelivery.results.slice(0, 5).map((entry) => (
                        <li key={`${entry.outputId}-${entry.target}`}>
                          {entry.outputId}: {entry.destinationType} {"->"} {entry.target} ({entry.status})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {(runDetailPath || runHistoryPath) ? (
                <div className="ui-row ui-row--wrap">
                  {runDetailPath ? (
                    <Link className="ui-button ui-button--primary ui-button--sm" to={runDetailPath}>
                      View current run
                    </Link>
                  ) : null}
                  {runHistoryPath ? (
                    <Link className="ui-button ui-button--ghost ui-button--sm" to={runHistoryPath}>
                      View run history
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

