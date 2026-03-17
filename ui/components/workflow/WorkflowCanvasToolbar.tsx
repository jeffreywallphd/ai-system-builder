export interface WorkflowCanvasToolbarProps {
  readonly isMobile?: boolean;
  readonly hasSelection?: boolean;
  readonly canOpenProperties?: boolean;
  readonly isCanvasLocked?: boolean;
  readonly isMenuOpen?: boolean;
  readonly isPropertiesOpen?: boolean;
  readonly onToggleCanvasLock?: () => void;
  readonly onOpenMenu?: () => void;
  readonly onOpenProperties?: () => void;
  readonly onClearSelection?: () => void;
  readonly onValidateWorkflow?: () => void;
}

export default function WorkflowCanvasToolbar({
  isMobile,
  hasSelection,
  canOpenProperties,
  isCanvasLocked,
  isMenuOpen,
  isPropertiesOpen,
  onToggleCanvasLock,
  onOpenMenu,
  onOpenProperties,
  onClearSelection,
  onValidateWorkflow,
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
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => onValidateWorkflow?.()}
        >
          Validate
        </button>
      </div>

      <div className="ui-toolbar__group ui-toolbar__group--center">
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
