interface WorkflowStudioCanvasModeLayoutProps {
  readonly children: JSX.Element;
}

export default function WorkflowStudioCanvasModeLayout({
  children,
}: WorkflowStudioCanvasModeLayoutProps): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-canvas-mode-layout">
      {children}
    </section>
  );
}
