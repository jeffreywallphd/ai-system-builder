import type { ExecutionRunDetailProjection } from "../../../application/execution/ExecutionRunDetailProjectionService";
import type { ExecutionRelatedRunClusterProjection } from "../../../application/execution/ExecutionRelatedRunClusterProjectionService";

export interface ExecutionRunDetailPanelProps {
  readonly detail?: ExecutionRunDetailProjection;
  readonly emptyMessage: string;
  readonly relatedRunCluster?: ExecutionRelatedRunClusterProjection;
  readonly onSelectRun?: (runId: string) => void;
}

export default function ExecutionRunDetailPanel({
  detail,
  emptyMessage,
  relatedRunCluster,
  onSelectRun,
}: ExecutionRunDetailPanelProps): JSX.Element {
  if (!detail) {
    return (
      <article className="ui-panel ui-stack ui-stack--sm">
        <h4>Execution run detail</h4>
        <p className="ui-text-secondary ui-text-small">{emptyMessage}</p>
      </article>
    );
  }

  return (
    <article className="ui-panel ui-stack ui-stack--sm">
      <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
        <div className="ui-stack ui-stack--3xs" style={{ minWidth: 0 }}>
          <h4 style={{ margin: 0 }}>{detail.terminalSummary ?? detail.summary.statusLabel}</h4>
          <span className="ui-text-secondary ui-text-small">{detail.runId}</span>
        </div>
        <span className={`ui-badge ui-badge--${detail.summary.statusTone}`}>{detail.summary.statusLabel}</span>
      </div>

      <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
        <div className="ui-stack ui-stack--2xs">
          <strong>Run metadata</strong>
          <div className="ui-text-secondary ui-text-small">Plan: {detail.planId}</div>
          <div className="ui-text-secondary ui-text-small">Execution kind: {detail.executionKind ?? "unknown"}</div>
          <div className="ui-text-secondary ui-text-small">Duration: {detail.durationSummary}</div>
          <div className="ui-text-secondary ui-text-small">Cancellation: {detail.cancellationSupported ? "supported" : "not supported"}</div>
          {detail.summary.metadataSummary ? <div className="ui-text-secondary ui-text-small">Context: {detail.summary.metadataSummary}</div> : null}
          {detail.executionPathDetail ? <div className="ui-text-secondary ui-text-small">Path detail: {detail.executionPathDetail}</div> : null}
          {detail.artifactSummary ? <div className="ui-text-secondary ui-text-small">Artifacts: {detail.artifactSummary.count} ({detail.artifactSummary.labels.join(", ")})</div> : null}
        </div>
        <div className="ui-stack ui-stack--2xs">
          <strong>Terminal summary</strong>
          <div className="ui-text-secondary ui-text-small">{detail.terminalSummary ?? "No terminal summary recorded yet."}</div>
          {detail.diagnosticsSummary ? <div className="ui-text-secondary ui-text-small">Diagnostics: {detail.diagnosticsSummary}</div> : null}
          <div className="ui-text-secondary ui-text-small">Started: {detail.startedAt}</div>
          <div className="ui-text-secondary ui-text-small">Updated: {detail.updatedAt}</div>
          {detail.completedAt ? <div className="ui-text-secondary ui-text-small">Completed: {detail.completedAt}</div> : null}
        </div>
      </div>

      {detail.provenanceEntries.length > 0 ? (
        <div className="ui-stack ui-stack--2xs">
          <strong>Execution path</strong>
          <ul className="ui-text-secondary ui-text-small">
            {detail.provenanceEntries.map((entry) => <li key={entry.key}>{entry.value}</li>)}
          </ul>
        </div>
      ) : null}

      {relatedRunCluster && relatedRunCluster.runs.length > 1 ? (
        <div className="ui-stack ui-stack--2xs">
          <strong>Related runs</strong>
          <div className="ui-text-secondary ui-text-small">
            {relatedRunCluster.groupLabel} · {relatedRunCluster.orderingLabel}
          </div>
          <div className="ui-stack ui-stack--2xs">
            {relatedRunCluster.runs.map((entry) => (
              <button
                key={entry.run.runId}
                type="button"
                className="ui-panel ui-row ui-row--between ui-row--wrap"
                style={{
                  textAlign: "left",
                  borderColor: entry.isAnchor ? "var(--color-border-strong)" : undefined,
                }}
                onClick={() => onSelectRun?.(entry.run.runId)}
                disabled={!onSelectRun || entry.run.runId === detail.runId}
              >
                <span className="ui-text-secondary ui-text-small">
                  {entry.relationLabel}: {entry.run.runId}
                </span>
                <span className={`ui-badge ui-badge--${entry.run.statusTone}`}>{entry.run.statusLabel}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ui-stack ui-stack--2xs">
        <strong>Units</strong>
        <div className="ui-stack ui-stack--2xs">
          {detail.units.map((unit) => (
            <div key={unit.unitId} className="ui-panel ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                <div className="ui-stack ui-stack--3xs">
                  <strong>{unit.label}</strong>
                  <span className="ui-text-secondary ui-text-small">{unit.kind} · {unit.unitId}</span>
                </div>
                <span className={`ui-badge ui-badge--${unit.statusTone}`}>{unit.statusLabel}</span>
              </div>
              {unit.outputSummary ? <div className="ui-text-secondary ui-text-small">Summary: {unit.outputSummary}</div> : null}
              {unit.provenanceLabel ? <div className="ui-text-secondary ui-text-small">Path: {unit.provenanceLabel}{unit.provenanceDetail ? ` — ${unit.provenanceDetail}` : ""}</div> : null}
              {unit.errorMessage ? <div className="ui-text-secondary ui-text-small">Error: {unit.errorMessage}</div> : null}
              {unit.dependsOn.length > 0 ? <div className="ui-text-secondary ui-text-small">Depends on: {unit.dependsOn.join(", ")}</div> : null}
              {unit.artifactSummary ? <div className="ui-text-secondary ui-text-small">Artifacts: {unit.artifactSummary.count} ({unit.artifactSummary.labels.join(", ")})</div> : null}
              {unit.outputMetadata.length > 0 ? (
                <details>
                  <summary>Unit metadata</summary>
                  <ul className="ui-text-secondary ui-text-small" style={{ marginTop: "0.5rem" }}>
                    {unit.outputMetadata.map((entry) => <li key={entry.key}>{entry.key}: {entry.value}</li>)}
                  </ul>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
        <div className="ui-stack ui-stack--2xs">
          <strong>Transition timeline</strong>
          {detail.timeline.length > 0 ? (
            <ul className="ui-text-secondary ui-text-small">
              {detail.timeline.map((entry, index) => (
                <li key={`${entry.unitId}:${entry.occurredAt}:${index}`}>
                  <strong>{entry.unitLabel}</strong>: {entry.fromStatus ? `${entry.fromStatus} → ` : ""}{entry.toStatus}
                  {entry.message ? ` — ${entry.message}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-text-secondary ui-text-small">No transitions recorded.</p>
          )}
        </div>
        <div className="ui-stack ui-stack--2xs">
          <strong>Diagnostics</strong>
          {detail.diagnostics.length > 0 ? (
            <ul className="ui-text-secondary ui-text-small">
              {detail.diagnostics.map((diagnostic) => (
                <li key={`${diagnostic.source}:${diagnostic.code}:${diagnostic.message}`}>
                  <strong>{diagnostic.severity}</strong>: {diagnostic.message}
                  {diagnostic.detail ? ` — ${diagnostic.detail}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-text-secondary ui-text-small">No diagnostics recorded for this run.</p>
          )}
        </div>
      </div>
    </article>
  );
}
