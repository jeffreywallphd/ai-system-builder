import type { ContextPreviewResult } from "@application/context/models/ContextPreview";

export interface ContextPreviewPanelProps {
  readonly preview?: ContextPreviewResult;
}

export default function ContextPreviewPanel({ preview }: ContextPreviewPanelProps): JSX.Element | null {
  if (!preview) {
    return null;
  }

  return (
    <section className="ui-panel" data-testid="context-preview-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Execution Preview</div>
          <div className="ui-panel__subtitle">
            Inspect the exact context payload that will reach the {preview.target.kind} execution path.
          </div>
        </div>
      </div>

      <div className="ui-panel__body ui-stack ui-stack--md">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Target</div>
            <div className="ui-meta-value">{preview.target.label}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Recipes</div>
            <div className="ui-meta-value">{preview.selectedRecipeIds.length}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Packages</div>
            <div className="ui-meta-value">{preview.selectedPackageIds.length}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Final fragments</div>
            <div className="ui-meta-value">{preview.inspection.finalFragments.length}</div>
          </div>
        </div>

        <div className="ui-stack ui-stack--xs">
          <div className="ui-meta-label">Delivery surfaces</div>
          <div className="ui-stack ui-stack--xs">
            {preview.deliveryTargets.map((target) => (
              <article key={target.channel} className="ui-card">
                <div className="ui-card__body ui-stack ui-stack--2xs">
                  <div className="ui-row ui-row--between ui-row--wrap">
                    <strong>{target.label}</strong>
                    <span className="ui-badge ui-badge--neutral">{target.channel}</span>
                  </div>
                  <div className="ui-text-secondary ui-text-small">{target.summary}</div>
                  {target.content ? <pre className="ui-subtle ui-text-mono">{target.content}</pre> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="ui-grid ui-grid--2col" style={{ gap: "var(--ui-space-4)" }}>
          <div className="ui-stack ui-stack--xs">
            <div className="ui-meta-label">Assembled context</div>
            <pre className="ui-card ui-card__body ui-text-mono">{preview.inspection.assembledPromptText || "No assembled context."}</pre>
          </div>
          <div className="ui-stack ui-stack--xs">
            <div className="ui-meta-label">Final execution context</div>
            <pre className="ui-card ui-card__body ui-text-mono">{preview.inspection.finalPromptText || "No final context."}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

