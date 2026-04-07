import type { ModelCompatibilityViewModel } from "../../presenters/ModelPresenter";

export interface ModelCompatibilityPanelProps {
  readonly compatibility?: ModelCompatibilityViewModel;
  readonly title?: string;
  readonly emptyMessage?: string;
}

export default function ModelCompatibilityPanel({
  compatibility,
  title = "Compatibility",
  emptyMessage = "Run a compatibility check to view results.",
}: ModelCompatibilityPanelProps): JSX.Element {
  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">{title}</div>
          <div className="ui-panel__subtitle">
            Current compatibility verdict and supporting reasons.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        {!compatibility ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--sm">
            <div className="ui-row ui-row--wrap">
              <span
                className={`ui-badge ${
                  compatibility.isCompatible ? "ui-badge--success" : "ui-badge--danger"
                }`}
              >
                {compatibility.severity}
              </span>
              <span className="ui-text-secondary">
                {compatibility.isCompatible ? "Compatible" : "Not compatible"}
              </span>
            </div>

            {compatibility.reasons.length > 0 ? (
              compatibility.reasons.map((reason, index) => (
                <div key={`${reason.code}-${index}`} className="ui-card">
                  <div className="ui-card__body ui-stack ui-stack--xs">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <span className="ui-badge ui-badge--neutral">{reason.code}</span>
                      <span
                        className={`ui-badge ${
                          reason.severity === "Incompatible"
                            ? "ui-badge--danger"
                            : reason.severity === "Warning"
                              ? "ui-badge--warning"
                              : "ui-badge--info"
                        }`}
                      >
                        {reason.severity}
                      </span>
                    </div>
                    <div className="ui-text-secondary ui-text-small">{reason.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="ui-empty-state">
                <p className="ui-text-secondary">No compatibility reasons were returned.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
