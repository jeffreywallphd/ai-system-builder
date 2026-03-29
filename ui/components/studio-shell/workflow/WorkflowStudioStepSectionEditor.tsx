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
  buildWorkflowStepAssetOptionKey,
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
  type WorkflowStepAgentAssetCandidate,
} from "../../../studio-shell/workflow/WorkflowWizardSteps";

interface WorkflowStudioStepSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
}

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function buildAgentAssetLabel(asset: WorkflowStepAgentAssetCandidate): string {
  const base = asset.name?.trim() || asset.assetId;
  return asset.versionId ? `${base} (${asset.versionId})` : base;
}

function buildStepTypeBadgeLabel(selectionKind: string): string {
  return selectionKind === WorkflowWizardStepSelectionKinds.assetBacked ? "Asset-backed" : "Built-in";
}

function countCompletedStates(state: AssetSelectorSessionState): number {
  return state.lifecycleHistory.filter((entry) => entry === AssetSelectorSessionLifecycleStates.completed).length;
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

  const stepCatalogAssets = useMemo<ReadonlyArray<WorkflowStepAgentAssetCandidate>>(
    () => Object.freeze(selectorItems.map((item) => Object.freeze({
      assetId: item.asset.assetId,
      versionId: item.asset.versionId,
      name: item.asset.displayName ?? item.title,
    }))),
    [selectorItems],
  );

  const stepAssetOptionByKey = useMemo(() => {
    const map = new Map<string, WorkflowStepAgentAssetCandidate>();
    for (const asset of stepCatalogAssets) {
      map.set(buildWorkflowStepAssetOptionKey(asset), asset);
    }
    return map;
  }, [stepCatalogAssets]);

  const addableDefinitions = useMemo(
    () => workflowStepTypeDefinitions.filter((definition) => definition.interactive),
    [],
  );

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

    onUpdateSharedDraft((draft) => {
      const added = addWorkflowStep(draft, defaultAgentAssistantStepDefinition);
      return setWorkflowStepAgentAssetSelection(added.draft, added.stepId, {
        assetId: selectedAsset.assetId,
        versionId: selectedAsset.versionId,
        name: selectedAsset.displayName,
      }).draft;
    });
  }, [onUpdateSharedDraft, selectorState]);

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
                  onUpdateSharedDraft((draft) => addWorkflowStep(draft, definition).draft);
                }}
              >
                {definition.label}
              </button>
            ))}
          </div>
        </div>

        {stateForShell ? (
          <AssetSelectorShell
            title="Agent/assistant selector"
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
            }}
            onCreateNew={() => {
              const launch = studioLaunchService.launch({
                sessionKey: selectorSessionKey,
                selectorRequest,
                routePath: location.pathname,
                routeSearch: location.search,
                routeHash: location.hash || "#workflow-wizard-steps",
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
              const selectedAssetKey = selectedAsset
                ? buildWorkflowStepAssetOptionKey({
                  assetId: selectedAsset.assetId,
                  versionId: selectedAsset.versionId,
                })
                : "";
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
                      <div className="ui-text-small">
                        Selected asset: {selectedAsset ? buildAgentAssetLabel({
                          assetId: selectedAsset.assetId,
                          versionId: selectedAsset.versionId,
                        }) : "None selected"}
                      </div>

                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Agent/assistant asset</span>
                        <select
                          className="ui-select"
                          data-testid={`workflow-step-asset-select-${index}`}
                          value={selectedAssetKey}
                          disabled={!onUpdateSharedDraft || stepCatalogAssets.length === 0}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const nextAsset = stepAssetOptionByKey.get(event.target.value);
                            if (!nextAsset) {
                              onUpdateSharedDraft((draft) => clearWorkflowStepAgentAssetSelection(draft, step.id).draft);
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowStepAgentAssetSelection(draft, step.id, nextAsset).draft);
                          }}
                        >
                          <option value="">None selected</option>
                          {stepCatalogAssets.map((asset) => (
                            <option key={buildWorkflowStepAssetOptionKey(asset)} value={buildWorkflowStepAssetOptionKey(asset)}>
                              {buildAgentAssetLabel(asset)}
                            </option>
                          ))}
                        </select>
                      </label>
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
