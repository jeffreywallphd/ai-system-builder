import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowDraftInputSourceTypes } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
} from "../../../../domain/studio-shell/AssetSelectorContract";
import { AssetSelectorUsageContexts } from "../../../../application/studio-entry/AssetSelectorCapabilityRegistry";
import {
  AssetSelectorSessionLifecycleStates,
  type AssetSelectorSessionState,
} from "../../../../application/studio-entry/AssetSelectorSessionStore";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import { RegistryService } from "../../../services/RegistryService";
import { ROUTE_PATHS } from "../../../routes/RouteConfig";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
} from "../../../routes/InlineAssetCreation";
import AssetSelectorShell from "../asset-selector/AssetSelectorShell";
import { getAssetSelectorSessionStore } from "../../../studio-shell/asset-selector/AssetSelectorSessionRegistry";
import { RegistryAssetSelectorDataProvider } from "../../../studio-shell/asset-selector/RegistryAssetSelectorDataProvider";
import type { AssetSelectorResultItem } from "../../../studio-shell/asset-selector/AssetSelectorDataProvider";
import {
  listDatasetInputs,
  replaceDatasetInputSelections,
} from "../../../studio-shell/workflow/WorkflowWizardDatasetInputs";

interface WorkflowStudioInputSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly routeSearch?: string;
  readonly onReplaceRouteSearch?: (nextSearch: string) => void;
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
  const selectorSessionStore = useMemo(() => getAssetSelectorSessionStore(), []);
  const registryService = useMemo(() => new RegistryService(), []);
  const inlineAssetCreationService = useMemo(() => new InlineAssetCreationService(), []);
  const selectorDataProvider = useMemo(
    () => new RegistryAssetSelectorDataProvider({
      registryService,
      structuralKinds: ["atomic"],
      behaviorKinds: ["none"],
      limit: 50,
    }),
    [registryService],
  );
  const selectorSessionKey = useMemo(
    () => `workflow-studio:${studioId?.trim() || "default"}:inputs:dataset`,
    [studioId],
  );
  const selectorRequest = useMemo(
    () => createAssetSelectorRequest({
      requestId: `selector:${selectorSessionKey}`,
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.multiSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
      constraints: {
        required: false,
        minSelections: 0,
      },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs.dataset",
        usageContext: AssetSelectorUsageContexts.workflowInput,
        launchSource: "wizard",
      },
    }),
    [selectorSessionKey],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<ReadonlyArray<AssetSelectorResultItem>>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | undefined>(undefined);
  const [queryRevision, setQueryRevision] = useState(0);
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
    if (!inlineReturn) {
      return;
    }

    const result = inlineReturn.status === "created" && inlineReturn.assetId
      ? {
        kind: AssetSelectorResultKinds.selected as const,
        selectionType: AssetSelectorSelectionTypes.createNewAsset,
        assets: [{
          assetId: inlineReturn.assetId,
          versionId: inlineReturn.versionId,
          assetType: "dataset" as const,
        }],
      }
      : {
        kind: AssetSelectorResultKinds.cancelled as const,
        reason: "inline-create-cancelled",
      };
    selectorSessionStore.handleReturnPayload({
      sessionKey: selectorSessionKey,
      result,
    });

    const nextSearch = inlineAssetCreationService.stripInlineReturnFromSearch(routeSearch);
    if (nextSearch !== routeSearch) {
      onReplaceRouteSearch?.(nextSearch);
    }
  }, [
    inlineAssetCreationService,
    inlineReturn,
    onReplaceRouteSearch,
    routeSearch,
    selectorSessionKey,
    selectorSessionStore,
  ]);

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
              if (createDatasetLaunchPath && typeof window !== "undefined") {
                window.location.href = createDatasetLaunchPath;
              }
            }}
            onRetry={() => {
              setQueryRevision((current) => current + 1);
            }}
          />
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
