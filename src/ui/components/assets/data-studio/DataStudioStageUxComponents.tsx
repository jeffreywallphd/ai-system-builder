import type { PipelineStageId } from "../../../../src/domain/dataset-studio/PipelineStageDomain";
import type {
  DataStudioWizardFieldSnapshot,
  DataStudioWizardStageSnapshot,
} from "../../../../application/data-studio/DataStudioPreparationWizard";
import type { DataStudioStageInternalsSnapshot } from "../../../studio-shell/data/DataStudioPreparationWizardStateAdapter";

export interface DataStudioStageMetadataPanelProps {
  readonly stage: DataStudioWizardStageSnapshot;
  readonly totalStages: number;
}

export interface DataStudioAdvancedEditingActionsProps {
  readonly stageId: PipelineStageId;
  readonly stageTitle: string;
  readonly mode: "wizard" | "canvas";
  readonly onInspectInternals: (stageId: PipelineStageId) => void;
  readonly onEditInCanvas: (stageId: PipelineStageId) => void;
}

export interface DataStudioStageInternalsPanelProps {
  readonly internals?: DataStudioStageInternalsSnapshot;
}

export interface DataStudioNodePaletteDrawerProps {
  readonly isOpen: boolean;
  readonly searchValue: string;
  readonly stages: ReadonlyArray<DataStudioWizardStageSnapshot>;
  readonly onClose: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onFocusStage: (stageId: PipelineStageId) => void;
  readonly onInspectStage: (stageId: PipelineStageId) => void;
}

export function stageStatusLabel(status: DataStudioWizardStageSnapshot["status"]): string {
  if (status === "disabled") {
    return "Disabled";
  }
  if (status === "skipped") {
    return "Skipped";
  }
  if (status === "completed") {
    return "Completed";
  }
  if (status === "current") {
    return "Current";
  }
  return "Pending";
}

function stageStatusBadgeClassName(status: DataStudioWizardStageSnapshot["status"]): string {
  if (status === "completed") {
    return "ui-badge ui-badge--success";
  }
  if (status === "current") {
    return "ui-badge ui-badge--info";
  }
  if (status === "disabled") {
    return "ui-badge ui-badge--warning";
  }
  return "ui-badge ui-badge--neutral";
}

function summarizeFieldVisibility(fields: ReadonlyArray<DataStudioWizardFieldSnapshot>): string {
  const visibleCount = fields.filter((field) => field.isVisible).length;
  if (visibleCount === fields.length) {
    return `${visibleCount} visible`;
  }
  return `${visibleCount}/${fields.length} visible`;
}

export function DataStudioStageMetadataPanel(props: DataStudioStageMetadataPanelProps): JSX.Element {
  const { stage, totalStages } = props;
  return (
    <header className="ui-stack ui-stack--2xs" data-testid="data-studio-stage-metadata-panel">
      <div className="ui-row ui-row--between ui-row--wrap">
        <h4>{stage.title}</h4>
        <span className={stageStatusBadgeClassName(stage.status)}>{stageStatusLabel(stage.status)}</span>
      </div>
      <span className="ui-subtle">{stage.description}</span>
      <div className="ui-row ui-row--wrap">
        <span className="ui-badge ui-badge--neutral">Stage {stage.order} / {totalStages}</span>
        <span className="ui-badge ui-badge--neutral">Visibility: {stage.visibility}</span>
        <span className="ui-badge ui-badge--neutral">Fields: {summarizeFieldVisibility(stage.fields)}</span>
      </div>
    </header>
  );
}

export function DataStudioAdvancedEditingActions(props: DataStudioAdvancedEditingActionsProps): JSX.Element {
  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="data-studio-advanced-editing-actions">
      <strong>Advanced tools</strong>
      <span className="ui-text-small ui-text-secondary">
        Use optional technical tools for this stage, or continue editing in canvas mode.
      </span>
      <div className="ui-row ui-row--wrap">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          data-testid="data-studio-inspect-internals"
          onClick={() => props.onInspectInternals(props.stageId)}
        >
          Inspect technical details
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          data-testid="data-studio-edit-in-canvas"
          onClick={() => props.onEditInCanvas(props.stageId)}
        >
          {props.mode === "canvas" ? "Focus in Canvas" : "Edit in Canvas"}
        </button>
      </div>
      <span className="ui-text-small ui-text-secondary">
        Stage target: {props.stageTitle}
      </span>
    </section>
  );
}

function renderRecord(value: Readonly<Record<string, unknown>>): string {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return "{}";
  }
  return JSON.stringify(value, null, 2);
}

export function DataStudioStageInternalsPanel(props: DataStudioStageInternalsPanelProps): JSX.Element {
  if (!props.internals) {
    return (
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="data-studio-stage-internals-panel">
        <strong>Technical details</strong>
        <span className="ui-subtle">Choose a stage and click Inspect technical details to view graph-level details.</span>
      </section>
    );
  }

  const { internals } = props;
  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="data-studio-stage-internals-panel">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Technical details: {internals.stageTitle}</strong>
        <span className="ui-badge ui-badge--neutral">{stageStatusLabel(internals.status)}</span>
      </div>
      <div className="ui-meta-grid">
        <div className="ui-meta-item">
          <div className="ui-meta-label">Graph nodes</div>
          <div className="ui-meta-value">{internals.nodeIds.length}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Incoming edges</div>
          <div className="ui-meta-value">{internals.incomingEdgeIds.length}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Outgoing edges</div>
          <div className="ui-meta-value">{internals.outgoingEdgeIds.length}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Asset groups</div>
          <div className="ui-meta-value">{internals.assetGroupIds.join(", ") || "-"}</div>
        </div>
      </div>
      <details className="ui-stack ui-stack--2xs">
        <summary className="ui-text-small">Stage options (canonical)</summary>
        <pre className="ui-text-small ui-text-mono">{renderRecord(internals.options)}</pre>
      </details>
      <details className="ui-stack ui-stack--2xs">
        <summary className="ui-text-small">Graph references</summary>
        <div className="ui-stack ui-stack--3xs ui-text-small ui-text-secondary">
          <span>Nodes: {internals.nodeIds.join(", ") || "none"}</span>
          <span>Incoming: {internals.incomingEdgeIds.join(", ") || "none"}</span>
          <span>Outgoing: {internals.outgoingEdgeIds.join(", ") || "none"}</span>
        </div>
      </details>
    </section>
  );
}

export function DataStudioNodePaletteDrawer(props: DataStudioNodePaletteDrawerProps): JSX.Element | null {
  if (!props.isOpen) {
    return null;
  }

  return (
    <aside className="ui-workflow-studio-canvas__drawer-overlay ui-workflow-studio-canvas__drawer-overlay--left" data-testid="data-studio-node-palette-drawer">
      <section className="ui-workflow-canvas-drawer-panel ui-stack ui-stack--sm">
        <header className="ui-workflow-canvas-drawer-panel__header ui-stack ui-stack--2xs">
          <div className="ui-stack ui-stack--3xs">
            <strong>Pipeline stages</strong>
            <span className="ui-text-small ui-text-secondary">Browse and jump to stages in your data flow.</span>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={props.onClose}
          >
            Close
          </button>
        </header>
        <div className="ui-workflow-canvas-drawer-panel__body ui-stack ui-stack--sm">
          <label className="ui-field">
            <span className="ui-field__label">Search stages</span>
            <input
              className="ui-input"
              type="search"
              value={props.searchValue}
              onChange={(event) => props.onSearchChange(event.currentTarget.value)}
              placeholder="Search source, ingestion, normalization..."
            />
          </label>
          <div className="ui-workflow-canvas-drawer__sections ui-scrollbar">
            {props.stages.map((stage) => (
              <article key={stage.stageId} className="ui-workflow-canvas-palette-option ui-stack ui-stack--2xs">
                <div className="ui-text-small ui-row ui-row--between ui-row--wrap">
                  <strong>{stage.title}</strong>
                  <span className={stageStatusBadgeClassName(stage.status)}>{stageStatusLabel(stage.status)}</span>
                </div>
                <div className="ui-text-small ui-text-secondary">{stage.description}</div>
                <div className="ui-text-small ui-text-secondary">
                  Groups: {stage.assetGroupIds.join(", ") || "-"}
                </div>
                <div className="ui-row ui-row--wrap">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={!stage.availability.isAvailable}
                    onClick={() => props.onFocusStage(stage.stageId)}
                  >
                    Focus stage
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => props.onInspectStage(stage.stageId)}
                  >
                    Inspect technical details
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
