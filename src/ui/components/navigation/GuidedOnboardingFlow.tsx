import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GuidedOnboardingFlow, type OnboardingStep } from "../../routes/GuidedOnboardingFlow";

export interface GuidedOnboardingFlowProps {
  readonly pathname: string;
}

export default function GuidedOnboardingFlowSurface({ pathname }: GuidedOnboardingFlowProps): JSX.Element | null {
  const navigate = useNavigate();
  const onboarding = useMemo(() => new GuidedOnboardingFlow(), []);
  const initialState = useMemo(() => onboarding.resolveState({ pathname }), [onboarding, pathname]);
  const [stepIndex, setStepIndex] = useState(initialState.currentStepIndex);
  const [dismissed, setDismissed] = useState(!initialState.isVisible);

  if (dismissed || !initialState.isVisible) {
    return null;
  }

  const step = initialState.steps[Math.min(stepIndex, initialState.steps.length - 1)] as OnboardingStep;
  const isLastStep = stepIndex >= initialState.steps.length - 1;

  const onPrimaryAction = (): void => {
    const launch = onboarding.toLaunchAction(step);
    void navigate(launch.launchPath);
    if (isLastStep) {
      onboarding.complete();
      setDismissed(true);
      return;
    }
    setStepIndex((value) => value + 1);
  };

  const onSkip = (): void => {
    onboarding.dismiss();
    setDismissed(true);
  };

  return (
    <section className="ui-card" data-testid="guided-onboarding-flow">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between", gap: "var(--space-sm)" }}>
          <span className="ui-badge">Getting started</span>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={onSkip}>Skip</button>
        </div>
        <div className="ui-stack ui-stack--2xs">
          <h2 style={{ margin: 0 }}>{step.title}</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>{step.description}</p>
          <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
            Step {stepIndex + 1} of {initialState.steps.length}
          </p>
        </div>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={onPrimaryAction}>{step.actionLabel}</button>
          {!isLastStep ? (
            <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => setStepIndex((value) => Math.min(value + 1, initialState.steps.length - 1))}>
              Next tip
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
