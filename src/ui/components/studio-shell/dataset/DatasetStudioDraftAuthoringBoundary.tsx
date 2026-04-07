import { useEffect, useMemo, useRef, useState } from "react";
import {
  DataStudioPreparationWizardStateAdapter,
  DataStudioWizardPersistenceStorageKey,
  type DataStudioPreparationWizardAdapterUpdateResult,
} from "../../../studio-shell/data/DataStudioPreparationWizardStateAdapter";
import {
  ExperienceSurfaceAssetIds,
  resolveExperienceAssetModesFromRegistrations,
  type ExperienceSurfaceAssetId,
} from "../../../studio-shell/experience-assets/ExperienceSurfaceAssets";
import type { StudioShellExtensionContext } from "../../../studio-shell/StudioShellExtensions";
import type { ExperienceAssetDefinition } from "../../../studio-shell/experience-assets/ExperienceAssetContracts";
import StageWizardProgressNavigator from "../../wizard/StageWizardProgressNavigator";
import DataStudioPreparationCanvasReactFlow from "../../assets/DataStudioPreparationCanvasReactFlow";
import DataStudioSchemaStudioEntryPanel from "../../assets/data-studio/DataStudioSchemaStudioEntryPanel";
import DataStudioPipelineStudioEntryPanel from "../../assets/data-studio/DataStudioPipelineStudioEntryPanel";
import {
  DataStudioStageMetadataPanel,
  DataStudioStageInternalsPanel,
  stageStatusLabel,
} from "../../assets/data-studio/DataStudioStageUxComponents";
import { StudioAssetRenderModes, type StudioAssetRenderMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import { StudioEmbeddedIntentKinds, createStudioIntentEvent, type StudioEmbeddedEvent } from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";
import type { CanonicalRecordValue } from "../../../../src/domain/dataset-studio/CanonicalDataShapes";
import { UnifiedPreparationStageActivationModes } from "../../../../src/domain/dataset-studio/UnifiedPreparationAsset";

interface DatasetStudioDraftAuthoringBoundaryProps {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly hostMode?: StudioAssetRenderMode;
  readonly onStudioEvent?: (event: StudioEmbeddedEvent) => void;
  readonly embeddedVariant?: "inputs-outputs";
}


const defaultDatasetExperienceAssetIds = Object.freeze([
  ExperienceSurfaceAssetIds.loomWizard,
  ExperienceSurfaceAssetIds.loomCanvas,
]);

function buildDatasetExperienceDefinition(
  experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>,
): ExperienceAssetDefinition<string, never> {
  const fallbackModes = Object.freeze([
    Object.freeze({ id: "wizard", title: "Wizard", summary: "Step-by-step data preparation setup.", intent: "guided-authoring" as const }),
    Object.freeze({ id: "canvas", title: "Canvas", summary: "Visual stage flow editing.", intent: "graph-authoring" as const }),
  ]);

  const enabledModeIds = new Set(resolveExperienceAssetModesFromRegistrations({ assetIds: experienceAssetIds, fallbackModes }).map((mode) => mode.id));
  const modes = fallbackModes.filter((mode) => enabledModeIds.has(mode.id));
  const hasWizard = modes.some((mode) => mode.id === "wizard");
  const hasCanvas = modes.some((mode) => mode.id === "canvas");

  return Object.freeze({
    id: "dataset-studio-experience",
    title: "Data Studio",
    defaultModeId: hasWizard ? "wizard" : "canvas",
    modes: Object.freeze(modes),
    wizard: hasWizard ? Object.freeze({ id: "wizard", title: "Wizard", summary: "Step-by-step data preparation setup." }) : undefined,
    canvas: hasCanvas ? Object.freeze({ id: "canvas", title: "Canvas", summary: "Visual stage flow editing." }) : undefined,
  });
}

function parseTextList(value: string): ReadonlyArray<string> {
  return Object.freeze(value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0));
}

function formatFieldValue(value: CanonicalRecordValue): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export default function DatasetStudioDraftAuthoringBoundary({
  content,
  extensionContext,
  experienceAssetIds = defaultDatasetExperienceAssetIds,
  hostMode = StudioAssetRenderModes.full,
  onStudioEvent,
  embeddedVariant,
}: DatasetStudioDraftAuthoringBoundaryProps): JSX.Element {
  const constrainedExperienceAssetIds = embeddedVariant === "inputs-outputs"
    ? Object.freeze([ExperienceSurfaceAssetIds.loomWizard] as const)
    : experienceAssetIds;
  const experienceDefinition = useMemo(() => buildDatasetExperienceDefinition(constrainedExperienceAssetIds), [constrainedExperienceAssetIds]);
  const normalizedContent = content.trim().length > 0 ? content : undefined;

  const adapter = useMemo(() => new DataStudioPreparationWizardStateAdapter({
    persistedState: normalizedContent ?? (typeof window !== "undefined" ? window.localStorage.getItem(DataStudioWizardPersistenceStorageKey) ?? undefined : undefined),
  }), [normalizedContent]);

  const [selectedModeId, setSelectedModeId] = useState<"wizard" | "canvas">(
    hostMode === StudioAssetRenderModes.full ? experienceDefinition.defaultModeId as "wizard" | "canvas" : "wizard",
  );
  const [snapshot, setSnapshot] = useState(() => adapter.getSnapshot());
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string | undefined>(undefined);
  const [activationConditionDraft, setActivationConditionDraft] = useState<string>("");
  const [updateError, setUpdateError] = useState<string | undefined>(undefined);
  const lastImportedStateRef = useRef<string | undefined>(normalizedContent);

  const publishState = (serializedState: string): void => {
    extensionContext.operations.setDraftContent?.(serializedState);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DataStudioWizardPersistenceStorageKey, serializedState);
      } catch {
        // noop
      }
    }
    onStudioEvent?.(createStudioIntentEvent({ kind: StudioEmbeddedIntentKinds.applyRequest, payload: Object.freeze({ scope: "changes" }) }));
  };

  useEffect(() => {
    if (!normalizedContent || normalizedContent === lastImportedStateRef.current) {
      return;
    }
    const importResult = adapter.importPipelineState(normalizedContent);
    if (importResult.ok) {
      setSnapshot(adapter.getSnapshot());
      lastImportedStateRef.current = normalizedContent;
    }
  }, [adapter, normalizedContent]);

  const refreshSnapshot = (): void => {
    const next = adapter.getSnapshot();
    setSnapshot(next);
    publishState(adapter.exportPipelineStateJson());
  };

  const applyResult = (result: DataStudioPreparationWizardAdapterUpdateResult): void => {
    if (!result.ok) {
      setUpdateError(result.issues[0]?.message ?? "Unable to apply update.");
      return;
    }
    setUpdateError(undefined);
    refreshSnapshot();
  };

  const currentStage = snapshot.stages.find((stage) => stage.stageId === snapshot.currentStageId);
  const canvasProjection = adapter.toCanvasProjection();
  const selectedCanvasNode = selectedCanvasNodeId
    ? canvasProjection.graph.nodes.find((node) => node.id === selectedCanvasNodeId)
    : undefined;
  const inspectedStageId = selectedCanvasNode?.metadata?.stageId;
  const selectedMode = experienceDefinition.modes.find((mode) => mode.id === selectedModeId)
    ?? experienceDefinition.modes.find((mode) => mode.id === experienceDefinition.defaultModeId)
    ?? experienceDefinition.modes[0];

  const renderField = (optionKey: string, fieldLabel: string, value: CanonicalRecordValue, description?: string): JSX.Element => {
    const isToggle = typeof value === "boolean";
    const isNumber = typeof value === "number";
    const isSelect = optionKey.toLowerCase().includes("mode") || optionKey.toLowerCase().includes("kind") || optionKey.toLowerCase().includes("target");

    if (isToggle) {
      return (
        <label key={optionKey} className="ui-field">
          <span className="ui-field__label">{fieldLabel}</span>
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => currentStage && applyResult(adapter.setStageOptions(currentStage.stageId, Object.freeze({
              ...currentStage.options,
              [optionKey]: event.currentTarget.checked,
            })))}
          />
          {description ? <span className="ui-field__hint">{description}</span> : null}
        </label>
      );
    }

    if (isNumber) {
      return (
        <label key={optionKey} className="ui-field">
          <span className="ui-field__label">{fieldLabel}</span>
          <input
            className="ui-input"
            type="number"
            value={formatFieldValue(value)}
            onChange={(event) => currentStage && applyResult(adapter.setStageOptions(currentStage.stageId, Object.freeze({
              ...currentStage.options,
              [optionKey]: Number(event.currentTarget.value),
            })))}
          />
          {description ? <span className="ui-field__hint">{description}</span> : null}
        </label>
      );
    }

    if (isSelect && Array.isArray(currentStage?.fields)) {
      const field = currentStage.fields.find((entry) => entry.optionKey === optionKey);
      if (field?.inputKind === "select" && field.options && field.options.length > 0) {
        return (
          <label key={optionKey} className="ui-field">
            <span className="ui-field__label">{fieldLabel}</span>
            <select
              className="ui-select"
              value={String(value ?? "")}
              onChange={(event) => currentStage && applyResult(adapter.setStageOptions(currentStage.stageId, Object.freeze({
                ...currentStage.options,
                [optionKey]: event.currentTarget.value,
              })))}
            >
              {field.options.map((option) => <option key={`${optionKey}-${option.value}`} value={String(option.value)}>{option.label}</option>)}
            </select>
            {description ? <span className="ui-field__hint">{description}</span> : null}
          </label>
        );
      }
    }

    const asList = Array.isArray(value);
    return (
      <label key={optionKey} className="ui-field">
        <span className="ui-field__label">{fieldLabel}</span>
        <input
          className="ui-input"
          value={formatFieldValue(value)}
          onChange={(event) => currentStage && applyResult(adapter.setStageOptions(currentStage.stageId, Object.freeze({
            ...currentStage.options,
            [optionKey]: asList ? parseTextList(event.currentTarget.value) : event.currentTarget.value,
          })))}
        />
        {description ? <span className="ui-field__hint">{description}</span> : null}
      </label>
    );
  };

  return (
    <>
      {experienceDefinition.modes.length > 1 && hostMode === StudioAssetRenderModes.full ? (
        <div className="ui-row ui-row--wrap" data-testid="dataset-studio-mode-actions">
          {experienceDefinition.modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`ui-button ui-button--sm ${mode.id === selectedMode?.id ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => {
                setSelectedModeId(mode.id as "wizard" | "canvas");
                onStudioEvent?.(createStudioIntentEvent({
                  kind: StudioEmbeddedIntentKinds.selectionChange,
                  payload: Object.freeze({ targetType: "item", targetId: mode.id }),
                }));
              }}
            >
              {mode.title}
            </button>
          ))}
        </div>
      ) : null}

      {selectedMode?.id === "wizard" ? (
          <div className="ui-stack ui-stack--sm" data-testid="dataset-studio-wizard-surface">
            <section className="ui-card ui-card--padded ui-stage-wizard ui-stack ui-stack--md">
              <header className="ui-stack ui-stack--2xs">
                <h3>Data Flow Builder</h3>
                <span className="ui-subtle">Progress: {snapshot.progressPercent}%</span>
              </header>

              <div className="ui-stage-wizard__layout">
                <StageWizardProgressNavigator
                  title="Data flow steps"
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

                      <section className="ui-stack ui-stack--xs" data-testid="data-studio-wizard-stage-form">
                        {currentStage.fields.filter((field) => field.isVisible).length > 0
                          ? currentStage.fields.filter((field) => field.isVisible).map((field) => renderField(field.optionKey, field.label, field.value, field.description))
                          : Object.entries(currentStage.options).map(([key, value]) => renderField(key, key, value))}
                      </section>

                      <section className="ui-card ui-card--padded ui-stack ui-stack--xs">
                        <strong>Stage options</strong>
                        {currentStage.isOptional ? (
                          <>
                            <label className="ui-field">
                              <span className="ui-field__label">Activation</span>
                              <select
                                className="ui-select"
                                value={currentStage.activation.mode}
                                onChange={(event) => applyResult(adapter.setStageActivation(currentStage.stageId, event.currentTarget.value === UnifiedPreparationStageActivationModes.conditional
                                  ? Object.freeze({ mode: UnifiedPreparationStageActivationModes.conditional, conditionId: activationConditionDraft.trim() || "stage-condition" })
                                  : event.currentTarget.value === UnifiedPreparationStageActivationModes.disabled
                                    ? Object.freeze({ mode: UnifiedPreparationStageActivationModes.disabled })
                                    : Object.freeze({ mode: UnifiedPreparationStageActivationModes.always })))}
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
                                  onBlur={() => applyResult(adapter.setStageActivation(currentStage.stageId, Object.freeze({
                                    mode: UnifiedPreparationStageActivationModes.conditional,
                                    conditionId: activationConditionDraft || currentStage.activation.conditionId || "stage-condition",
                                  })))}
                                />
                              </label>
                            ) : null}
                          </>
                        ) : (
                          <span className="ui-subtle">Required stage. Activation controls are disabled.</span>
                        )}
                      </section>
                    </>
                  ) : (
                    <span className="ui-subtle">No active stage.</span>
                  )}

                  {updateError ? <p className="ui-text-small ui-text-danger">{updateError}</p> : null}

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
            </section>

            {embeddedVariant !== "inputs-outputs" ? (
              <section className="ui-stack ui-stack--sm">
                <header className="ui-stack ui-stack--2xs">
                  <strong>Data workspaces</strong>
                  <span className="ui-subtle">Choose where to work next: structure design in Schema Studio or flow design in Pipeline Studio.</span>
                </header>
                <div className="ui-grid ui-grid--2col">
                  <DataStudioSchemaStudioEntryPanel />
                  <DataStudioPipelineStudioEntryPanel />
                </div>
              </section>
            ) : null}
          </div>
      ) : selectedMode?.id === "canvas" ? (
          <section className="ui-workflow-studio-canvas ui-stack ui-stack--sm" data-testid="dataset-studio-canvas-surface">
            <header className="ui-row ui-row--between ui-row--wrap">
              <strong>Data flow canvas</strong>
              <div className="ui-row ui-row--wrap">
                <span className="ui-badge ui-badge--neutral">Groups: {canvasProjection.graph.groups.length}</span>
                <span className="ui-badge ui-badge--neutral">Nodes: {canvasProjection.graph.nodes.length}</span>
                <span className="ui-badge ui-badge--neutral">Edges: {canvasProjection.graph.edges.length}</span>
              </div>
            </header>
            <DataStudioPreparationCanvasReactFlow
              projection={canvasProjection}
              selectedNodeId={selectedCanvasNodeId}
              onSelectNode={(nodeId) => setSelectedCanvasNodeId(nodeId)}
              onClearSelection={() => setSelectedCanvasNodeId(undefined)}
            />
            <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="dataset-studio-canvas-inspector">
              <strong>Stage details</strong>
              {selectedCanvasNode ? (
                <>
                  <span className="ui-text-small">{selectedCanvasNode.label}</span>
                  <span className="ui-text-small ui-text-secondary">Stage: {typeof selectedCanvasNode.metadata?.stageId === "string" ? selectedCanvasNode.metadata.stageId : "n/a"}</span>
                  <span className="ui-text-small ui-text-secondary">Status: {typeof selectedCanvasNode.metadata?.stageStatus === "string" ? stageStatusLabel(selectedCanvasNode.metadata.stageStatus) : "n/a"}</span>
                </>
              ) : (
                <span className="ui-subtle">Select a stage on the canvas to review details.</span>
              )}
              {typeof inspectedStageId === "string" ? <DataStudioStageInternalsPanel internals={adapter.getStageInternals(inspectedStageId)} /> : null}
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                disabled={typeof inspectedStageId !== "string"}
                onClick={() => {
                  if (typeof inspectedStageId === "string") {
                    adapter.goToStage(inspectedStageId);
                    refreshSnapshot();
                    setSelectedModeId("wizard");
                  }
                }}
              >
                Edit selected stage in guided view
              </button>
            </aside>
          </section>
      ) : (
        <p className="ui-text-muted">No authoring modes are configured for this dataset studio surface.</p>
      )}
    </>
  );
}
