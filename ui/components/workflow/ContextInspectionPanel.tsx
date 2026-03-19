import type { ContextInspectionResult } from "../../../application/context/models/ContextInspectionResult";
import type { ContextProvenanceEntry } from "../../../application/context/models/ContextProvenanceEntry";

export interface ContextInspectionPanelProps {
  readonly inspection?: ContextInspectionResult;
}

function renderReasonLabel(entry: ContextProvenanceEntry): string {
  switch (entry.reason) {
    case "included":
      return "Included";
    case "trimmed-to-fit":
      return "Trimmed to fit budget";
    case "excluded-over-budget":
      return "Excluded by budget";
    case "excluded-by-visibility":
      return "Hidden by visibility";
    case "excluded-by-kind":
      return entry.stage === "assembly" ? "Blocked before assembly" : "Filtered by kind";
    case "excluded-by-source":
      return "Filtered by source";
    case "excluded-by-fragment-id":
      return "Blocked by fragment filter";
    case "excluded-by-package-filter":
      return "Blocked by package filter";
    case "shadowed-by-precedence":
      return "Replaced by higher priority fragment";
    default:
      return entry.reason;
  }
}

export default function ContextInspectionPanel({ inspection }: ContextInspectionPanelProps): JSX.Element | null {
  if (!inspection) {
    return null;
  }

  const includedCount = inspection.entries.filter((entry) => entry.status === "included").length;
  const trimmedCount = inspection.entries.filter((entry) => entry.status === "trimmed").length;
  const excludedCount = inspection.entries.filter((entry) => entry.status === "excluded").length;

  return (
    <section className="ui-panel" data-testid="context-inspection-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Context Inspection</div>
          <div className="ui-panel__subtitle">
            Author-only trace of how the final context was assembled, filtered, and budgeted.
          </div>
        </div>
      </div>

      <div className="ui-panel__body ui-stack ui-stack--md">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Included</div>
            <div className="ui-meta-value">{includedCount}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Trimmed</div>
            <div className="ui-meta-value">{trimmedCount}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Excluded</div>
            <div className="ui-meta-value">{excludedCount}</div>
          </div>
        </div>

        <div className="ui-stack ui-stack--xs">
          <div className="ui-meta-label">Final assembled context</div>
          <pre className="ui-card ui-card__body ui-text-mono">{inspection.finalPromptText || "No context survived the current filters."}</pre>
        </div>

        <div className="ui-stack ui-stack--sm" aria-label="Context provenance entries">
          {inspection.entries.map((entry) => (
            <article key={`${entry.fragmentId}-${entry.reason}`} className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--xs">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
                    <div className="ui-heading-4">{entry.title ?? entry.fragmentId}</div>
                    <div className="ui-text-secondary ui-text-small">
                      {entry.kind} · order {entry.order} · priority {entry.precedence}
                    </div>
                  </div>

                  <div className="ui-row ui-row--wrap">
                    <span className={`ui-badge ${entry.status === "included" ? "ui-badge--success" : entry.status === "trimmed" ? "ui-badge--warning" : "ui-badge--danger"}`}>
                      {entry.status}
                    </span>
                    <span className="ui-badge ui-badge--neutral">{entry.stage}</span>
                  </div>
                </div>

                <div className="ui-text-secondary">{renderReasonLabel(entry)}</div>

                <div className="ui-row ui-row--wrap ui-text-small ui-text-secondary">
                  <span>Visibility: {entry.visibility}</span>
                  {entry.matchedSources.length > 0 ? (
                    <span>Sources: {entry.matchedSources.join(", ")}</span>
                  ) : null}
                </div>

                {entry.provenance.length > 0 ? (
                  <div className="ui-stack ui-stack--2xs">
                    <div className="ui-meta-label">Provenance</div>
                    <ul className="ui-stack ui-stack--2xs ui-text-small ui-text-secondary">
                      {entry.provenance.map((source, index) => (
                        <li key={`${entry.fragmentId}-${source.fragmentId}-${index}`}>
                          {source.fragmentTitle ?? source.fragmentId}
                          {source.packageAlias ? ` from ${source.packageAlias}` : source.packageName ? ` from ${source.packageName}` : " from direct input"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {entry.status !== "excluded" ? (
                  <div className="ui-stack ui-stack--2xs">
                    <div className="ui-meta-label">Final content</div>
                    <pre className="ui-text-mono ui-subtle">{entry.finalContent}</pre>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
