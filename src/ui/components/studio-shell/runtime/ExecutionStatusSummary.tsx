import type { RuntimeExecutionStatusReadModel } from "../../../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";

function toTone(status: RuntimeExecutionStatusReadModel["status"]): "success" | "warning" | "danger" | "info" {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "danger";
  }
  if (status === "running") {
    return "warning";
  }
  return "info";
}

export function ExecutionStatusSummary({ status }: { readonly status: RuntimeExecutionStatusReadModel }): JSX.Element {
  const progress = status.progress.totalNodeCount > 0
    ? Math.round((status.progress.completedNodeCount / status.progress.totalNodeCount) * 100)
    : 0;

  return (
    <div className="ui-stack ui-stack--xs" data-testid="execution-status-summary">
      <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
        <strong>Execution status</strong>
        <span className={`ui-badge ui-badge--${toTone(status.status)}`}>{status.status}</span>
      </div>
      <div className="ui-text-small ui-text-secondary">
        Progress: {status.progress.completedNodeCount}/{status.progress.totalNodeCount} nodes ({progress}%)
      </div>
      <div className="ui-text-small ui-text-secondary">
        Running: {status.progress.runningNodeCount} · Failed: {status.progress.failedNodeCount} · Errors: {status.errorCount}
      </div>
      <div className="ui-text-small ui-text-secondary">
        Recovery decisions: {status.recovery.decisionCount} (retries: {status.recovery.retryDecisionCount})
      </div>
    </div>
  );
}
