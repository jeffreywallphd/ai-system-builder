import { useMemo, useState } from "react";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import type { PipelineStageId } from "../../../domain/dataset-studio/PipelineStageDomain";
import {
  UnifiedPreparationStageActivationModes,
  type UnifiedPreparationStageActivation,
} from "../../../domain/dataset-studio/UnifiedPreparationAsset";
import type {
  DataStudioWizardFieldSnapshot,
  DataStudioWizardSnapshot,
  DataStudioWizardStageSnapshot,
} from "../../../application/data-studio/DataStudioPreparationWizard";
import { DataStudioWizardPresentationModes } from "../../../application/data-studio/DataStudioPreparationWizard";
import type { WizardStageStatus } from "../../studio-shell/wizard/WizardStageContracts";
import { DataStudioPreparationWizardStateAdapter } from "../../studio-shell/data/DataStudioPreparationWizardStateAdapter";
import StageWizardProgressNavigator from "../wizard/StageWizardProgressNavigator";
import DataStudioPreparationCanvasReactFlow from "./DataStudioPreparationCanvasReactFlow";

export interface DataStudioPreparationWizardPanelProps {
  readonly adapter?: DataStudioPreparationWizardStateAdapter;
  readonly onSnapshotChange?: (snapshot: DataStudioWizardSnapshot) => void;
}

const DataStudioWizardPersistenceStorageKey = "ai-loom.data-studio.preparation.state.v1";

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

function parseTextList(value: string): ReadonlyArray<string> {
  return Object.freeze(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function formatFieldValue(field: DataStudioWizardFieldSnapshot): string {
  if (Array.isArray(field.value)) {
    return field.value.join(", ");
  }
  if (typeof field.value === "number") {
    return String(field.value);
  }
  if (typeof field.value === "boolean") {
    return field.value ? "true" : "false";
  }
  if (typeof field.value === "string") {
    return field.value;
  }
  return "";
}

export default function DataStudioPreparationWizardPanel(props: DataStudioPreparationWizardPanelProps): JSX.Element {
  const localAdapter = useMemo(
    () => {
      if (typeof window === "undefined") {
        return new DataStudioPreparationWizardStateAdapter();
      }
      const persistedState = window.localStorage.getItem(DataStudioWizardPersistenceStorageKey) ?? undefined;
      return new DataStudioPreparationWizardStateAdapter({
        persistedState,
      });
    },
    [],
  );
  const adapter = props.adapter ?? localAdapter;
  const [snapshot, setSnapshot] = useState<DataStudioWizardSnapshot>(() => adapter.getSnapshot());
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [authoringMode, setAuthoringMode] = useState<"wizard" | "canvas">("wizard");
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string | undefined>(undefined);
  const [activationConditionDraft, setActivationConditionDraft] = useState<string>("");
  const [updateError, setUpdateError] = useState<string | undefined>(undefined);

  const currentStage = snapshot.stages.find((stage) => stage.stageId === snapshot.currentStageId);
  const templateOptions = adapter.listTemplates();
  const paletteTerm = paletteSearch.trim().toLowerCase();
  const paletteStages = snapshot.stages.filter((stage) => {
    if (!paletteTerm) {
      return true;
    }
    return `${stage.title} ${stage.description} ${stage.stageId}`.toLowerCase().includes(paletteTerm);
  });
  const handoff = adapter.toCanvasHandoff();
  const canvasProjection = adapter.toCanvasProjection();
  const selectedCanvasNode = selectedCanvasNodeId
    ? canvasProjection.graph.nodes.find((node) => node.id === selectedCanvasNodeId)
    : undefined;

  const refreshSnapshot = () => {
    const next = adapter.getSnapshot();
    setSnapshot(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DataStudioWizardPersistenceStorageKey, adapter.exportPipelineStateJson());
      } catch {
        // ignore persistence failures (storage unavailable/quota)
      }
    }
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

  const updateFieldValue = (
    stage: DataStudioWizardStageSnapshot,
    field: DataStudioWizardFieldSnapshot,
    value: CanonicalRecordValue,
  ) => {
    applyStageOptions(stage.stageId, Object.freeze({
      ...stage.options,
      [field.optionKey]: value,
    }));
  };

  const renderField = (stage: DataStudioWizardStageSnapshot, field: DataStudioWizardFieldSnapshot): JSX.Element => {
    if (!field.isVisible) {
      return (
        <div key={field.fieldId} className="ui-text-small ui-text-secondary">
          {field.label} hidden in this flow ({field.hiddenReason ?? "rule"}).
        </div>
      );
    }

    if (field.inputKind === "toggle") {
      return (
        <label key={field.fieldId} className="ui-field">
          <span className="ui-field__label">{field.label}</span>
          <input
            type="checkbox"
            checked={field.value === true}
            onChange={(event) => updateFieldValue(stage, field, event.currentTarget.checked)}
          />
          {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
        </label>
      );
    }

    if (field.inputKind === "select") {
      return (
        <label key={field.fieldId} className="ui-field">
          <span className="ui-field__label">{field.label}</span>
          <select
            className="ui-select"
            value={typeof field.value === "string" || typeof field.value === "number" ? String(field.value) : ""}
            onChange={(event) => updateFieldValue(stage, field, event.currentTarget.value)}
          >
            {(field.options ?? []).map((option) => (
              <option key={`${field.fieldId}-${option.value}`} value={String(option.value)}>{option.label}</option>
            ))}
          </select>
          {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
        </label>
      );
    }

    if (field.inputKind === "number") {
      return (
        <label key={field.fieldId} className="ui-field">
          <span className="ui-field__label">{field.label}</span>
          <input
            className="ui-input"
            type="number"
            value={formatFieldValue(field)}
            placeholder={field.placeholder}
            onChange={(event) => {
              const parsed = Number(event.currentTarget.value);
              updateFieldValue(stage, field, Number.isFinite(parsed) ? parsed : 0);
            }}
          />
          {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
        </label>
      );
    }

    const isList = field.optionKey.toLowerCase().includes("fields");
    return (
      <label key={field.fieldId} className="ui-field">
        <span className="ui-field__label">{field.label}</span>
        <input
          className="ui-input"
          value={formatFieldValue(field)}
          placeholder={field.placeholder}
          onChange={(event) => updateFieldValue(
            stage,
            field,
            isList ? parseTextList(event.currentTarget.value) : event.currentTarget.value,
          )}
        />
        {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
      </label>
    );
  };

  const renderCurrentStage = (): JSX.Element => {
    if (!currentStage) {
      return <span className="ui-subtle">No active stage.</span>;
    }

    const visibleFields = currentStage.fields.filter((field) => field.isVisible);
    if (visibleFields.length === 0) {
      return (
        <section className="ui-stack ui-stack--xs" data-testid="data-studio-wizard-stage-default-renderer">
          <strong>{currentStage.title}</strong>
          <span className="ui-subtle">No configurable fields in the current visibility mode.</span>
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <div className="ui-meta-label">Status</div>
              <div className="ui-meta-value">{stageStatusLabel(currentStage.status)}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Visibility</div>
              <div className="ui-meta-value">{currentStage.visibility}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Activation</div>
              <div className="ui-meta-value">{currentStage.activation.mode}</div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="ui-stack ui-stack--xs" data-testid="data-studio-wizard-stage-field-renderer">
        <strong>{currentStage.title} Configuration</strong>
        {visibleFields.map((field) => renderField(currentStage, field))}
      </section>
    );
  };

  return (
    <section className="ui-card ui-card--padded ui-stage-wizard ui-stack ui-stack--md" data-testid="data-studio-preparation-wizard-panel">
      <header className="ui-stack ui-stack--2xs">
        <h3>Data Studio Preparation Wizard</h3>
        <span className="ui-subtle">Intent-driven stage-oriented authoring over the unified preparation asset graph.</span>
        <span className="ui-subtle">Progress: {snapshot.progressPercent}%</span>
      </header>

      <label className="ui-field">
        <span className="ui-field__label">Pipeline template</span>
        <select
          className="ui-select"
          value={snapshot.template.id}
          onChange={(event) => {
            const result = adapter.selectTemplate(event.currentTarget.value);
            applyResult(result);
          }}
        >
          {templateOptions.map((template) => (
            <option key={template.id} value={template.id}>{template.name} ({template.intent})</option>
          ))}
        </select>
        <span className="ui-field__hint">{snapshot.template.description} (v{snapshot.template.version})</span>
      </label>

      <div className="ui-row ui-row--wrap">
        <button
          type="button"
          className={`ui-button ui-button--sm ${authoringMode === "wizard" ? "ui-button--primary" : "ui-button--ghost"}`}
          onClick={() => setAuthoringMode("wizard")}
          data-testid="data-studio-authoring-mode-wizard"
        >
          Wizard
        </button>
        <button
          type="button"
          className={`ui-button ui-button--sm ${authoringMode === "canvas" ? "ui-button--primary" : "ui-button--ghost"}`}
          onClick={() => setAuthoringMode("canvas")}
          data-testid="data-studio-authoring-mode-canvas"
        >
          Canvas
        </button>
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

      {authoringMode === "wizard" ? (
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
      ) : (
        <section className="ui-workflow-studio-canvas ui-stack ui-stack--sm" data-testid="data-studio-canvas-mode">
          <header className="ui-row ui-row--between ui-row--wrap">
            <strong>Data Studio Canvas</strong>
            <div className="ui-row ui-row--wrap">
              <span className="ui-badge ui-badge--neutral">Groups: {canvasProjection.graph.groups.length}</span>
              <span className="ui-badge ui-badge--neutral">Nodes: {canvasProjection.graph.nodes.length}</span>
              <span className="ui-badge ui-badge--neutral">Edges: {canvasProjection.graph.edges.length}</span>
            </div>
          </header>
          <DataStudioPreparationCanvasReactFlow
            projection={canvasProjection}
            selectedNodeId={selectedCanvasNodeId}
            onSelectNode={setSelectedCanvasNodeId}
            onClearSelection={() => setSelectedCanvasNodeId(undefined)}
          />
          <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="data-studio-canvas-inspector">
            <strong>Stage Inspector</strong>
            {selectedCanvasNode ? (
              <>
                <span className="ui-text-small">{selectedCanvasNode.label}</span>
                <span className="ui-text-small ui-text-secondary">
                  Stage: {typeof selectedCanvasNode.metadata?.stageId === "string" ? selectedCanvasNode.metadata.stageId : "n/a"}
                </span>
                <span className="ui-text-small ui-text-secondary">
                  Status: {typeof selectedCanvasNode.metadata?.stageStatus === "string" ? selectedCanvasNode.metadata.stageStatus : "n/a"}
                </span>
              </>
            ) : (
              <span className="ui-subtle">Select a canvas node to inspect stage metadata.</span>
            )}
          </aside>
        </section>
      )}

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
        <span className="ui-text-small ui-text-secondary">Presentation mode: {handoff.presentationMode}</span>
        <span className="ui-text-small ui-text-secondary">
          Graph nodes: {handoff.authoringGraph.nodes.length} | edges: {handoff.authoringGraph.edges.length} | stages: {handoff.stages.length}
        </span>
      </details>
    </section>
  );
}
