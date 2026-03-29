import { useEffect, useMemo, useState } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
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
  clearWorkflowStepAgentAssetSelection,
  loadAgentAssistantAssetCandidates,
  moveWorkflowStepDown,
  moveWorkflowStepUp,
  removeWorkflowStep,
  setWorkflowStepAgentAssetSelection,
  workflowStepTypeDefinitions,
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
        description="Configure ordered workflow steps and bind each step to an agent/assistant asset. This writes directly to the shared canonical workflow draft steps array."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.steps.length, "step", "steps")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Step types</strong>
          <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
            {workflowStepTypeDefinitions.map((definition) => (
              <li key={`${definition.kind ?? "none"}:${definition.type}`} className="ui-text-small">
                <strong>{definition.label}</strong>: {definition.summary}{definition.interactive ? " (active editor)" : " (future editor surface)"}
              </li>
            ))}
          </ul>
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

          {!catalog.loading && !catalog.error && catalog.assets.length === 0 ? (
            <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-step-agent-empty-state">
              <strong>No agent/assistant assets available.</strong>
              <span className="ui-text-small ui-text-secondary">
                Create an agent/assistant asset, then return to bind it to workflow steps.
              </span>
            </div>
          ) : null}
        </div>

        {sharedDraft.steps.length === 0 ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-step-empty-state">
            <strong>No workflow steps configured yet.</strong>
            <span className="ui-text-small ui-text-secondary">
              Add your first step, then choose which agent/assistant asset should execute it.
            </span>
            <div>
              <button
                type="button"
                className="ui-button ui-button--sm"
                data-testid="workflow-step-add-first"
                disabled={!onUpdateSharedDraft}
                onClick={() => {
                  if (!onUpdateSharedDraft) {
                    return;
                  }
                  onUpdateSharedDraft((draft) => addWorkflowStep(draft).draft);
                }}
              >
                Add first step
              </button>
            </div>
          </div>
        ) : (
          <div className="ui-stack ui-stack--2xs" data-testid="workflow-step-list">
            {sharedDraft.steps.map((step, index) => {
              const selectedAsset = step.assetRef?.asset;
              const selectedAssetKey = selectedAsset
                ? buildWorkflowStepAssetOptionKey({
                  assetId: selectedAsset.assetId,
                  versionId: selectedAsset.versionId,
                })
                : "";
              return (
                <article
                  key={step.id}
                  className="ui-card ui-card--padded ui-stack ui-stack--2xs"
                  data-testid={`workflow-step-row-${index}`}
                >
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                    <strong>{step.title || `Step ${index + 1}`}</strong>
                    <span className="ui-text-small ui-text-secondary">ID: {step.id}</span>
                  </div>
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

        <div>
          <button
            type="button"
            className="ui-button ui-button--sm"
            data-testid="workflow-step-add"
            disabled={!onUpdateSharedDraft}
            onClick={() => {
              if (!onUpdateSharedDraft) {
                return;
              }
              onUpdateSharedDraft((draft) => addWorkflowStep(draft).draft);
            }}
          >
            Add step
          </button>
        </div>

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
