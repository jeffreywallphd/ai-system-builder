import type { ContextPreviewResult } from "../../../application/context/models/ContextPreview";

function renderSource(entry: ContextPreviewResult["inspection"]["entries"][number]): string {
  const firstSource = entry.provenance[0];
  if (!firstSource) {
    return "direct";
  }

  return (
    firstSource.packageAlias ||
    firstSource.packageName ||
    firstSource.dynamicSourceLabel ||
    firstSource.dynamicSourceId ||
    firstSource.sourceType
  );
}

export interface ContextProvenanceTableProps {
  readonly preview?: ContextPreviewResult;
}

export default function ContextProvenanceTable({ preview }: ContextProvenanceTableProps): JSX.Element | null {
  if (!preview) {
    return null;
  }

  return (
    <section className="ui-panel" data-testid="context-provenance-table">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Provenance &amp; Ordering</div>
          <div className="ui-panel__subtitle">
            Included, trimmed, and excluded fragments stay visible so authors can debug ordering and source decisions.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        <div className="ui-table-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Fragment</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Order</th>
                <th>Source</th>
                <th>Reason</th>
                <th>Final chars</th>
              </tr>
            </thead>
            <tbody>
              {preview.inspection.entries.map((entry) => (
                <tr key={`${entry.fragmentId}-${entry.reason}`}>
                  <td>
                    <div><strong>{entry.title ?? entry.fragmentId}</strong></div>
                    <div className="ui-text-small ui-text-secondary">{entry.kind} · {entry.assemblyKey}</div>
                  </td>
                  <td>{entry.status}</td>
                  <td>{entry.stage}</td>
                  <td>{entry.order}</td>
                  <td>{renderSource(entry)}</td>
                  <td>{entry.reason}</td>
                  <td>{entry.finalCharacterCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {preview.capabilityDecisions && preview.capabilityDecisions.length > 0 ? (
          <div className="ui-stack ui-stack--sm" style={{ marginTop: "var(--ui-space-4)" }}>
            <div className="ui-meta-label">Agent capability reachability</div>
            <div className="ui-stack ui-stack--xs">
              {preview.capabilityDecisions.map((decision) => (
                <article key={decision.capabilityId} className="ui-card">
                  <div className="ui-card__body ui-row ui-row--between ui-row--wrap">
                    <div>
                      <strong>{decision.displayName}</strong>
                      <div className="ui-text-small ui-text-secondary">{decision.providerLabel} · {decision.capabilityId}</div>
                    </div>
                    <div className="ui-row ui-row--wrap">
                      <span className={`ui-badge ${decision.status === "allowed" ? "ui-badge--success" : "ui-badge--danger"}`}>{decision.status}</span>
                      <span className="ui-text-small ui-text-secondary">{decision.reason}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
