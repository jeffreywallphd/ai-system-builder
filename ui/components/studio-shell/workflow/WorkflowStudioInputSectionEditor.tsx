import { useEffect, useMemo, useState } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowDraftInputSourceTypes } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import { RegistryService } from "../../../services/RegistryService";
import { ROUTE_PATHS } from "../../../routes/RouteConfig";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
} from "../../../routes/InlineAssetCreation";
import {
  applyInlineDatasetReturnToDraft,
  listDatasetInputs,
  removeDatasetInputSelection,
  toggleDatasetInputSelection,
  type WorkflowDatasetAssetCandidate,
} from "../../../studio-shell/workflow/WorkflowWizardDatasetInputs";

interface WorkflowStudioInputSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly routeSearch?: string;
  readonly onReplaceRouteSearch?: (nextSearch: string) => void;
}

interface DatasetCatalogState {
  readonly loading: boolean;
  readonly assets: ReadonlyArray<WorkflowDatasetAssetCandidate>;
  readonly error?: string;
}

const inputTypeDefinitions = Object.freeze([
  Object.freeze({
    sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
    label: "Dataset asset",
    summary: "Selectable registry-backed dataset assets.",
    interactive: true,
  }),
  Object.freeze({
    sourceType: WorkflowDraftInputSourceTypes.runtimeParameter,
    label: "Runtime parameter",
    summary: "Runtime-provided values passed at execution time.",
    interactive: false,
  }),
  Object.freeze({
    sourceType: WorkflowDraftInputSourceTypes.staticValue,
    label: "Static value",
    summary: "Inline literal values embedded in the workflow draft.",
    interactive: false,
  }),
]);

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function buildDatasetLabel(asset: WorkflowDatasetAssetCandidate): string {
  const base = asset.name?.trim() || asset.assetId;
  return asset.versionId ? `${base} (${asset.versionId})` : base;
}

function toDatasetCandidate(asset: {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name: string;
}): WorkflowDatasetAssetCandidate {
  return Object.freeze({
    assetId: asset.assetId,
    versionId: asset.versionId,
    name: asset.name,
  });
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

export default function WorkflowStudioInputSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  studioId,
  routeSearch = "",
  onReplaceRouteSearch,
}: WorkflowStudioInputSectionEditorProps): JSX.Element {
  const registryService = useMemo(() => new RegistryService(), []);
  const inlineAssetCreationService = useMemo(() => new InlineAssetCreationService(), []);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<DatasetCatalogState>({
    loading: true,
    assets: Object.freeze([]),
  });

  const datasetInputs = useMemo(() => listDatasetInputs(sharedDraft), [sharedDraft]);
  const datasetSelectionByAssetId = useMemo(
    () => new Map(datasetInputs.map((entry) => [entry.asset.assetId, entry])),
    [datasetInputs],
  );
  const otherInputs = useMemo(
    () => sharedDraft.inputs.filter((entry) => entry.sourceType !== WorkflowDraftInputSourceTypes.datasetAsset),
    [sharedDraft.inputs],
  );
  const datasetValidationIssues = useMemo(
    () => draftValidationIssues.filter((issue) => issue.path?.startsWith("draft.inputs[")),
    [draftValidationIssues],
  );
  const sectionHasErrors = datasetValidationIssues.length > 0;

  const inlineReturn = useMemo(
    () => inlineAssetCreationService.parseInlineReturnFromSearch(routeSearch),
    [inlineAssetCreationService, routeSearch],
  );

  const createDatasetLaunchPath = useMemo(() => {
    const returnTargetPath = `${ROUTE_PATHS.workflowStudioMode.replace(":modeId", "wizard")}${sanitizeSearchForReturn(routeSearch)}#workflow-wizard-inputs`;
    return inlineAssetCreationService.launch({
      requestedStudioType: "dataset-studio",
      requestedRole: "dataset",
      mode: InlineAssetCreationModes.inlineContext,
      context: {
        source: "studio-shell",
        sourceIntentKey: "create-workflow-input-dataset",
        sourceIntentLabel: "Create dataset input",
        sourceMetadata: {
          sourceStudio: "workflow-studio",
          sourceSection: "inputs",
        },
      },
      returnTarget: {
        routePath: returnTargetPath,
        contextId: studioId,
      },
    })?.launchPath;
  }, [inlineAssetCreationService, routeSearch, studioId]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setCatalog((current) => ({ ...current, loading: true, error: undefined }));
      const keyword = query.trim();
      const response = keyword.length > 0
        ? await registryService.searchAssets({
          keyword,
          structuralKinds: ["atomic"],
          semanticRoles: ["dataset"],
          behaviorKinds: ["none"],
          limit: 50,
        })
        : await registryService.filterAssets({
          structuralKinds: ["atomic"],
          semanticRoles: ["dataset"],
          behaviorKinds: ["none"],
          limit: 50,
        });

      if (!active) {
        return;
      }

      if (!response.ok || !response.data) {
        setCatalog({
          loading: false,
          assets: Object.freeze([]),
          error: response.error?.message ?? "Unable to load dataset assets.",
        });
        return;
      }

      setCatalog({
        loading: false,
        assets: Object.freeze(response.data.map((asset) => toDatasetCandidate(asset))),
      });
    };

    void load();
    return () => {
      active = false;
    };
  }, [query, registryService]);

  useEffect(() => {
    if (!inlineReturn) {
      return;
    }

    if (onUpdateSharedDraft) {
      onUpdateSharedDraft((draft) => applyInlineDatasetReturnToDraft(draft, {
        status: inlineReturn.status,
        assetId: inlineReturn.assetId,
        versionId: inlineReturn.versionId,
      }).draft);
    }

    const nextSearch = inlineAssetCreationService.stripInlineReturnFromSearch(routeSearch);
    if (nextSearch === routeSearch) {
      return;
    }

    onReplaceRouteSearch?.(nextSearch);
  }, [inlineAssetCreationService, inlineReturn, onReplaceRouteSearch, onUpdateSharedDraft, routeSearch]);

  return (
    <WizardSection sectionId="workflow-wizard-inputs" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Inputs Section"
        description="Configure workflow inputs from canonical asset-backed sources. Dataset selection is interactive in this slice and writes directly to the shared workflow draft inputs array."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.inputs.length, "input", "inputs")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Input types</strong>
          <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
            {inputTypeDefinitions.map((entry) => (
              <li key={entry.sourceType} className="ui-text-small">
                <strong>{entry.label}</strong>: {entry.summary}{entry.interactive ? " (active editor)" : " (future editor surface)"}
              </li>
            ))}
          </ul>
        </div>

        <div className="ui-stack ui-stack--2xs">
          <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
            <strong>Dataset asset inputs ({datasetInputs.length})</strong>
            {createDatasetLaunchPath ? (
              <a
                className="ui-button ui-button--ghost ui-button--sm"
                href={createDatasetLaunchPath}
                data-testid="workflow-input-create-dataset-link"
              >
                Create new dataset
              </a>
            ) : (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled>
                Create new dataset
              </button>
            )}
          </div>

          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small">Search datasets</span>
            <input
              className="ui-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dataset assets"
              data-testid="workflow-input-dataset-search"
            />
          </label>

          {catalog.loading ? <span className="ui-text-small ui-text-secondary">Loading dataset assets...</span> : null}
          {catalog.error ? <span className="ui-text-small ui-text-danger">{catalog.error}</span> : null}

          {!catalog.loading && !catalog.error && catalog.assets.length === 0 ? (
            <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-input-dataset-empty-state">
              <strong>No dataset assets available.</strong>
              <span className="ui-text-small ui-text-secondary">
                Create a dataset in Dataset Studio, then return here to continue configuring workflow inputs.
              </span>
            </div>
          ) : null}

          {datasetInputs.length > 0 ? (
            <div className="ui-stack ui-stack--2xs" data-testid="workflow-input-selected-datasets">
              <span className="ui-text-small ui-text-secondary">Selected datasets</span>
              <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
                {datasetInputs.map((input, index) => (
                  <button
                    key={`${input.asset.assetId}:${input.asset.versionId ?? ""}:${index}`}
                    type="button"
                    className="ui-badge"
                    data-testid={`workflow-input-selected-dataset-${index}`}
                    disabled={!onUpdateSharedDraft}
                    onClick={() => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => removeDatasetInputSelection(draft, input.asset.assetId).draft);
                    }}
                  >
                    {buildDatasetLabel({ assetId: input.asset.assetId, versionId: input.asset.versionId, name: input.title })} x
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="ui-text-muted">No dataset inputs selected yet.</p>
          )}

          {catalog.assets.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
              {catalog.assets.map((asset, index) => {
                const selected = datasetSelectionByAssetId.has(asset.assetId);
                return (
                  <li key={`${asset.assetId}:${asset.versionId ?? ""}`}>
                    <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                      <span className="ui-text-small">{buildDatasetLabel(asset)}</span>
                      <button
                        type="button"
                        className={`ui-button ui-button--sm ${selected ? "ui-button--ghost" : ""}`}
                        data-testid={`workflow-input-dataset-toggle-${index}`}
                        disabled={!onUpdateSharedDraft}
                        onClick={() => {
                          if (!onUpdateSharedDraft) {
                            return;
                          }
                          onUpdateSharedDraft((draft) => toggleDatasetInputSelection(draft, asset).draft);
                        }}
                      >
                        {selected ? "Remove" : "Add"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {otherInputs.length > 0 ? (
          <div className="ui-stack ui-stack--2xs">
            <strong>Other input types ({otherInputs.length})</strong>
            <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
              {otherInputs.map((input) => (
                <li key={input.id} className="ui-text-small">
                  {input.id}: {input.sourceType}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {datasetValidationIssues.length > 0 ? (
          <ul className="ui-stack ui-stack--2xs">
            {datasetValidationIssues.map((issue, index) => (
              <li key={`${issue.code}:${issue.path ?? ""}:${index}`} className="ui-text-danger">{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </SectionBody>
    </WizardSection>
  );
}
