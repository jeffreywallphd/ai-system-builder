import { useMemo, useState } from "react";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { PipelineStageIds, type PipelineStageId } from "../../../domain/dataset-studio/PipelineStageDomain";
import {
  UnifiedPreparationStageActivationModes,
  type UnifiedPreparationStageActivation,
} from "../../../domain/dataset-studio/UnifiedPreparationAsset";
import type {
  DataStudioWizardSnapshot,
  DataStudioWizardStageSnapshot,
} from "../../../application/data-studio/DataStudioPreparationWizard";
import { DataStudioWizardPresentationModes } from "../../../application/data-studio/DataStudioPreparationWizard";
import type { WizardStageStatus } from "../../studio-shell/wizard/WizardStageContracts";
import { DataStudioPreparationWizardStateAdapter } from "../../studio-shell/data/DataStudioPreparationWizardStateAdapter";
import StageWizardProgressNavigator from "../wizard/StageWizardProgressNavigator";

export interface DataStudioPreparationWizardPanelProps {
  readonly adapter?: DataStudioPreparationWizardStateAdapter;
  readonly onSnapshotChange?: (snapshot: DataStudioWizardSnapshot) => void;
}

function stageStatusLabel(status: WizardStageStatus): string {
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

function sourceStageRenderer(
  stage: DataStudioWizardStageSnapshot,
  onOptionsChange: (stageId: PipelineStageId, options: Readonly<Record<string, CanonicalRecordValue>>) => void,
): JSX.Element {
  const sourceReference = typeof stage.options.sourceReference === "string" ? stage.options.sourceReference : "";
  const sourceKind = typeof stage.options.sourceKind === "string" ? stage.options.sourceKind : "auto";
  return (
    <section className="ui-stack ui-stack--xs">
      <strong>Source Selection</strong>
      <label className="ui-field">
        <span className="ui-field__label">Source kind</span>
        <select
          className="ui-select"
          value={sourceKind}
          onChange={(event) => onOptionsChange(stage.stageId, Object.freeze({
            ...stage.options,
            sourceKind: event.currentTarget.value,
          }))}
        >
          <option value="auto">auto</option>
          <option value="csv">csv</option>
          <option value="json">json</option>
          <option value="document">document</option>
          <option value="image">image</option>
        </select>
      </label>
      <label className="ui-field">
        <span className="ui-field__label">Source reference</span>
        <input
          className="ui-input"
          value={sourceReference}
          placeholder="in-memory://source or C:\\data\\source.csv"
          onChange={(event) => onOptionsChange(stage.stageId, Object.freeze({
            ...stage.options,
            sourceReference: event.currentTarget.value,
          }))}
        />
      </label>
    </section>
  );
}

function ingestionStageRenderer(
  stage: DataStudioWizardStageSnapshot,
  onOptionsChange: (stageId: PipelineStageId, options: Readonly<Record<string, CanonicalRecordValue>>) => void,
): JSX.Element {
  const outputTarget = typeof stage.options.outputTarget === "string" ? stage.options.outputTarget : "records";
  return (
    <section className="ui-stack ui-stack--xs">
      <strong>Unified Ingestion</strong>
      <label className="ui-field">
        <span className="ui-field__label">Output target</span>
        <select
          className="ui-select"
          value={outputTarget}
          onChange={(event) => onOptionsChange(stage.stageId, Object.freeze({
            ...stage.options,
            outputTarget: event.currentTarget.value,
          }))}
        >
          <option value="records">records</option>
          <option value="text-items">text-items</option>
          <option value="image-metadata-records">image-metadata-records</option>
        </select>
      </label>
      <span className="ui-subtle">Route override, detection tuning, and advanced mapping editors can layer on this stage.</span>
    </section>
  );
}

function preparedStorageRenderer(
  stage: DataStudioWizardStageSnapshot,
  onOptionsChange: (stageId: PipelineStageId, options: Readonly<Record<string, CanonicalRecordValue>>) => void,
): JSX.Element {
  const destination = typeof stage.options.destination === "string" ? stage.options.destination : "";
  return (
    <section className="ui-stack ui-stack--xs">
      <strong>Prepared Storage</strong>
      <label className="ui-field">
        <span className="ui-field__label">Destination</span>
        <input
          className="ui-input"
          value={destination}
          placeholder="prepared://dataset"
          onChange={(event) => onOptionsChange(stage.stageId, Object.freeze({
            ...stage.options,
            destination: event.currentTarget.value,
          }))}
        />
      </label>
    </section>
  );
}

function defaultRenderer(stage: DataStudioWizardStageSnapshot): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" data-testid="data-studio-wizard-stage-default-renderer">
      <strong>{stage.title}</strong>
      <span className="ui-subtle">{stage.description}</span>
      <div className="ui-meta-grid">
        <div className="ui-meta-item">
          <div className="ui-meta-label">Status</div>
          <div className="ui-meta-value">{stageStatusLabel(stage.status)}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Visibility</div>
          <div className="ui-meta-value">{stage.visibility}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Config mode</div>
          <div className="ui-meta-value">{stage.configMode}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Activation</div>
          <div className="ui-meta-value">{stage.activation.mode}</div>
        </div>
      </div>
    </section>
  );
}

function toActivation(
  mode: string,
  conditionId: string,
): UnifiedPreparationStageActivation {
  if (mode === UnifiedPreparationStageActivationModes.conditional) {
    return Object.freeze({
      mode: UnifiedPreparationStageActivationModes.conditional,
      conditionId: conditionId.trim() || "stage-condition",
    });
  }
  if (mode === UnifiedPreparationStageActivationModes.disabled) {
    return Object.freeze({
      mode: UnifiedPreparationStageActivationModes.disabled,
    });
  }
  return Object.freeze({
    mode: UnifiedPreparationStageActivationModes.always,
  });
}

export default function DataStudioPreparationWizardPanel(props: DataStudioPreparationWizardPanelProps): JSX.Element {
  const localAdapter = useMemo(
    () => new DataStudioPreparationWizardStateAdapter(),
    [],
  );
  const adapter = props.adapter ?? localAdapter;
  const [snapshot, setSnapshot] = useState<DataStudioWizardSnapshot>(() => adapter.getSnapshot());
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [activationConditionDraft, setActivationConditionDraft] = useState<string>("");
  const [updateError, setUpdateError] = useState<string | undefined>(undefined);

  const currentStage = snapshot.stages.find((stage) => stage.stageId === snapshot.currentStageId);
  const paletteTerm = paletteSearch.trim().toLowerCase();
  const paletteStages = snapshot.stages.filter((stage) => {
    if (!paletteTerm) {
      return true;
    }
    return `${stage.title} ${stage.description} ${stage.stageId}`.toLowerCase().includes(paletteTerm);
  });
  const handoff = adapter.toCanvasHandoff();

  const refreshSnapshot = () => {
    const next = adapter.getSnapshot();
    setSnapshot(next);
    props.onSnapshotChange?.(next);
  };

  const applyResult = (
    result: { readonly ok: boolean; readonly issues: ReadonlyArray<{ readonly message: string }> },
  ) => {
    if (!result.ok) {
      setUpdateError(result.issues[0]?.message ?? "Unable to apply update.");
      return;
    }
    setUpdateError(undefined);
    refreshSnapshot();
  };

  const applyStageOptions = (
    stageId: PipelineStageId,
    options: Readonly<Record<string, CanonicalRecordValue>>,
  ) => {
    const result = adapter.setStageOptions(stageId, options);
    applyResult(result);
  };

  const renderCurrentStage = (): JSX.Element => {
    if (!currentStage) {
      return <span className="ui-subtle">No active stage.</span>;
    }
    if (currentStage.stageId === PipelineStageIds.SourceSelection) {
      return sourceStageRenderer(currentStage, applyStageOptions);
    }
    if (currentStage.stageId === PipelineStageIds.UnifiedIngestion) {
      return ingestionStageRenderer(currentStage, applyStageOptions);
    }
    if (currentStage.stageId === PipelineStageIds.StoragePrepared) {
      return preparedStorageRenderer(currentStage, applyStageOptions);
    }
    return defaultRenderer(currentStage);
  };

  return (
    <section className="ui-card ui-card--padded ui-stage-wizard ui-stack ui-stack--md" data-testid="data-studio-preparation-wizard-panel">
      <header className="ui-stack ui-stack--2xs">
        <h3>Data Studio Preparation Wizard</h3>
        <span className="ui-subtle">Stage-oriented authoring over the unified preparation asset graph.</span>
        <span className="ui-subtle">Progress: {snapshot.progressPercent}%</span>
      </header>

      <div className="ui-row ui-row--wrap">
        <button
          type="button"
          className={`ui-button ui-button--sm ${snapshot.presentationMode === DataStudioWizardPresentationModes.simple ? "ui-button--primary" : "ui-button--ghost"}`}
          onClick={() => {
            adapter.setSimpleMode();
            refreshSnapshot();
          }}
        >
          Simple Flow
        </button>
        <button
          type="button"
          className={`ui-button ui-button--sm ${snapshot.presentationMode === DataStudioWizardPresentationModes.advanced ? "ui-button--primary" : "ui-button--ghost"}`}
          onClick={() => {
            adapter.setAdvancedMode();
            refreshSnapshot();
          }}
        >
          Advanced Flow
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={() => setIsPaletteOpen((current) => !current)}
        >
          {isPaletteOpen ? "Hide Nodes" : "Show Nodes"}
        </button>
      </div>

      <div className="ui-stage-wizard__layout">
        <StageWizardProgressNavigator
          title="Data Studio wizard"
          steps={snapshot.stages.map((stage) => ({
            id: stage.stageId,
            name: stage.title,
            description: stage.description,
            order: stage.order,
            status: stage.status,
            isDisabled: !stage.availability.isAvailable,
          }))}
        />

        <section className="ui-stage-wizard__panel ui-stack ui-stack--sm">
          {currentStage ? (
            <>
              <header className="ui-stack ui-stack--2xs">
                <h4>{currentStage.title}</h4>
                <span className="ui-subtle">{currentStage.description}</span>
                <span className="ui-subtle">
                  Stage {currentStage.order} of {snapshot.stages.length} | Status: {stageStatusLabel(currentStage.status)}
                </span>
              </header>

              {renderCurrentStage()}

              <section className="ui-card ui-card--padded ui-stack ui-stack--xs">
                <strong>Stage controls</strong>
                {currentStage.isOptional ? (
                  <>
                    <label className="ui-field">
                      <span className="ui-field__label">Activation</span>
                      <select
                        className="ui-select"
                        value={currentStage.activation.mode}
                        onChange={(event) => {
                          const result = adapter.setStageActivation(
                            currentStage.stageId,
                            toActivation(event.currentTarget.value, activationConditionDraft),
                          );
                          applyResult(result);
                        }}
                      >
                        <option value={UnifiedPreparationStageActivationModes.always}>always</option>
                        <option value={UnifiedPreparationStageActivationModes.conditional}>conditional</option>
                        <option value={UnifiedPreparationStageActivationModes.disabled}>disabled</option>
                      </select>
                    </label>
                    {currentStage.activation.mode === UnifiedPreparationStageActivationModes.conditional ? (
                      <label className="ui-field">
                        <span className="ui-field__label">Condition id</span>
                        <input
                          className="ui-input"
                          value={activationConditionDraft || currentStage.activation.conditionId || ""}
                          onChange={(event) => setActivationConditionDraft(event.currentTarget.value)}
                          onBlur={() => {
                            const result = adapter.setStageActivation(
                              currentStage.stageId,
                              toActivation(
                                UnifiedPreparationStageActivationModes.conditional,
                                activationConditionDraft || currentStage.activation.conditionId || "",
                              ),
                            );
                            applyResult(result);
                          }}
                        />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <span className="ui-subtle">Required stage. Activation controls are disabled.</span>
                )}
                <label className="ui-field">
                  <span className="ui-field__label">Visibility</span>
                  <select
                    className="ui-select"
                    value={currentStage.visibility}
                    onChange={(event) => {
                      const result = adapter.setStageVisibility(
                        currentStage.stageId,
                        event.currentTarget.value as "simple" | "advanced",
                      );
                      applyResult(result);
                    }}
                  >
                    <option value="simple">simple</option>
                    <option value="advanced">advanced</option>
                  </select>
                </label>
              </section>
            </>
          ) : (
            <span className="ui-subtle">No active stage.</span>
          )}

          {updateError ? (
            <p className="ui-text-small ui-text-danger" data-testid="data-studio-wizard-update-error">{updateError}</p>
          ) : null}

          <footer className="ui-row ui-row--between ui-row--wrap">
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() => {
                adapter.goBack();
                refreshSnapshot();
              }}
              disabled={!snapshot.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary"
              onClick={() => {
                adapter.goNext();
                refreshSnapshot();
              }}
              disabled={!snapshot.canGoNext}
            >
              Next
            </button>
          </footer>
        </section>
      </div>

      {isPaletteOpen ? (
        <aside className="ui-workflow-studio-canvas__drawer-overlay ui-workflow-studio-canvas__drawer-overlay--left" data-testid="data-studio-node-palette-drawer">
          <section className="ui-workflow-canvas-drawer-panel ui-stack ui-stack--sm">
            <header className="ui-workflow-canvas-drawer-panel__header ui-stack ui-stack--2xs">
              <div className="ui-stack ui-stack--3xs">
                <strong>Asset Nodes</strong>
                <span className="ui-text-small ui-text-secondary">Stage-aware node palette for Data Studio assets.</span>
              </div>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => setIsPaletteOpen(false)}
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
                  value={paletteSearch}
                  onChange={(event) => setPaletteSearch(event.currentTarget.value)}
                  placeholder="Search source, ingestion, normalization..."
                />
              </label>
              <div className="ui-workflow-canvas-drawer__sections ui-scrollbar">
                {paletteStages.map((stage) => (
                  <article key={stage.stageId} className="ui-workflow-canvas-palette-option ui-stack ui-stack--2xs">
                    <div className="ui-text-small">
                      <strong>{stage.title}</strong>
                    </div>
                    <div className="ui-text-small ui-text-secondary">{stage.description}</div>
                    <div className="ui-text-small ui-text-secondary">
                      Groups: {stage.assetGroupIds.join(", ") || "-"}
                    </div>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={!stage.availability.isAvailable}
                      onClick={() => {
                        adapter.goToStage(stage.stageId);
                        refreshSnapshot();
                      }}
                    >
                      Focus Stage
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </aside>
      ) : null}

      <details className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <summary className="ui-text-small">Wizard to Canvas handoff</summary>
        <span className="ui-text-small ui-text-secondary">Current stage: {handoff.currentStageId}</span>
        <span className="ui-text-small ui-text-secondary">
          Graph nodes: {handoff.authoringGraph.nodes.length} | edges: {handoff.authoringGraph.edges.length}
        </span>
      </details>
    </section>
  );
}

