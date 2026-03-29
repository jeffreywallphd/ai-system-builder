interface WorkflowStudioWizardModeLayoutProps {
  readonly children: JSX.Element;
}

export default function WorkflowStudioWizardModeLayout({
  children,
}: WorkflowStudioWizardModeLayoutProps): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-wizard-mode-layout">
      <header className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <strong>Workflow wizard layout</strong>
        <p className="ui-text-muted">
          Structured wizard sections over the shared canonical workflow draft state.
        </p>
      </header>
      {children}
    </section>
  );
}
