import type { WorkflowViewMode } from "../../state/WorkflowViewMode";

export interface WorkflowCanvasToolbarProps {
  readonly viewMode?: WorkflowViewMode;
  readonly isMobile?: boolean;
  readonly hasSelection?: boolean;
  readonly canOpenProperties?: boolean;
  readonly isCanvasLocked?: boolean;
  readonly canExecuteWorkflow?: boolean;
  readonly isExecutingWorkflow?: boolean;
  readonly isMenuOpen?: boolean;
  readonly isPropertiesOpen?: boolean;
  readonly canToggleOutput?: boolean;
  readonly isOutputOpen?: boolean;
  readonly onToggleCanvasLock?: () => void;
  readonly onExecuteWorkflow?: () => void;
  readonly onOpenMenu?: () => void;
  readonly onOpenProperties?: () => void;
  readonly onToggleOutput?: () => void;
  readonly onClearSelection?: () => void;
  readonly onValidateWorkflow?: () => void;
  readonly onViewModeChange?: (mode: WorkflowViewMode) => void;
}

export default function WorkflowCanvasToolbar({
  viewMode,
  isMobile,
  hasSelection,
  canOpenProperties,
  isCanvasLocked,
  canExecuteWorkflow,
  isExecutingWorkflow,
  isMenuOpen,
  isPropertiesOpen,
  canToggleOutput,
  isOutputOpen,
  onToggleCanvasLock,
  onExecuteWorkflow,
  onOpenMenu,
  onOpenProperties,
  onToggleOutput,
  onClearSelection,
  onValidateWorkflow,
  onViewModeChange,
}: WorkflowCanvasToolbarProps): JSX.Element {
  const lockButtonLabel = isCanvasLocked
    ? isMobile
      ? "Unlock"
      : "Unlock Canvas"
    : isMobile
      ? "Lock"
      : "Lock Canvas";

  return (
    <section className="ui-toolbar ui-toolbar--panel ui-workflow-toolbar">
      <div className="ui-toolbar__group">
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => onOpenMenu?.()}
        >
          {isMenuOpen ? "Close Menu" : "Menu"}
        </button>

        <button
          type="button"
          className={`ui-button ui-button--secondary ui-button--sm${
            isExecutingWorkflow ? " ui-button--loading" : ""
          }`}
          onClick={() => onExecuteWorkflow?.()}
          disabled={!canExecuteWorkflow || isExecutingWorkflow}
        >
          <span className="ui-button__label">
            {isExecutingWorkflow ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
            Execute
          </span>
        </button>

        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => onValidateWorkflow?.()}
          disabled={isExecutingWorkflow}
        >
          Validate
        </button>
      </div>

      <div className="ui-toolbar__group ui-toolbar__group--center">
        <div className="ui-button-group" role="group" aria-label="Workflow view mode">
          <button
            type="button"
            className={`ui-button ui-button--sm ${viewMode === "canvas" ? "ui-button--primary" : "ui-button--ghost"}`}
            onClick={() => onViewModeChange?.("canvas")}
          >
            Canvas
          </button>
          <button
            type="button"
            className={`ui-button ui-button--sm ${viewMode === "form" ? "ui-button--primary" : "ui-button--ghost"}`}
            onClick={() => onViewModeChange?.("form")}
          >
            Form
          </button>
        </div>

        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => onToggleCanvasLock?.()}
        >
          {lockButtonLabel}
        </button>
      </div>

      {!isMobile ? (
        <div className="ui-toolbar__group ui-toolbar__group--end">
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={() => onClearSelection?.()}
            disabled={!hasSelection}
          >
            Clear Selection
          </button>

          {viewMode === "canvas" ? (
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm ui-tablet-up-only"
              onClick={() => onToggleOutput?.()}
              disabled={!canToggleOutput}
            >
              {isOutputOpen ? "Hide Output" : "View Output"}
            </button>
          ) : null}

          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm ui-tablet-up-only"
            onClick={() => onOpenProperties?.()}
            disabled={!canOpenProperties}
          >
            {isPropertiesOpen ? "Close Properties" : "Properties"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
