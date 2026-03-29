import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepTypes,
  type WorkflowDraft,
  type WorkflowDraftDelayWaitStepConfig,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraftLoopIterationStepConfig,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { serializeWorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  AssetSelectorSessionLifecycleStates,
  type AssetSelectorSessionState,
} from "../../../../application/studio-entry/AssetSelectorSessionStore";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import { RegistryService } from "../../../services/RegistryService";
import AssetSelectorShell from "../asset-selector/AssetSelectorShell";
import { getAssetSelectorSessionStore } from "../../../studio-shell/asset-selector/AssetSelectorSessionRegistry";
import type { AssetSelectorResultItem } from "../../../studio-shell/asset-selector/AssetSelectorDataProvider";
import {
  AgentAssistantAssetSelectorAdapter,
  createAgentAssistantAssetSelectorRequest,
} from "../../../studio-shell/asset-selector/AgentAssistantAssetSelectorAdapter";
import { AssetSelectorStudioLaunchService } from "../../../studio-shell/asset-selector/AssetSelectorStudioLaunchService";
import { AssetSelectorReturnHandoffService } from "../../../studio-shell/asset-selector/AssetSelectorReturnHandoffService";
import {
  addWorkflowStep,
  buildWorkflowStepTypeDefinitionKey,
  clearWorkflowStepAgentAssetSelection,
  getWorkflowStepTypeDefinitionByKey,
  moveWorkflowStepDown,
  moveWorkflowStepUp,
  removeWorkflowStep,
  resolveWorkflowStepTypeDefinition,
  setWorkflowStepAgentAssetSelection,
  setWorkflowStepDelayConfig,
  setWorkflowStepIfThenConfig,
  setWorkflowStepLoopConfig,
  setWorkflowStepTitle,
  setWorkflowStepType,
  workflowStepTypeDefinitions,
  WorkflowWizardStepSelectionKinds,
} from "../../../studio-shell/workflow/WorkflowWizardSteps";

interface WorkflowStudioStepSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
}

const stepSelectorTargetQueryParam = "workflowStepSelectorTarget";

type StepSelectorOperation =
  | Readonly<{ readonly kind: "add" }>
  | Readonly<{ readonly kind: "replace"; readonly stepId: string }>;

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function buildAgentAssetLabel(asset: { readonly assetId: string; readonly versionId?: string; readonly name?: string }): string {
  const base = asset.name?.trim() || asset.assetId;
  return asset.versionId ? `${base} (${asset.versionId})` : base;
}

function buildStepTypeBadgeLabel(selectionKind: string): string {
  return selectionKind === WorkflowWizardStepSelectionKinds.assetBacked ? "Asset-backed" : "Built-in";
}

function countCompletedStates(state: AssetSelectorSessionState): number {
  return state.lifecycleHistory.filter((entry) => entry === AssetSelectorSessionLifecycleStates.completed).length;
}

function parseStepSelectorOperationFromSearch(search: string, draft: WorkflowDraft): StepSelectorOperation | undefined {
  const params = new URLSearchParams(search);
  const target = params.get(stepSelectorTargetQueryParam)?.trim();
  if (!target) {
    return undefined;
  }
  if (target === "new") {
    return Object.freeze({ kind: "add" } as const);
  }
  const stepExists = draft.steps.some((step) => step.id === target);
  if (!stepExists) {
    return undefined;
  }
  return Object.freeze({ kind: "replace", stepId: target });
}

function writeStepSelectorOperationToSearch(search: string, operation?: StepSelectorOperation): string {
  const params = new URLSearchParams(search);
  if (!operation) {
    params.delete(stepSelectorTargetQueryParam);
  } else if (operation.kind === "add") {
    params.set(stepSelectorTargetQueryParam, "new");
  } else {
    params.set(stepSelectorTargetQueryParam, operation.stepId);
  }
  const next = params.toString();
  return next ? `?${next}` : "";
}

const defaultAgentAssistantStepDefinition = workflowStepTypeDefinitions.find(
  (definition) => definition.type === WorkflowDraftStepTypes.agentAssistant,
) ?? workflowStepTypeDefinitions[0];

export default function WorkflowStudioStepSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  studioId,
}: WorkflowStudioStepSectionEditorProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const selectorSessionStore = useMemo(() => getAssetSelectorSessionStore(), []);
  const registryService = useMemo(() => new RegistryService(), []);
  const studioLaunchService = useMemo(() => new AssetSelectorStudioLaunchService(), []);
  const returnHandoffService = useMemo(() => new AssetSelectorReturnHandoffService(), []);
  const selectorDataProvider = useMemo(() => new AgentAssistantAssetSelectorAdapter({
    registryService,
    limit: 50,
  }), [registryService]);

  const selectorSessionKey = useMemo(
    () => `workflow-studio:${studioId?.trim() || "default"}:steps:agent-assistant`,
    [studioId],
  );
  const selectorRequest = useMemo(() => createAgentAssistantAssetSelectorRequest({
    requestId: `selector:${selectorSessionKey}`,
    originatingStudio: "workflow-studio",
    originatingField: "steps.agent-assistant",
    launchSource: "wizard",
    selectionMode: "single-select",
    minSelections: 0,
    maxSelections: 1,
    required: false,
  }), [selectorSessionKey]);
  const workflowDraftReference = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Object.freeze({
      studioId: studioId?.trim() || "studio-workflows",
      draftId: params.get("draftId")?.trim() || undefined,
      sessionId: params.get("sessionId")?.trim() || undefined,
      assetId: params.get("assetId")?.trim() || undefined,
      versionId: params.get("versionId")?.trim() || undefined,
    });
  }, [location.search, studioId]);
  const serializedSharedDraft = useMemo(() => serializeWorkflowDraft(sharedDraft), [sharedDraft]);

  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<ReadonlyArray<AssetSelectorResultItem>>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | undefined>(undefined);
  const [queryRevision, setQueryRevision] = useState(0);
  const [selectorNotice, setSelectorNotice] = useState<string | undefined>(undefined);
  const [returnedItems, setReturnedItems] = useState<ReadonlyArray<AssetSelectorResultItem>>([]);
  const [selectorState, setSelectorState] = useState<AssetSelectorSessionState | undefined>(
    () => selectorSessionStore.getSession(selectorSessionKey),
  );
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorOperation, setSelectorOperation] = useState<StepSelectorOperation | undefined>(undefined);
  const lastAppliedCompletedCount = useRef<number | undefined>(undefined);

  const stepValidationIssues = useMemo(
    () => draftValidationIssues.filter((issue) => issue.section === "steps" || issue.path?.startsWith("draft.steps")),
    [draftValidationIssues],
  );
  const sectionHasErrors = stepValidationIssues.some((issue) => issue.severity === "error");
  const selectorItems = useMemo(() => {
    const byId = new Map<string, AssetSelectorResultItem>();
    for (const item of returnedItems) {
      byId.set(item.id, item);
    }
    for (const item of items) {
      byId.set(item.id, item);
    }
    return Object.freeze([...byId.values()]);
  }, [items, returnedItems]);
  const unavailableStepAssetIds = useMemo(() => {
    if (searchTerm.trim().length > 0 || loading || Boolean(queryError)) {
      return new Set<string>();
    }
    const available = new Set(selectorItems.map((item) => item.asset.assetId));
    const unavailable = new Set<string>();
    for (const step of sharedDraft.steps) {
      const assetId = step.assetRef?.asset.assetId;
      if (!assetId) {
        continue;
      }
      if (!available.has(assetId)) {
        unavailable.add(assetId);
      }
    }
    return unavailable;
  }, [loading, queryError, searchTerm, selectorItems, sharedDraft.steps]);

  const addableDefinitions = useMemo(
    () => workflowStepTypeDefinitions.filter((definition) => definition.interactive),
    [],
  );

  const openSelector = (operation: StepSelectorOperation, seedSelection?: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly displayName?: string;
  }) => {
    selectorSessionStore.activateSession(selectorSessionKey);
    if (seedSelection?.assetId?.trim()) {
      selectorSessionStore.setPendingSelections(selectorSessionKey, [Object.freeze({
        assetId: seedSelection.assetId,
        versionId: seedSelection.versionId,
        assetType: "agent" as const,
        displayName: seedSelection.displayName,
      })]);
    } else {
      selectorSessionStore.clearPendingSelections(selectorSessionKey);
    }
    setSelectorOperation(operation);
    setSelectorOpen(true);
    setSelectorNotice(undefined);

    const nextSearch = writeStepSelectorOperationToSearch(location.search, operation);
    void navigate({
      pathname: location.pathname,
      search: nextSearch,
      hash: location.hash,
    }, { replace: true });
  };

  const closeSelector = () => {
    selectorSessionStore.activateSession(selectorSessionKey);
    selectorSessionStore.clearPendingSelections(selectorSessionKey);
    setSelectorOpen(false);
    setSelectorOperation(undefined);
    const nextSearch = writeStepSelectorOperationToSearch(location.search, undefined);
    void navigate({
      pathname: location.pathname,
      search: nextSearch,
      hash: location.hash,
    }, { replace: true });
  };

  useEffect(() => {
    const existing = selectorSessionStore.getSession(selectorSessionKey);
    if (!existing) {
      selectorSessionStore.prepareSession({
        sessionKey: selectorSessionKey,
        request: selectorRequest,
      });
    }

    if (selectorSessionStore.getSession(selectorSessionKey)?.lifecycleState === AssetSelectorSessionLifecycleStates.idle) {
      selectorSessionStore.activateSession(selectorSessionKey);
    }

    const unsubscribe = selectorSessionStore.subscribe(selectorSessionKey, setSelectorState);
    return unsubscribe;
  }, [selectorRequest, selectorSessionKey, selectorSessionStore]);

  useEffect(() => {
    if (selectorOperation) {
      return;
    }
    const operationFromSearch = parseStepSelectorOperationFromSearch(location.search, sharedDraft);
    if (!operationFromSearch) {
      return;
    }
    setSelectorOperation(operationFromSearch);
    setSelectorOpen(true);
  }, [location.search, selectorOperation, sharedDraft]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setQueryError(undefined);
      const response = await selectorDataProvider.query({
        request: selectorRequest,
        searchTerm,
      });
      if (!active) {
        return;
      }
      setItems(response.items);
      setQueryError(response.error);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [queryRevision, searchTerm, selectorDataProvider, selectorRequest]);

  useEffect(() => {
    const outcome = returnHandoffService.handle({
      search: location.search,
      sessionKey: selectorSessionKey,
      request: selectorRequest,
      sessionStore: selectorSessionStore,
    });

    if (!outcome.handled) {
      return;
    }

    if (outcome.returnedAsset) {
      setReturnedItems((current) => {
        const key = `${outcome.returnedAsset?.assetId}:${outcome.returnedAsset?.versionId ?? ""}`;
        const existing = new Set(current.map((entry) => `${entry.asset.assetId}:${entry.asset.versionId ?? ""}`));
        if (existing.has(key)) {
          return current;
        }
        const nextItem: AssetSelectorResultItem = Object.freeze({
          id: key,
          title: outcome.returnedAsset?.displayName ?? outcome.returnedAsset?.assetId,
          subtitle: outcome.returnedAsset?.versionId,
          description: "Created in Agent Studio",
          badges: Object.freeze(["agent", "new"]),
          asset: outcome.returnedAsset,
        });
        return Object.freeze([nextItem, ...current]);
      });
      setQueryRevision((current) => current + 1);
      setSelectorNotice(undefined);
      setSelectorOpen(true);
    }

    if (outcome.consumed && outcome.nextSearch !== undefined) {
      void navigate({
        pathname: location.pathname,
        search: outcome.nextSearch,
        hash: location.hash,
      }, { replace: true });
    }
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    returnHandoffService,
    selectorRequest,
    selectorSessionKey,
    selectorSessionStore,
  ]);

  useEffect(() => {
    if (!selectorState || !onUpdateSharedDraft || !defaultAgentAssistantStepDefinition) {
      return;
    }

    const completedCount = countCompletedStates(selectorState);
    if (lastAppliedCompletedCount.current === undefined) {
      lastAppliedCompletedCount.current = completedCount;
      return;
    }
    if (completedCount <= lastAppliedCompletedCount.current) {
      return;
    }
    lastAppliedCompletedCount.current = completedCount;

    const selectedAsset = selectorState.selectedAssets[0];
    if (!selectedAsset?.assetId?.trim()) {
      return;
    }

    const operation = selectorOperation
      ?? parseStepSelectorOperationFromSearch(location.search, sharedDraft)
      ?? Object.freeze({ kind: "add" } as const);

    onUpdateSharedDraft((draft) => {
      if (operation.kind === "replace") {
        const stepExists = draft.steps.some((step) => step.id === operation.stepId);
        if (!stepExists) {
          return draft;
        }
        return setWorkflowStepAgentAssetSelection(draft, operation.stepId, {
          assetId: selectedAsset.assetId,
          versionId: selectedAsset.versionId,
          name: selectedAsset.displayName,
        }).draft;
      }

      const added = addWorkflowStep(draft, defaultAgentAssistantStepDefinition);
      return setWorkflowStepAgentAssetSelection(added.draft, added.stepId, {
        assetId: selectedAsset.assetId,
        versionId: selectedAsset.versionId,
        name: selectedAsset.displayName,
      }).draft;
    });

    closeSelector();
  }, [location.search, onUpdateSharedDraft, selectorOperation, selectorState, sharedDraft]);

  const stateForShell = selectorState ?? selectorSessionStore.getSession(selectorSessionKey);

  return (
    <WizardSection sectionId="workflow-wizard-steps" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Steps Section"
        description="Configure ordered workflow steps and choose either asset-backed actions or built-in workflow logic. Agent and assistant discovery now uses the shared asset selector shell."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.steps.length, "step", "steps")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Add step</strong>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            {addableDefinitions.map((definition) => (
              <button
                key={buildWorkflowStepTypeDefinitionKey(definition)}
                type="button"
                className="ui-button ui-button--sm"
                data-testid={`workflow-step-add-${buildWorkflowStepTypeDefinitionKey(definition)}`}
                disabled={!onUpdateSharedDraft}
                onClick={() => {
                  if (!onUpdateSharedDraft) {
                    return;
                  }
                  if (definition.type === WorkflowDraftStepTypes.agentAssistant) {
                    openSelector(Object.freeze({ kind: "add" } as const));
                    return;
                  }
                  onUpdateSharedDraft((draft) => addWorkflowStep(draft, definition).draft);
                }}
              >
                {definition.label}
              </button>
            ))}
            {selectorOpen ? (
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                data-testid="workflow-step-close-selector"
                onClick={() => {
                  closeSelector();
                }}
              >
                Close selector
              </button>
            ) : null}
          </div>
        </div>

        {selectorOpen && stateForShell ? (
          <AssetSelectorShell
            title={selectorOperation?.kind === "replace" ? "Replace step asset" : "Add agent/assistant step"}
            state={stateForShell}
            searchTerm={searchTerm}
            items={selectorItems}
            loading={loading}
            error={queryError}
            onSearchTermChange={setSearchTerm}
            onToggleSelection={(item) => {
              selectorSessionStore.togglePendingSelection(selectorSessionKey, item.asset);
            }}
            onConfirm={() => {
              selectorSessionStore.confirmPendingSelections(selectorSessionKey);
            }}
            onCancel={() => {
              selectorSessionStore.cancelSession(selectorSessionKey, "user-cancelled-selector");
              closeSelector();
            }}
            onCreateNew={() => {
              const launch = studioLaunchService.launch({
                sessionKey: selectorSessionKey,
                selectorRequest,
                routePath: location.pathname,
                routeSearch: writeStepSelectorOperationToSearch(location.search, selectorOperation ?? Object.freeze({ kind: "add" } as const)),
                routeHash: location.hash || "#workflow-wizard-steps",
                selectorTargetId: selectorOperation?.kind === "replace"
                  ? `workflow-step:${selectorOperation.stepId}`
                  : "workflow-step:new",
                workflowOrigin: {
                  studioId: workflowDraftReference.studioId,
                  modeId: "wizard",
                  wizardPageId: "steps",
                  draftReference: workflowDraftReference,
                  draftState: serializedSharedDraft,
                },
              });
              if (!launch) {
                setSelectorNotice("Unable to open Agent Studio from this selector request.");
                return;
              }
              selectorSessionStore.transitionToCreatingNew(selectorSessionKey, {
                originatingContext: selectorRequest.context,
                requestedAssetType: selectorRequest.assetType,
                returnTargetSessionKey: selectorSessionKey,
                returnRoutePath: launch.returnTarget?.routePath,
              });
              setSelectorNotice(undefined);
              void navigate(launch.launchPath);
            }}
            onRetry={() => {
              setQueryRevision((current) => current + 1);
            }}
          />
        ) : null}

        {selectorNotice ? (
          <div className="ui-text-small ui-text-secondary" data-testid="workflow-step-create-agent-stub-notice">
            {selectorNotice}
          </div>
        ) : null}

        {unavailableStepAssetIds.size > 0 ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-step-unavailable-assets">
            <strong>Unavailable step assets</strong>
            <span className="ui-text-small ui-text-secondary">
              One or more selected step assets are no longer available in the registry. Replace them before run preparation.
            </span>
          </div>
        ) : null}

        {sharedDraft.steps.length === 0 ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-step-empty-state">
            <strong>No workflow steps configured yet.</strong>
            <span className="ui-text-small ui-text-secondary">
              Add a step type above to begin defining workflow logic.
            </span>
          </div>
        ) : (
          <div className="ui-stack ui-stack--2xs" data-testid="workflow-step-list">
            {sharedDraft.steps.map((step, index) => {
              const stepDefinition = resolveWorkflowStepTypeDefinition(step);
              const selectedAsset = step.assetRef?.asset;
              const ifThenConfig = (step.config ?? {}) as WorkflowDraftIfThenStepConfig;
              const loopConfig = (step.config ?? {}) as WorkflowDraftLoopIterationStepConfig;
              const delayConfig = (step.config ?? {}) as WorkflowDraftDelayWaitStepConfig;

              return (
                <article
                  key={step.id}
                  className="ui-card ui-card--padded ui-stack ui-stack--2xs"
                  data-testid={`workflow-step-row-${index}`}
                >
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                    <strong>{step.title || `Step ${index + 1}`}</strong>
                    <span className="ui-text-small ui-text-secondary">
                      {buildStepTypeBadgeLabel(stepDefinition.selectionKind)} - {stepDefinition.label}
                    </span>
                  </div>

                  <label className="ui-stack ui-stack--2xs">
                    <span className="ui-text-small">Step type</span>
                    <select
                      className="ui-select"
                      data-testid={`workflow-step-type-select-${index}`}
                      value={buildWorkflowStepTypeDefinitionKey(stepDefinition)}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        const nextDefinition = getWorkflowStepTypeDefinitionByKey(event.target.value);
                        if (!nextDefinition) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => setWorkflowStepType(draft, step.id, buildWorkflowStepTypeDefinitionKey(nextDefinition)).draft);
                      }}
                    >
                      {workflowStepTypeDefinitions.map((definition) => (
                        <option
                          key={buildWorkflowStepTypeDefinitionKey(definition)}
                          value={buildWorkflowStepTypeDefinitionKey(definition)}
                        >
                          {definition.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ui-stack ui-stack--2xs">
                    <span className="ui-text-small">Step title</span>
                    <input
                      className="ui-input"
                      data-testid={`workflow-step-title-${index}`}
                      value={step.title ?? ""}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => setWorkflowStepTitle(draft, step.id, event.target.value).draft);
                      }}
                    />
                  </label>

                  {step.type === WorkflowDraftStepTypes.agentAssistant ? (
                    <>
                      <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-asset-summary-${index}`}>
                        <span className="ui-text-small">
                          <strong>Selected asset:</strong>{" "}
                          {selectedAsset ? buildAgentAssetLabel({
                            assetId: selectedAsset.assetId,
                            versionId: selectedAsset.versionId,
                          }) : "None selected"}
                        </span>
                        {selectedAsset ? (
                          <span className="ui-text-small ui-text-secondary">{selectedAsset.assetId}</span>
                        ) : null}
                        {selectedAsset && unavailableStepAssetIds.has(selectedAsset.assetId) ? (
                          <span className="ui-text-small ui-text-danger">Selected asset is unavailable or deleted.</span>
                        ) : null}
                      </div>

                      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="ui-button ui-button--ghost ui-button--sm"
                          data-testid={`workflow-step-replace-asset-${index}`}
                          disabled={!onUpdateSharedDraft}
                          onClick={() => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            openSelector(
                              Object.freeze({ kind: "replace", stepId: step.id }),
                              selectedAsset
                                ? Object.freeze({
                                  assetId: selectedAsset.assetId,
                                  versionId: selectedAsset.versionId,
                                  displayName: step.title,
                                })
                                : undefined,
                            );
                          }}
                        >
                          {selectedAsset ? "Replace asset" : "Select asset"}
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button--ghost ui-button--sm"
                          data-testid={`workflow-step-clear-asset-${index}`}
                          disabled={!onUpdateSharedDraft || !selectedAsset}
                          onClick={() => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => clearWorkflowStepAgentAssetSelection(draft, step.id).draft);
                          }}
                        >
                          Clear asset
                        </button>
                      </div>
                    </>
                  ) : null}

                  {step.type === WorkflowDraftBuiltInStepTypes.ifThen ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-if-config-${index}`}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Condition expression</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-step-if-condition-${index}`}
                          value={ifThenConfig.conditionExpression ?? ""}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                              conditionExpression: event.target.value,
                            }).draft);
                          }}
                        />
                      </label>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Then label (optional)</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-step-if-then-label-${index}`}
                          value={ifThenConfig.thenLabel ?? ""}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                              thenLabel: event.target.value,
                            }).draft);
                          }}
                        />
                      </label>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Else label (optional)</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-step-if-else-label-${index}`}
                          value={ifThenConfig.elseLabel ?? ""}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                              elseLabel: event.target.value,
                            }).draft);
                          }}
                        />
                      </label>
                    </div>
                  ) : null}

                  {step.type === WorkflowDraftBuiltInStepTypes.loopIteration ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-loop-config-${index}`}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Repeat count</span>
                        <input
                          className="ui-input"
                          type="number"
                          min={1}
                          data-testid={`workflow-step-loop-repeat-${index}`}
                          value={String(loopConfig.repeatCount ?? "")}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const parsed = Number.parseInt(event.target.value, 10);
                            onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                              repeatCount: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                            }).draft);
                          }}
                        />
                      </label>
                    </div>
                  ) : null}

                  {step.type === WorkflowDraftBuiltInStepTypes.delayWait ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-delay-config-${index}`}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Duration (seconds)</span>
                        <input
                          className="ui-input"
                          type="number"
                          min={1}
                          data-testid={`workflow-step-delay-duration-${index}`}
                          value={String(delayConfig.durationSeconds ?? "")}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const parsed = Number.parseInt(event.target.value, 10);
                            onUpdateSharedDraft((draft) => setWorkflowStepDelayConfig(draft, step.id, {
                              durationSeconds: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                            }).draft);
                          }}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-step-move-up-${index}`}
                      disabled={!onUpdateSharedDraft || index === 0}
                      onClick={() => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => moveWorkflowStepUp(draft, step.id).draft);
                      }}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-step-move-down-${index}`}
                      disabled={!onUpdateSharedDraft || index >= sharedDraft.steps.length - 1}
                      onClick={() => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => moveWorkflowStepDown(draft, step.id).draft);
                      }}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-step-remove-${index}`}
                      disabled={!onUpdateSharedDraft}
                      onClick={() => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => removeWorkflowStep(draft, step.id).draft);
                      }}
                    >
                      Remove step
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {stepValidationIssues.length > 0 ? (
          <ul className="ui-stack ui-stack--2xs">
            {stepValidationIssues.map((issue, index) => (
              <li key={`${issue.code}:${issue.path ?? ""}:${index}`} className="ui-text-danger">{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </SectionBody>
    </WizardSection>
  );
}
