import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowDraftInputSourceTypes } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
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
  createDatasetAssetSelectorRequest,
  DatasetAssetSelectorAdapter,
} from "../../../studio-shell/asset-selector/DatasetAssetSelectorAdapter";
import {
  listDatasetInputs,
  replaceDatasetInputSelections,
} from "../../../studio-shell/workflow/WorkflowWizardDatasetInputs";

interface WorkflowStudioInputSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
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

export default function WorkflowStudioInputSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  studioId,
}: WorkflowStudioInputSectionEditorProps): JSX.Element {
  const selectorSessionStore = useMemo(() => getAssetSelectorSessionStore(), []);
  const registryService = useMemo(() => new RegistryService(), []);
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

  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<ReadonlyArray<AssetSelectorResultItem>>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | undefined>(undefined);
  const [queryRevision, setQueryRevision] = useState(0);
  const [createDatasetStubNotice, setCreateDatasetStubNotice] = useState<string | undefined>(undefined);
  const [selectorState, setSelectorState] = useState<AssetSelectorSessionState | undefined>(
    () => selectorSessionStore.getSession(selectorSessionKey),
  );
  const lastSyncedSelectionSignature = useRef<string>("");

  const datasetInputs = useMemo(() => listDatasetInputs(sharedDraft), [sharedDraft]);
  const otherInputs = useMemo(
    () => sharedDraft.inputs.filter((entry) => entry.sourceType !== WorkflowDraftInputSourceTypes.datasetAsset),
    [sharedDraft.inputs],
  );
  const datasetValidationIssues = useMemo(
    () => draftValidationIssues.filter((issue) => issue.path?.startsWith("draft.inputs[")),
    [draftValidationIssues],
  );
  const sectionHasErrors = datasetValidationIssues.length > 0;

  useEffect(() => {
    const existing = selectorSessionStore.getSession(selectorSessionKey);
    if (!existing) {
      selectorSessionStore.prepareSession({
        sessionKey: selectorSessionKey,
        request: selectorRequest,
        initialSelectedAssets: datasetInputs.map((entry) => Object.freeze({
          assetId: entry.asset.assetId,
          versionId: entry.asset.versionId,
          assetType: "dataset" as const,
          displayName: entry.title,
          taxonomy: entry.asset.taxonomy,
        })),
      });
    }

    if (selectorSessionStore.getSession(selectorSessionKey)?.lifecycleState === AssetSelectorSessionLifecycleStates.idle) {
      selectorSessionStore.activateSession(selectorSessionKey);
    }

    const unsubscribe = selectorSessionStore.subscribe(selectorSessionKey, setSelectorState);
    return unsubscribe;
  }, [datasetInputs, selectorRequest, selectorSessionKey, selectorSessionStore]);

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
    if (!selectorState || !onUpdateSharedDraft) {
      return;
    }
    if (selectorState.lifecycleState !== AssetSelectorSessionLifecycleStates.completed) {
      return;
    }

    const selectionSignature = selectorState.selectedAssets
      .map((entry) => `${entry.assetId}:${entry.versionId ?? ""}`)
      .sort()
      .join("|");
    if (selectionSignature === lastSyncedSelectionSignature.current) {
      return;
    }

    lastSyncedSelectionSignature.current = selectionSignature;
    onUpdateSharedDraft((draft) => replaceDatasetInputSelections(
      draft,
      selectorState.selectedAssets.map((entry) => Object.freeze({
        assetId: entry.assetId,
        versionId: entry.versionId,
        name: entry.displayName,
      })),
    ).draft);
  }, [onUpdateSharedDraft, selectorState]);

  const stateForShell = selectorState ?? selectorSessionStore.getSession(selectorSessionKey);

  return (
    <WizardSection sectionId="workflow-wizard-inputs" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Inputs Section"
        description="Configure workflow inputs from canonical asset-backed sources. Dataset selection now uses the shared selector shell and shared selector session state."
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

        {stateForShell ? (
          <AssetSelectorShell
            title="Dataset inputs"
            state={stateForShell}
            searchTerm={searchTerm}
            items={items}
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
              selectorSessionStore.transitionToCreatingNew(selectorSessionKey);
              setCreateDatasetStubNotice("Create new dataset is stubbed in Story 4.5. Studio handoff is implemented in a later story.");
            }}
            onRetry={() => {
              setQueryRevision((current) => current + 1);
            }}
          />
        ) : null}

        {createDatasetStubNotice ? (
          <div className="ui-text-small ui-text-secondary" data-testid="workflow-input-dataset-create-stub-notice">
            {createDatasetStubNotice}
          </div>
        ) : null}

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
