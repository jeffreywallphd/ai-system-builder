interface WorkflowStudioWizardModeLayoutProps {
  readonly children: JSX.Element;
}

export default function WorkflowStudioWizardModeLayout({
  children,
}: WorkflowStudioWizardModeLayoutProps): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-wizard-mode-layout">
      {children}
    </section>
  );
}
