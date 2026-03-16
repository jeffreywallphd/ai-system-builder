export interface WorkflowCanvasToolbarProps {
  readonly hasSelection?: boolean;
  readonly canFitView?: boolean;
  readonly onFitView?: () => void;
  readonly onClearSelection?: () => void;
  readonly onValidateWorkflow?: () => void;
}

export default function WorkflowCanvasToolbar({
  hasSelection,
  canFitView = true,
  onFitView,
  onClearSelection,
  onValidateWorkflow,
}: WorkflowCanvasToolbarProps): JSX.Element {
  return (
    <section className="ui-toolbar ui-toolbar--panel">
      <div className="ui-toolbar__group">
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => onFitView?.()}
          disabled={!canFitView}
        >
          Fit View
        </button>

        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => onValidateWorkflow?.()}
        >
          Validate
        </button>
      </div>

      <div className="ui-toolbar__group">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={() => onClearSelection?.()}
          disabled={!hasSelection}
        >
          Clear Selection
        </button>
      </div>
    </section>
  );
}
