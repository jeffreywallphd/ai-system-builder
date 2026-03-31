import type { DatasetStageWizardStageStatus } from "../../studio-shell/dataset/DatasetStageWizardStateAdapter";

export interface StageWizardProgressStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly status: DatasetStageWizardStageStatus;
  readonly isDisabled: boolean;
}

export interface StageWizardProgressNavigatorProps {
  readonly title: string;
  readonly steps: ReadonlyArray<StageWizardProgressStep>;
}

function toStatusLabel(status: DatasetStageWizardStageStatus): string {
  switch (status) {
    case "current":
      return "Current";
    case "completed":
      return "Completed";
    case "skipped":
      return "Skipped";
    case "disabled":
      return "Unavailable";
    default:
      return "Pending";
  }
}

export default function StageWizardProgressNavigator(props: StageWizardProgressNavigatorProps): JSX.Element {
  return (
    <nav aria-label={`${props.title} progress`} className="ui-stage-wizard__nav ui-stack ui-stack--xs" data-testid="stage-wizard-progress-nav">
      {props.steps.map((step) => (
        <div
          key={step.id}
          className={`ui-stage-wizard__step ui-stage-wizard__step--${step.status}`}
          aria-current={step.status === "current" ? "step" : undefined}
          aria-disabled={step.isDisabled}
        >
          <span className="ui-stage-wizard__step-index">{step.order}</span>
          <span className="ui-stage-wizard__step-copy">
            <strong>{step.name}</strong>
            <span className="ui-text-secondary ui-text-small">{step.description}</span>
          </span>
          <span className="ui-stage-wizard__step-status ui-text-small">{toStatusLabel(step.status)}</span>
        </div>
      ))}
    </nav>
  );
}
