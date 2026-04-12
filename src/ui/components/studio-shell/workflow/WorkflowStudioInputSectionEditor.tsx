import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { WorkflowDraft, WorkflowValidationIssue } from "@domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowDraftInputSourceTypes } from "@domain/workflow-studio/WorkflowStudioDomain";
import { serializeWorkflowDraft } from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  type WorkflowInputBindingSourceDescriptor,
  WorkflowInputBindingSourceKinds,
} from "@domain/workflow-studio/WorkflowInputBindingDomain";
import { previewWorkflowInputBindings } from "@application/workflow-studio/WorkflowInputBindingPreviewService";
import {
  AssetSelectorSessionLifecycleStates,
  type AssetSelectorSessionState,
} from "@application/studio-entry/AssetSelectorSessionStore";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import { RegistryService } from "../../../services/RegistryService";
import AssetSelectorShell from "../asset-selector/AssetSelectorShell";
import { getAssetSelectorSessionStore } from "../../../studio-shell/asset-selector/AssetSelectorSessionRegistry";
import type { AssetSelectorResultItem } from "../../../studio-shell/asset-selector/AssetSelectorDataProvider";
import {
  createDatasetAssetSelectorRequest,
  DatasetAssetSelectorAdapter,
} from "../../../studio-shell/asset-selector/DatasetAssetSelectorAdapter";
import { AssetSelectorStudioLaunchService } from "../../../studio-shell/asset-selector/AssetSelectorStudioLaunchService";
import { AssetSelectorReturnHandoffService } from "../../../studio-shell/asset-selector/AssetSelectorReturnHandoffService";
import {
  listDatasetInputs,
  removeDatasetInputSelection,
  replaceDatasetInputSelections,
} from "../../../studio-shell/workflow/WorkflowWizardDatasetInputs";
import {
  createDefaultBindingSource,
  createSingleSourceBinding,
  listWorkflowInputBindings,
  removeWorkflowInputBinding,
  upsertWorkflowInputBinding,
} from "../../../studio-shell/workflow/WorkflowWizardInputBindings";
import {
  WorkflowStudioHandoffFlowKinds,
  WorkflowStudioHandoffStatusKinds,
  type WorkflowStudioHandoffStatus,
} from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";

interface WorkflowStudioInputSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly onSetHandoffStatus?: (status: WorkflowStudioHandoffStatus) => void;
}

const inputTypeDefinitions = Object.freeze([
  Object.freeze({
    sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
    label: "Dataset asset",
    summary: "Selectable registry-backed dataset assets through the shared selector shell.",
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

function buildDatasetLabel(input: {
  readonly title?: string;
  readonly assetId: string;
  readonly versionId?: string;
}): string {
  const title = input.title?.trim();
  if (title && input.versionId) {
    return `${title} (${input.versionId})`;
  }
  if (title) {
    return title;
  }
  return input.versionId ? `${input.assetId} (${input.versionId})` : input.assetId;
}

const datasetSelectorTargetId = "workflow-inputs:dataset";
const datasetSelectorOriginatingField = "inputs.dataset";
const bindingSourceKinds = Object.values(WorkflowInputBindingSourceKinds);

function summarizeBindingReference(source: WorkflowInputBindingSourceDescriptor): string {
  switch (source.kind) {
    case WorkflowInputBindingSourceKinds.uiFormValue:
      return source.formKey;
    case WorkflowInputBindingSourceKinds.runtimeParameter:
      return source.parameterKey;
    case WorkflowInputBindingSourceKinds.triggerPayload:
      return source.payloadKey;
    case WorkflowInputBindingSourceKinds.selectedImage:
      return source.path ?? "assetRef";
    case WorkflowInputBindingSourceKinds.datasetInstanceReference:
      return source.instanceId ?? source.purpose ?? "";
    case WorkflowInputBindingSourceKinds.constantValue:
      return typeof source.value === "string" ? source.value : JSON.stringify(source.value);
    default:
      return "";
  }
}

export default function WorkflowStudioInputSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  studioId,
  onSetHandoffStatus,
}: WorkflowStudioInputSectionEditorProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const selectorSessionStore = useMemo(() => getAssetSelectorSessionStore(), []);
  const registryService = useMemo(() => new RegistryService(), []);
  const studioLaunchService = useMemo(() => new AssetSelectorStudioLaunchService(), []);
  const returnHandoffService = useMemo(() => new AssetSelectorReturnHandoffService(), []);
  const selectorDataProvider = useMemo(() => new DatasetAssetSelectorAdapter({
    registryService,
    limit: 50,
  }), [registryService]);
  const selectorSessionKey = useMemo(
    () => `workflow-studio:${studioId?.trim() || "default"}:inputs:dataset`,
    [studioId],
  );
  const selectorRequest = useMemo(
    () => createDatasetAssetSelectorRequest({
      requestId: `selector:${selectorSessionKey}`,
      selectionMode: "multi-select",
      minSelections: 0,
      required: false,
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
      launchSource: "wizard",
    }),
    [selectorSessionKey],
  );
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
  const lastAppliedCompletedCount = useRef<number | undefined>(undefined);

  const datasetInputs = useMemo(() => listDatasetInputs(sharedDraft), [sharedDraft]);
  const selectedDatasetAssets = useMemo(
    () => datasetInputs.map((entry) => Object.freeze({
      assetId: entry.asset.assetId,
      versionId: entry.asset.versionId,
      assetType: "dataset" as const,
      displayName: entry.title,
      taxonomy: entry.asset.taxonomy,
    })),
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
  const inputBindings = useMemo(() => listWorkflowInputBindings(sharedDraft), [sharedDraft]);
  const bindingPreview = useMemo(() => previewWorkflowInputBindings({
    bindings: inputBindings,
    context: {
      uiFormValues: Object.freeze({ sourceImage: "ui:sourceImage", stylePreset: "ui:stylePreset", instruction: "ui:instruction" }),
      selectedImage: Object.freeze({ assetRef: Object.freeze({ assetId: "asset:image:selected" }) }),
      datasetInstances: Object.freeze(datasetInputs.map((entry) => Object.freeze({
        instanceId: `instance:${entry.id}`,
        datasetAssetId: entry.asset.assetId,
        datasetVersionId: entry.asset.versionId,
        purpose: "active-input",
        records: Object.freeze([{ recordId: "record:0", value: Object.freeze({ assetRef: { assetId: entry.asset.assetId } }) }]),
      }))),
    },
  }), [datasetInputs, inputBindings]);
  const sectionHasErrors = datasetValidationIssues.length > 0;

  const launchDatasetStudioFromSelector = (): void => {
    const launch = studioLaunchService.launch({
      sessionKey: selectorSessionKey,
      selectorRequest,
      routePath: location.pathname,
      routeSearch: location.search,
      routeHash: location.hash || "#workflow-wizard-inputs",
      selectorTargetId: datasetSelectorTargetId,
      workflowOrigin: {
        studioId: workflowDraftReference.studioId,
        modeId: "wizard",
        wizardPageId: "inputs",
        draftReference: workflowDraftReference,
        draftState: serializedSharedDraft,
      },
    });
    if (!launch) {
      setSelectorNotice("Unable to open Dataset Studio from this selector request.");
      return;
    }
    onSetHandoffStatus?.({
      kind: WorkflowStudioHandoffStatusKinds.launching,
      flow: WorkflowStudioHandoffFlowKinds.datasetInput,
      updatedAt: Date.now(),
      handoffId: launch.studioHandoff?.launch.handoffId,
      selectorSessionKey,
      selectorTargetId: datasetSelectorTargetId,
      detail: "Launching Dataset Studio for workflow inputs.",
    });
    selectorSessionStore.transitionToCreatingNew(selectorSessionKey, {
      originatingContext: selectorRequest.context,
      requestedAssetType: selectorRequest.assetType,
      returnTargetSessionKey: selectorSessionKey,
      returnRoutePath: launch.returnTarget?.routePath,
      launchHandoffId: launch.studioHandoff?.launch.handoffId,
    });
    onSetHandoffStatus?.({
      kind: WorkflowStudioHandoffStatusKinds.pending,
      flow: WorkflowStudioHandoffFlowKinds.datasetInput,
      updatedAt: Date.now(),
      handoffId: launch.studioHandoff?.launch.handoffId,
      selectorSessionKey,
      selectorTargetId: datasetSelectorTargetId,
      detail: "Waiting for Dataset Studio handoff return.",
    });
    setSelectorNotice(undefined);
    void navigate(launch.launchPath);
  };

  useEffect(() => {
    const existing = selectorSessionStore.getSession(selectorSessionKey);
    if (!existing) {
      selectorSessionStore.prepareSession({
        sessionKey: selectorSessionKey,
        request: selectorRequest,
        initialSelectedAssets: selectedDatasetAssets,
      });
    }

    if (selectorSessionStore.getSession(selectorSessionKey)?.lifecycleState === AssetSelectorSessionLifecycleStates.idle) {
      selectorSessionStore.activateSession(selectorSessionKey);
    }

    const unsubscribe = selectorSessionStore.subscribe(selectorSessionKey, setSelectorState);
    return unsubscribe;
  }, [selectedDatasetAssets, selectorRequest, selectorSessionKey, selectorSessionStore]);

  useEffect(() => {
    const existing = selectorSessionStore.getSession(selectorSessionKey);
    if (!existing) {
      return;
    }
    selectorSessionStore.replaceSelections(selectorSessionKey, selectedDatasetAssets);
  }, [selectedDatasetAssets, selectorSessionKey, selectorSessionStore]);

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
      expectedSelectorTargetId: datasetSelectorTargetId,
      expectedOriginatingField: datasetSelectorOriginatingField,
      expectedUsageContext: "workflow-input",
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
          description: "Created in Dataset Studio",
          badges: Object.freeze(["dataset", "new"]),
          asset: outcome.returnedAsset,
        });
        return Object.freeze([nextItem, ...current]);
      });
      setQueryRevision((current) => current + 1);
      setSelectorNotice(undefined);
      setSelectorOpen(true);
      onSetHandoffStatus?.({
        kind: WorkflowStudioHandoffStatusKinds.completed,
        flow: WorkflowStudioHandoffFlowKinds.datasetInput,
        updatedAt: Date.now(),
        handoffId: selectorState?.creatingNewContext?.launchHandoffId,
        selectorSessionKey,
        selectorTargetId: datasetSelectorTargetId,
        outcomeKind: "created",
        assetId: outcome.returnedAsset.assetId,
        assetDisplayName: outcome.returnedAsset.displayName,
      });
    }

    if (
      outcome.outcomeKind === "cancelled"
      || outcome.outcomeKind === "no-selection"
      || outcome.outcomeKind === "abandoned"
    ) {
      setSelectorNotice("Dataset handoff ended without a returned asset. Existing workflow inputs were preserved.");
      setSelectorOpen(false);
      onSetHandoffStatus?.({
        kind: WorkflowStudioHandoffStatusKinds.cancelled,
        flow: WorkflowStudioHandoffFlowKinds.datasetInput,
        updatedAt: Date.now(),
        handoffId: selectorState?.creatingNewContext?.launchHandoffId,
        selectorSessionKey,
        selectorTargetId: datasetSelectorTargetId,
        outcomeKind: outcome.outcomeKind,
      });
    }

    if (outcome.outcomeKind === "created" && !outcome.returnedAsset) {
      onSetHandoffStatus?.({
        kind: WorkflowStudioHandoffStatusKinds.recovered,
        flow: WorkflowStudioHandoffFlowKinds.datasetInput,
        updatedAt: Date.now(),
        handoffId: selectorState?.creatingNewContext?.launchHandoffId,
        selectorSessionKey,
        selectorTargetId: datasetSelectorTargetId,
        outcomeKind: "created",
      });
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
    selectorState?.creatingNewContext?.launchHandoffId,
    onSetHandoffStatus,
  ]);

  useEffect(() => {
    if (!selectorState || !onUpdateSharedDraft) {
      return;
    }

    const completedCount = selectorState.lifecycleHistory.filter(
      (entry) => entry === AssetSelectorSessionLifecycleStates.completed,
    ).length;
    if (lastAppliedCompletedCount.current === undefined) {
      lastAppliedCompletedCount.current = completedCount;
      return;
    }
    if (completedCount <= lastAppliedCompletedCount.current) {
      return;
    }
    lastAppliedCompletedCount.current = completedCount;

    onUpdateSharedDraft((draft) => replaceDatasetInputSelections(
      draft,
      selectorState.selectedAssets.map((entry) => Object.freeze({
        assetId: entry.assetId,
        versionId: entry.versionId,
        name: entry.displayName,
      })),
    ).draft);
    setSelectorOpen(false);
  }, [onUpdateSharedDraft, selectorState]);

  const stateForShell = selectorState ?? selectorSessionStore.getSession(selectorSessionKey);
  const shellItems = useMemo(() => {
    const byId = new Map<string, AssetSelectorResultItem>();
    for (const item of returnedItems) {
      byId.set(item.id, item);
    }
    for (const item of items) {
      byId.set(item.id, item);
    }
    return Object.freeze([...byId.values()]);
  }, [items, returnedItems]);
  const unavailableDatasetInputs = useMemo(() => {
    if (searchTerm.trim().length > 0 || loading || Boolean(queryError)) {
      return Object.freeze([] as typeof datasetInputs);
    }
    const availableAssetIds = new Set(shellItems.map((item) => item.asset.assetId));
    return Object.freeze(datasetInputs.filter((entry) => !availableAssetIds.has(entry.asset.assetId)));
  }, [datasetInputs, loading, queryError, searchTerm, shellItems]);

  return (
    <WizardSection sectionId="workflow-wizard-inputs" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Inputs Section"
        description="Configure workflow inputs from canonical asset-backed sources. Dataset selection now uses the shared selector shell and shared selector session state."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.inputs.length, "input", "inputs")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Dataset inputs</strong>
          {datasetInputs.length === 0 ? (
            <span className="ui-text-small ui-text-secondary">No datasets attached yet.</span>
          ) : (
            <div className="ui-stack ui-stack--2xs" data-testid="workflow-input-dataset-list">
              {datasetInputs.map((input) => (
                <div key={input.id} className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                  <div className="ui-stack ui-stack--2xs">
                    <span className="ui-text-small"><strong>{buildDatasetLabel({
                      title: input.title,
                      assetId: input.asset.assetId,
                      versionId: input.asset.versionId,
                    })}</strong></span>
                    <span className="ui-text-small ui-text-secondary">{input.asset.assetId}</span>
                  </div>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={!onUpdateSharedDraft}
                    data-testid={`workflow-input-remove-dataset-${input.id}`}
                    onClick={() => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => removeDatasetInputSelection(draft, input.asset.assetId).draft);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="ui-button ui-button--sm"
              data-testid="workflow-input-open-selector"
              onClick={() => {
                selectorSessionStore.activateSession(selectorSessionKey);
                selectorSessionStore.setPendingSelections(selectorSessionKey, selectedDatasetAssets);
                setSelectorOpen((current) => !current || datasetInputs.length === 0);
              }}
            >
              {selectorOpen ? "Selector open" : "Add or modify datasets"}
            </button>
            {selectorOpen ? (
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                data-testid="workflow-input-close-selector"
                onClick={() => {
                  selectorSessionStore.activateSession(selectorSessionKey);
                  selectorSessionStore.setPendingSelections(selectorSessionKey, selectedDatasetAssets);
                  setSelectorOpen(false);
                }}
              >
                Close selector
              </button>
            ) : null}
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              data-testid="workflow-input-launch-dataset-studio"
              onClick={() => {
                selectorSessionStore.activateSession(selectorSessionKey);
                selectorSessionStore.setPendingSelections(selectorSessionKey, selectedDatasetAssets);
                launchDatasetStudioFromSelector();
              }}
            >
              Create dataset in Dataset Studio
            </button>
          </div>
        </div>

        {selectorOpen && stateForShell ? (
          <AssetSelectorShell
            title="Dataset inputs"
            state={stateForShell}
            searchTerm={searchTerm}
            items={shellItems}
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
              selectorSessionStore.activateSession(selectorSessionKey);
              selectorSessionStore.setPendingSelections(selectorSessionKey, selectedDatasetAssets);
              setSelectorOpen(false);
            }}
            onCreateNew={() => {
              launchDatasetStudioFromSelector();
            }}
            onRetry={() => {
              setQueryRevision((current) => current + 1);
            }}
          />
        ) : null}

        {selectorNotice ? (
          <div className="ui-text-small ui-text-secondary" data-testid="workflow-input-dataset-create-stub-notice">
            {selectorNotice}
          </div>
        ) : null}

        {unavailableDatasetInputs.length > 0 ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-input-unavailable-datasets">
            <strong>Unavailable datasets</strong>
            <span className="ui-text-small ui-text-secondary">
              Some attached datasets are no longer available in the registry. Remove or replace them before run preparation.
            </span>
            <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
              {unavailableDatasetInputs.map((entry) => (
                <li key={`missing-${entry.id}`} className="ui-text-small ui-text-danger">
                  {buildDatasetLabel({
                    title: entry.title,
                    assetId: entry.asset.assetId,
                    versionId: entry.asset.versionId,
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-input-binding-authoring">
          <strong>Input binding authoring</strong>
          <span className="ui-text-small ui-text-secondary">
            Configure explicit workflow input bindings using canonical source kinds and inspect validation/preview results.
          </span>
          {sharedDraft.inputs.length === 0 ? (
            <span className="ui-text-small ui-text-secondary">Add workflow inputs before authoring bindings.</span>
          ) : (
            <div className="ui-stack ui-stack--2xs">
              {sharedDraft.inputs.map((input) => {
                const existing = inputBindings.find((entry) => entry.inputId === input.id);
                const source = existing?.sources[0];
                const previewItem = bindingPreview.items.find((item) => item.inputId === input.id);
                const sourceKind = source?.kind ?? WorkflowInputBindingSourceKinds.runtimeParameter;
                const sourceReference = source ? summarizeBindingReference(source) : input.id;
                return (
                  <div key={`binding-${input.id}`} className="ui-card ui-card--flat ui-stack ui-stack--2xs">
                    <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                      <strong>{input.title?.trim() || input.id}</strong>
                      <span className="ui-text-small ui-text-secondary">{input.id}</span>
                    </div>
                    <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem", alignItems: "flex-end" }}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Source type</span>
                        <select
                          className="ui-input"
                          value={sourceKind}
                          data-testid={`workflow-input-binding-source-kind-${input.id}`}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const nextSource = createDefaultBindingSource({
                              inputId: input.id,
                              kind: event.target.value as WorkflowInputBindingSourceDescriptor["kind"],
                              reference: sourceReference,
                            });
                            onUpdateSharedDraft((draft) => upsertWorkflowInputBinding(draft, createSingleSourceBinding({
                              inputId: input.id,
                              required: input.required,
                              valueType: input.valueType,
                              source: nextSource,
                            })));
                          }}
                        >
                          {bindingSourceKinds.map((kind) => (
                            <option key={`${input.id}:${kind}`} value={kind}>{kind}</option>
                          ))}
                        </select>
                      </label>
                      <label className="ui-stack ui-stack--2xs" style={{ minWidth: "14rem", flex: "1 1 14rem" }}>
                        <span className="ui-text-small">Source reference</span>
                        <input
                          className="ui-input"
                          value={sourceReference}
                          data-testid={`workflow-input-binding-source-reference-${input.id}`}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const nextSource = createDefaultBindingSource({
                              inputId: input.id,
                              kind: sourceKind,
                              reference: event.target.value,
                            });
                            onUpdateSharedDraft((draft) => upsertWorkflowInputBinding(draft, createSingleSourceBinding({
                              inputId: input.id,
                              required: input.required,
                              valueType: input.valueType,
                              source: nextSource,
                            })));
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        data-testid={`workflow-input-binding-clear-${input.id}`}
                        onClick={() => {
                          if (!onUpdateSharedDraft) {
                            return;
                          }
                          onUpdateSharedDraft((draft) => removeWorkflowInputBinding(draft, input.id));
                        }}
                      >
                        Clear binding
                      </button>
                    </div>
                    <div className="ui-text-small ui-text-secondary">
                      Validation: {previewItem?.diagnostics.length ? `${previewItem.diagnostics.length} issue(s)` : "no issues"} Â·
                      Preview: {previewItem?.resolved ? `${previewItem.valueSummary?.summary ?? "resolved"}` : "unresolved"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {bindingPreview.diagnostics.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs">
              {bindingPreview.diagnostics.map((diagnostic, index) => (
                <li key={`binding-diagnostic-${diagnostic.bindingId}-${index}`} className={diagnostic.severity === "error" ? "ui-text-danger" : "ui-text-small"}>
                  {diagnostic.bindingId}: {diagnostic.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

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

