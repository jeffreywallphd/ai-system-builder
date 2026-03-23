import type { ExecutionRunProjection } from "../../../application/execution/ExecutionRunProjectionService";

export interface ExecutionHistoryPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly items: ReadonlyArray<ExecutionRunProjection>;
  readonly emptyMessage: string;
}

export default function ExecutionHistoryPanel({
  title,
  subtitle,
  items,
  emptyMessage,
}: ExecutionHistoryPanelProps): JSX.Element {
  return (
    <section className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div>
          <h3>{title}</h3>
          <p className="ui-text-secondary ui-text-small">{subtitle}</p>
        </div>

        {items.length === 0 ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--sm">
            {items.map((item) => (
              <article key={item.runId} className="ui-panel ui-stack ui-stack--2xs">
                <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                  <div className="ui-stack ui-stack--3xs" style={{ minWidth: 0 }}>
                    <strong>{item.terminalSummary ?? item.statusLabel}</strong>
                    <span className="ui-text-secondary ui-text-small">{item.runId}</span>
                  </div>
                  <span className={`ui-badge ui-badge--${item.statusTone}`}>{item.statusLabel}</span>
                </div>
                <div className="ui-text-secondary ui-text-small">
                  {item.progressLabel} · {item.executionPathLabel} · {item.durationSummary}
                </div>
                {item.currentUnitLabel ? (
                  <div className="ui-text-secondary ui-text-small">Current unit: {item.currentUnitLabel}</div>
                ) : null}
                {item.metadataSummary ? (
                  <div className="ui-text-secondary ui-text-small">Context: {item.metadataSummary}</div>
                ) : null}
                {item.executionPathDetail ? (
                  <div className="ui-text-secondary ui-text-small">Path detail: {item.executionPathDetail}</div>
                ) : null}
                {item.errorSummary ? (
                  <div className="ui-text-secondary ui-text-small">Error: {item.errorSummary}</div>
                ) : null}
                {item.diagnosticsSummary ? (
                  <div className="ui-text-secondary ui-text-small">Diagnostics: {item.diagnosticsSummary}</div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
