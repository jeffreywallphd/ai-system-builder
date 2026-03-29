export interface WorkflowStudioCanvasModeSurfaceProps {
  readonly draftEditorContent: string;
  readonly onChangeDraftEditorContent: (nextContent: string) => void;
}

export default function WorkflowStudioCanvasModeSurface({
  draftEditorContent,
  onChangeDraftEditorContent,
}: WorkflowStudioCanvasModeSurfaceProps): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="workflow-studio-canvas-mode-surface">
      <div className="ui-text-small">Canvas mode (current Workflow Studio draft authoring)</div>
      <textarea
        className="ui-textarea"
        rows={8}
        value={draftEditorContent}
        onChange={(event) => onChangeDraftEditorContent(event.target.value)}
      />
    </div>
  );
}
