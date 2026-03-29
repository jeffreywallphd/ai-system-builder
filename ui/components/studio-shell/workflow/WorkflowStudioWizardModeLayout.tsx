interface WorkflowStudioWizardModeLayoutProps {
  readonly children: JSX.Element;
}

export default function WorkflowStudioWizardModeLayout({
  children,
}: WorkflowStudioWizardModeLayoutProps): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-wizard-mode-layout">
      <header className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <strong>Wizard layout container</strong>
        <p className="ui-text-muted">
          Mode-specific Wizard layout boundary over shared Workflow Studio scaffolding and draft state.
        </p>
      </header>
      {children}
    </section>
  );
}
