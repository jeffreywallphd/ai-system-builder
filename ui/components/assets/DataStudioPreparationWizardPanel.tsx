import { useEffect, useMemo, useRef, useState } from "react";
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
import { DataStudioPreparationWizardStateAdapter } from "../../studio-shell/data/DataStudioPreparationWizardStateAdapter";
import StageWizardProgressNavigator from "../wizard/StageWizardProgressNavigator";
import DataStudioPreparationCanvasReactFlow from "./DataStudioPreparationCanvasReactFlow";
import {
  DataStudioAdvancedEditingActions,
  DataStudioNodePaletteDrawer,
  DataStudioStageInternalsPanel,
  DataStudioStageMetadataPanel,
  stageStatusLabel,
} from "./data-studio/DataStudioStageUxComponents";

export interface DataStudioPreparationWizardPanelProps {
  readonly adapter?: DataStudioPreparationWizardStateAdapter;
  readonly persistedState?: string;
  readonly onPipelineStateChange?: (serializedState: string) => void;
  readonly onSnapshotChange?: (snapshot: DataStudioWizardSnapshot) => void;
  readonly embeddedMode?: boolean;
}

export const DataStudioWizardPersistenceStorageKey = "ai-loom.data-studio.preparation.state.v1";

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
  const normalizedPersistedState = props.persistedState?.trim() || undefined;
  const localAdapter = useMemo(
    () => {
      if (typeof window === "undefined") {
        return new DataStudioPreparationWizardStateAdapter();
      }
      const persistedState = normalizedPersistedState
        ?? window.localStorage.getItem(DataStudioWizardPersistenceStorageKey)
        ?? undefined;
      return new DataStudioPreparationWizardStateAdapter({
        persistedState,
      });
    },
    [normalizedPersistedState],
  );
  const adapter = props.adapter ?? localAdapter;
  const lastImportedStateRef = useRef<string | undefined>(normalizedPersistedState);
  const lastPublishedStateRef = useRef<string | undefined>(normalizedPersistedState);
  const onPipelineStateChangeRef = useRef<DataStudioPreparationWizardPanelProps["onPipelineStateChange"]>(
    props.onPipelineStateChange,
  );
  const [snapshot, setSnapshot] = useState<DataStudioWizardSnapshot>(() => adapter.getSnapshot());
  const isEmbeddedMode = props.embeddedMode === true;
  const [isPaletteOpen, setIsPaletteOpen] = useState(!isEmbeddedMode);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [authoringMode, setAuthoringMode] = useState<"wizard" | "canvas">(isEmbeddedMode ? "wizard" : "wizard");
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string | undefined>(undefined);
  const [activationConditionDraft, setActivationConditionDraft] = useState<string>("");
  const [updateError, setUpdateError] = useState<string | undefined>(undefined);
  const [inspectedStageId, setInspectedStageId] = useState<PipelineStageId | undefined>(undefined);

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
  const inspectedStage = inspectedStageId ?? currentStage?.stageId;
  const stageInternals = inspectedStage
    ? adapter.getStageInternals(inspectedStage)
    : undefined;
  const executionReadiness = adapter.assessExecutionReadiness();

  useEffect(() => {
    onPipelineStateChangeRef.current = props.onPipelineStateChange;
  }, [props.onPipelineStateChange]);

  const publishPipelineState = (serializedPipelineState: string) => {
    if (serializedPipelineState === lastPublishedStateRef.current) {
      return;
    }
    lastPublishedStateRef.current = serializedPipelineState;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DataStudioWizardPersistenceStorageKey, serializedPipelineState);
      } catch {
        // ignore persistence failures (storage unavailable/quota)
      }
    }
    onPipelineStateChangeRef.current?.(serializedPipelineState);
  };

  useEffect(() => {
    if (normalizedPersistedState) {
      return;
    }
    const serializedPipelineState = adapter.exportPipelineStateJson();
    publishPipelineState(serializedPipelineState);
  }, [adapter, normalizedPersistedState]);

  useEffect(() => {
    if (!normalizedPersistedState || normalizedPersistedState === lastImportedStateRef.current) {
      return;
    }
    const result = adapter.importPipelineState(normalizedPersistedState);
    if (result.ok) {
      lastImportedStateRef.current = normalizedPersistedState;
      lastPublishedStateRef.current = normalizedPersistedState;
      setSnapshot(adapter.getSnapshot());
    }
  }, [adapter, normalizedPersistedState]);

  const refreshSnapshot = () => {
    const next = adapter.getSnapshot();
    setSnapshot(next);
    const serializedPipelineState = adapter.exportPipelineStateJson();
    publishPipelineState(serializedPipelineState);
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

  const focusStageInCanvas = (stageId: PipelineStageId) => {
    const targetNodeId = adapter.findCanvasNodeIdForStage(stageId);
    setSelectedCanvasNodeId(targetNodeId);
    setAuthoringMode("canvas");
    setInspectedStageId(stageId);
    setUpdateError(undefined);
  };

  const inspectStageInternals = (stageId: PipelineStageId) => {
    setInspectedStageId(stageId);
    setUpdateError(undefined);
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

  useEffect(() => {
    if (isEmbeddedMode && authoringMode !== "wizard") {
      setAuthoringMode("wizard");
    }
  }, [authoringMode, isEmbeddedMode]);

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

      <div className="ui-toolbar ui-toolbar--panel" data-testid="data-studio-authoring-toolbar">
        <div className="ui-toolbar__group">
          {!isEmbeddedMode ? (
            <>
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
            </>
          ) : null}
          <button
            type="button"
            className={`ui-button ui-button--sm ${snapshot.presentationMode === DataStudioWizardPresentationModes.simple ? "ui-button--primary" : "ui-button--ghost"}`}
            onClick={() => {
              adapter.setSimpleMode();
              refreshSnapshot();
            }}
          >
            Basic
          </button>
          {!isEmbeddedMode ? (
            <>
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
            </>
          ) : null}
        </div>
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
                <DataStudioStageMetadataPanel stage={currentStage} totalStages={snapshot.stages.length} />

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

                {!isEmbeddedMode ? (
                  <DataStudioAdvancedEditingActions
                    stageId={currentStage.stageId}
                    stageTitle={currentStage.title}
                    mode={authoringMode}
                    onInspectInternals={inspectStageInternals}
                    onEditInCanvas={focusStageInCanvas}
                  />
                ) : null}
              </>
            ) : (
              <span className="ui-subtle">No active stage.</span>
            )}

            {!isEmbeddedMode ? <DataStudioStageInternalsPanel internals={stageInternals} /> : null}

            {updateError ? (
              <p className="ui-text-small ui-text-danger" data-testid="data-studio-wizard-update-error">{updateError}</p>
            ) : null}

            <footer className="ui-row ui-row--between ui-row--wrap">
              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={() => {
                  const result = adapter.goBack();
                  if (!result.moved && result.issues[0]?.message) {
                    setUpdateError(result.issues[0].message);
                  } else {
                    setUpdateError(undefined);
                  }
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
                  const result = adapter.goNext();
                  if (!result.moved && result.issues[0]?.message) {
                    setUpdateError(result.issues[0].message);
                  } else {
                    setUpdateError(undefined);
                  }
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
            onSelectNode={(nodeId) => {
              setSelectedCanvasNodeId(nodeId);
              const selectedStageId = canvasProjection.graph.nodes.find((node) => node.id === nodeId)?.metadata?.stageId;
              if (typeof selectedStageId === "string") {
                setInspectedStageId(selectedStageId as PipelineStageId);
              }
            }}
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
            {inspectedStageId ? (
              <DataStudioAdvancedEditingActions
                stageId={inspectedStageId}
                stageTitle={adapter.getStage(inspectedStageId)?.title ?? inspectedStageId}
                mode={authoringMode}
                onInspectInternals={inspectStageInternals}
                onEditInCanvas={focusStageInCanvas}
              />
            ) : null}
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => {
                if (inspectedStageId) {
                  adapter.goToStage(inspectedStageId);
                  refreshSnapshot();
                }
                setAuthoringMode("wizard");
              }}
            >
              Edit selected stage in Wizard
            </button>
            <DataStudioStageInternalsPanel internals={stageInternals} />
          </aside>
        </section>
      )}

      {!isEmbeddedMode ? (
        <>
          <DataStudioNodePaletteDrawer
            isOpen={isPaletteOpen}
            searchValue={paletteSearch}
            stages={paletteStages}
            onClose={() => setIsPaletteOpen(false)}
            onSearchChange={setPaletteSearch}
            onFocusStage={(stageId) => {
              adapter.goToStage(stageId);
              refreshSnapshot();
              focusStageInCanvas(stageId);
            }}
            onInspectStage={(stageId) => {
              inspectStageInternals(stageId);
              adapter.goToStage(stageId);
              refreshSnapshot();
            }}
          />

          <details className="ui-card ui-card--padded ui-stack ui-stack--2xs">
            <summary className="ui-text-small">Wizard to Canvas handoff</summary>
            <span className="ui-text-small ui-text-secondary">
              Execution readiness: {executionReadiness.executionReady ? "ready" : "blocked"} (
              {executionReadiness.summary.blockingIssueCount} blocking, {executionReadiness.summary.warningIssueCount} warning)
            </span>
            <span className="ui-text-small ui-text-secondary">Current stage: {handoff.currentStageId}</span>
            <span className="ui-text-small ui-text-secondary">Presentation mode: {handoff.presentationMode}</span>
            <span className="ui-text-small ui-text-secondary">
              Graph nodes: {handoff.authoringGraph.nodes.length} | edges: {handoff.authoringGraph.edges.length} | stages: {handoff.stages.length}
            </span>
          </details>
        </>
      ) : null}
    </section>
  );
}
