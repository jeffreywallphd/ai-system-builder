interface WizardSectionProps {
  readonly sectionId: string;
  readonly children: JSX.Element | ReadonlyArray<JSX.Element>;
  readonly validationState?: "none" | "warning" | "error";
  readonly isCollapsed?: boolean;
}

export default function WizardSection({
  sectionId,
  children,
  validationState = "none",
  isCollapsed = false,
}: WizardSectionProps): JSX.Element {
  return (
    <section
      id={sectionId}
      className="ui-card ui-card--padded ui-stack ui-stack--xs"
      data-testid={`workflow-studio-wizard-section-${sectionId}`}
      data-validation-state={validationState}
      data-collapsed={isCollapsed}
    >
      {children}
    </section>
  );
}
