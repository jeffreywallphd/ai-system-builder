import type { ReactNode } from "react";
import type { LinearWizardDefinition } from "@application/wizards/contracts";

export interface LinearWizardProps<StepId extends string = string> {
  readonly wizard: LinearWizardDefinition<StepId>;
  readonly title: string;
  readonly description?: string;
  readonly stepContent: ReactNode;
  readonly isBusy?: boolean;
  readonly isDisabled?: boolean;
  readonly onStepSelect?: (stepId: StepId) => void;
  readonly onBack?: () => void;
  readonly onNext?: () => void;
}

function getStepStatusLabel(status: LinearWizardDefinition<string>["steps"][number]["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "current":
      return "Current";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

export function LinearWizard<StepId extends string>(props: LinearWizardProps<StepId>): JSX.Element {
  const currentStep = props.wizard.steps.find((step) => step.id === props.wizard.currentStepId) ?? props.wizard.steps[0];

  return (
    <section className="ui-card ui-linear-wizard" data-testid="linear-wizard">
      <div className="ui-card__body ui-linear-wizard__shell">
        <header className="ui-linear-wizard__header ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-md)", alignItems: "flex-start" }}>
            <div className="ui-stack ui-stack--2xs">
              <h3>{props.title}</h3>
              {props.description ? <p className="ui-text-secondary">{props.description}</p> : null}
            </div>
            <div className="ui-stack ui-stack--2xs ui-linear-wizard__progress-meta">
              <strong>{props.wizard.progressPercent}% complete</strong>
              <span className="ui-text-secondary ui-text-small">
                Step {currentStep ? currentStep.sequence + 1 : 1} of {props.wizard.totalStepCount}
              </span>
            </div>
          </div>
          <div aria-hidden="true" className="ui-linear-wizard__progress-track">
            <div className="ui-linear-wizard__progress-fill" style={{ width: `${props.wizard.progressPercent}%` }} />
          </div>
        </header>

        <div className="ui-linear-wizard__body">
          <nav aria-label={`${props.title} steps`} className="ui-linear-wizard__steps ui-stack ui-stack--xs">
            {props.wizard.steps.map((step) => {
              const isDisabled = props.isDisabled || !props.onStepSelect || !step.isAccessible;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`ui-linear-wizard__step${step.isActive ? " is-active" : ""}${step.status === "completed" ? " is-completed" : ""}`}
                  disabled={isDisabled}
                  onClick={() => props.onStepSelect?.(step.id)}
                >
                  <span className="ui-linear-wizard__step-index">{step.sequence + 1}</span>
                  <span className="ui-linear-wizard__step-copy">
                    <strong>{step.title}</strong>
                    <span className="ui-text-secondary ui-text-small">{step.description}</span>
                  </span>
                  <span className="ui-linear-wizard__step-status ui-text-small">{getStepStatusLabel(step.status)}</span>
                </button>
              );
            })}
          </nav>

          <div className="ui-linear-wizard__panel ui-stack ui-stack--md">
            {currentStep ? (
              <div className="ui-linear-wizard__panel-header ui-stack ui-stack--2xs">
                <span className="ui-text-secondary ui-text-small">Current step</span>
                <h4>{currentStep.title}</h4>
                <p className="ui-text-secondary">{currentStep.description}</p>
              </div>
            ) : null}
            <div className="ui-linear-wizard__panel-content ui-stack ui-stack--md">{props.stepContent}</div>
          </div>
        </div>

        <footer className="ui-linear-wizard__footer ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            disabled={props.isDisabled || props.isBusy || !props.wizard.canGoBack || !props.onBack}
            onClick={props.onBack}
          >
            Back
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary"
            disabled={props.isDisabled || props.isBusy || !props.wizard.canGoNext || !props.onNext}
            onClick={props.onNext}
          >
            Next
          </button>
        </footer>
      </div>
    </section>
  );
}

export default LinearWizard;

