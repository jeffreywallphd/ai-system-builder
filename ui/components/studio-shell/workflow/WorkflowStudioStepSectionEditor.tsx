import { useEffect, useMemo, useState } from "react";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepTypes,
  type WorkflowDraft,
  type WorkflowDraftDelayWaitStepConfig,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraftLoopIterationStepConfig,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { RegistryService } from "../../../services/RegistryService";
import { ROUTE_PATHS } from "../../../routes/RouteConfig";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
} from "../../../routes/InlineAssetCreation";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import {
  addWorkflowStep,
  buildWorkflowStepAssetOptionKey,
  buildWorkflowStepTypeDefinitionKey,
  clearWorkflowStepAgentAssetSelection,
  getWorkflowStepTypeDefinitionByKey,
  loadAgentAssistantAssetCandidates,
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
  type WorkflowStepAssetCatalogService,
} from "../../../studio-shell/workflow/WorkflowWizardSteps";

interface WorkflowStudioStepSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly routeSearch?: string;
}

interface StepAssetCatalogState {
  readonly loading: boolean;
  readonly assets: ReadonlyArray<WorkflowStepAgentAssetCandidate>;
  readonly error?: string;
}

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function buildAgentAssetLabel(asset: WorkflowStepAgentAssetCandidate): string {
  const base = asset.name?.trim() || asset.assetId;
  return asset.versionId ? `${base} (${asset.versionId})` : base;
}

function sanitizeSearchForReturn(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("inlineCreate");
  params.delete("inlineMode");
  params.delete("inlineOrigin");
  params.delete("returnTo");
  params.delete("returnContextId");
  params.delete("inlineReturn");
  params.delete("inlineStatus");
  params.delete("inlineAssetId");
  params.delete("inlineVersionId");
  params.delete("inlineSourceStudioType");
  params.delete("inlineSourceStudioId");
  params.set("mode", "wizard");
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

function buildStepTypeBadgeLabel(selectionKind: string): string {
  return selectionKind === WorkflowWizardStepSelectionKinds.assetBacked ? "Asset-backed" : "Built-in";
}

export default function WorkflowStudioStepSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  studioId,
  routeSearch = "",
}: WorkflowStudioStepSectionEditorProps): JSX.Element {
  const assetCatalogService = useMemo<WorkflowStepAssetCatalogService>(() => new RegistryService(), []);
  const inlineAssetCreationService = useMemo(() => new InlineAssetCreationService(), []);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<StepAssetCatalogState>({
    loading: true,
    assets: Object.freeze([]),
  });

  const stepValidationIssues = useMemo(
    () => draftValidationIssues.filter((issue) => issue.section === "steps" || issue.path?.startsWith("draft.steps")),
    [draftValidationIssues],
  );
  const sectionHasErrors = stepValidationIssues.some((issue) => issue.severity === "error");

  const createAgentLaunchPath = useMemo(() => {
    const returnTargetPath = `${ROUTE_PATHS.workflowStudioMode.replace(":modeId", "wizard")}${sanitizeSearchForReturn(routeSearch)}#workflow-wizard-steps`;
    return inlineAssetCreationService.launch({
      requestedRole: "agent",
      mode: InlineAssetCreationModes.inlineContext,
      context: {
        source: "studio-shell",
        sourceIntentKey: "create-workflow-step-agent",
        sourceIntentLabel: "Create workflow step agent",
        sourceMetadata: {
          sourceStudio: "workflow-studio",
          sourceSection: "steps",
        },
      },
      returnTarget: {
        routePath: returnTargetPath,
        contextId: studioId,
      },
    })?.launchPath;
  }, [inlineAssetCreationService, routeSearch, studioId]);

  const stepAssetOptionByKey = useMemo(() => {
    const map = new Map<string, WorkflowStepAgentAssetCandidate>();
    for (const asset of catalog.assets) {
      map.set(buildWorkflowStepAssetOptionKey(asset), asset);
    }
    return map;
  }, [catalog.assets]);

  const addableDefinitions = useMemo(
    () => workflowStepTypeDefinitions.filter((definition) => definition.interactive),
    [],
  );

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setCatalog((current) => ({ ...current, loading: true, error: undefined }));
      const result = await loadAgentAssistantAssetCandidates(assetCatalogService, query);
      if (!active) {
        return;
      }
      setCatalog({
        loading: false,
        assets: result.assets,
        error: result.error,
      });
    };

    void load();
    return () => {
      active = false;
    };
  }, [assetCatalogService, query]);

  return (
    <WizardSection sectionId="workflow-wizard-steps" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Steps Section"
        description="Configure ordered workflow steps and choose either asset-backed actions or built-in workflow logic. All edits write directly to canonical workflow draft steps."
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

        <div className="ui-stack ui-stack--2xs">
          <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
            <strong>Agent/assistant asset catalog</strong>
            {createAgentLaunchPath ? (
              <a
                className="ui-button ui-button--ghost ui-button--sm"
                href={createAgentLaunchPath}
                data-testid="workflow-step-create-agent-link"
              >
                Create new agent/assistant
              </a>
            ) : (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled>
                Create new agent/assistant
              </button>
            )}
          </div>

          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small">Search agent/assistant assets</span>
            <input
              className="ui-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agent/assistant assets"
              data-testid="workflow-step-agent-search"
            />
          </label>

          {catalog.loading ? <span className="ui-text-small ui-text-secondary">Loading agent/assistant assets...</span> : null}
          {catalog.error ? <span className="ui-text-small ui-text-danger">{catalog.error}</span> : null}
        </div>

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
                          disabled={!onUpdateSharedDraft || catalog.assets.length === 0}
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
                          {catalog.assets.map((asset) => (
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
