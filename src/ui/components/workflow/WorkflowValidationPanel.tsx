import type { ValidationSummaryViewModel } from "../../presenters/ValidationPresenter";

export interface WorkflowValidationPanelProps {
  readonly validation: ValidationSummaryViewModel;
}

export default function WorkflowValidationPanel({
  validation,
}: WorkflowValidationPanelProps): JSX.Element {
  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Validation</div>
          <div className="ui-panel__subtitle">
            Review workflow errors, warnings, and informational messages.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        <div className="ui-stack ui-stack--md">
          <div className="ui-row ui-row--wrap">
            <span
              className={`ui-badge ${
                validation.isValid ? "ui-badge--success" : "ui-badge--danger"
              }`}
            >
              {validation.isValid ? "Valid" : "Invalid"}
            </span>

            {validation.badges.map((badge) => (
              <span
                key={badge.severity}
                className={`ui-badge ${
                  badge.severity === "error"
                    ? "ui-badge--danger"
                    : badge.severity === "warning"
                    ? "ui-badge--warning"
                    : "ui-badge--info"
                }`}
              >
                {badge.label}: {badge.count}
              </span>
            ))}
          </div>

          {validation.groups.length === 0 ? (
            <div className="ui-empty-state">
              <p className="ui-text-secondary">
                No validation messages are currently present.
              </p>
            </div>
          ) : (
            <div className="ui-stack ui-stack--sm">
              {validation.groups.map((group) => (
                <div key={group.scope} className="ui-card">
                  <div className="ui-card__body ui-stack ui-stack--sm">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <div className="ui-heading-4">{group.scope}</div>
                      <span className="ui-badge ui-badge--neutral">{group.count}</span>
                    </div>

                    <div className="ui-stack ui-stack--xs">
                      {group.messages.map((message) => (
                        <div key={`${message.code}-${message.message}`} className="ui-card">
                          <div className="ui-card__body ui-stack ui-stack--xs">
                            <div className="ui-row ui-row--between ui-row--wrap">
                              <div className="ui-row ui-row--wrap">
                                <span
                                  className={`ui-badge ${
                                    message.severity === "error"
                                      ? "ui-badge--danger"
                                      : message.severity === "warning"
                                      ? "ui-badge--warning"
                                      : "ui-badge--info"
                                  }`}
                                >
                                  {message.severity}
                                </span>
                                <span className="ui-badge ui-badge--neutral">
                                  {message.code}
                                </span>
                              </div>

                              {message.targetLabel ? (
                                <span className="ui-text-small ui-subtle">
                                  {message.targetLabel}
                                </span>
                              ) : null}
                            </div>

                            <div className="ui-text-secondary">{message.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
