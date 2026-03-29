interface WorkflowStudioCanvasModeLayoutProps {
  readonly children: JSX.Element;
}

export default function WorkflowStudioCanvasModeLayout({
  children,
}: WorkflowStudioCanvasModeLayoutProps): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-canvas-mode-layout">
      <header className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <strong>Canvas layout container</strong>
        <p className="ui-text-muted">
          Mode-specific Canvas layout boundary over shared Workflow Studio scaffolding and draft state.
        </p>
      </header>
      {children}
    </section>
  );
}
