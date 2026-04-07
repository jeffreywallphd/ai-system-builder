import type { RuntimeExecutionStatusReadModel } from "@infrastructure/api/system-runtime/SystemRuntimeBackendApi";

function toTone(status: RuntimeExecutionStatusReadModel["nodeStatuses"][number]["status"]): "success" | "warning" | "danger" | "info" {
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

export function ExecutionStepStatusList({ status }: { readonly status: RuntimeExecutionStatusReadModel }): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="execution-step-status-list">
      <strong>Step/node status</strong>
      {status.nodeStatuses.length === 0 ? (
        <p className="ui-text-small ui-text-secondary">No node state is available for this execution yet.</p>
      ) : (
        <div className="ui-stack ui-stack--2xs">
          {status.nodeStatuses.map((node) => (
            <div key={node.nodeId} className="ui-panel ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                <span className="ui-text-small"><strong>{node.nodeId}</strong></span>
                <span className={`ui-badge ui-badge--${toTone(node.status)}`}>{node.status}</span>
              </div>
              <span className="ui-text-small ui-text-secondary">
                {node.structuralKind}/{node.semanticRole}/{node.behaviorKind}
              </span>
              <span className="ui-text-small ui-text-secondary">
                Iterations: {node.iterationCount} Â· Planning cycles: {node.planningCycleCount}
              </span>
              {node.lastError ? (
                <span className="ui-text-small ui-text-danger">Error: {node.lastError.code} â€” {node.lastError.message}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <details>
        <summary>Nested system execution state ({status.nestedSystems.length})</summary>
        {status.nestedSystems.length === 0 ? (
          <p className="ui-text-small ui-text-secondary">No nested system nodes were attached in this run.</p>
        ) : (
          <ul className="ui-text-small ui-text-secondary" style={{ marginTop: "0.5rem" }}>
            {status.nestedSystems.map((nested) => (
              <li key={nested.nodeId}>{nested.nodeId}: {nested.status}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

