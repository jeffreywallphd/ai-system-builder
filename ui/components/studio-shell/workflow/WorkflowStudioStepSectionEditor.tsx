import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftDelayWaitModes,
  WorkflowDraftLoopIterationModes,
  WorkflowDraftManualInteractionModes,
  WorkflowDraftStepTypes,
  type WorkflowDraft,
  type WorkflowDraftDelayWaitStepConfig,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraftLoopIterationStepConfig,
  type WorkflowDraftManualApprovalStepConfig,
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
  canMoveWorkflowStep,
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
  setWorkflowStepManualApprovalConfig,
  setWorkflowStepTitle,
  setWorkflowStepType,
  workflowStepTypeDefinitions,
  WorkflowStepMoveDirections,
  WorkflowWizardStepSelectionKinds,
} from "../../../studio-shell/workflow/WorkflowWizardSteps";
import {
  WorkflowStudioHandoffFlowKinds,
  WorkflowStudioHandoffStatusKinds,
  type WorkflowStudioHandoffStatus,
} from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";

interface WorkflowStudioStepSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly onSetHandoffStatus?: (status: WorkflowStudioHandoffStatus) => void;
}

const stepSelectorTargetQueryParam = "workflowStepSelectorTarget";
const stepSelectorTargetPrefix = "workflow-step:";
const newStepSelectorTargetId = "workflow-step:new";
const stepSelectorOriginatingField = "steps.agent-assistant";
const stepSelectorUsageContext = "workflow-step";

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

function buildBuiltInCategoryLabel(category?: string): string {
  if (category === "control-flow") {
    return "Control flow";
  }
  if (category === "temporal") {
    return "Temporal";
  }
  if (category === "human-interaction") {
    return "Human interaction";
  }
  if (category === "transformation") {
    return "Transformation";
  }
  return "Built-in";
}

function toDelimitedValues(values?: ReadonlyArray<string>): string {
  return values?.join(", ") ?? "";
}

function parseDelimitedValues(raw: string): ReadonlyArray<string> | undefined {
  const parsed = Array.from(new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  ));
  return parsed.length > 0 ? Object.freeze(parsed) : undefined;
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

function parseStepSelectorOperationFromTargetId(selectorTargetId?: string): StepSelectorOperation | undefined {
  const targetId = selectorTargetId?.trim();
  if (!targetId) {
    return undefined;
  }
  if (targetId === newStepSelectorTargetId) {
    return Object.freeze({ kind: "add" } as const);
  }
  if (!targetId.startsWith(stepSelectorTargetPrefix)) {
    return undefined;
  }
  const stepId = targetId.slice(stepSelectorTargetPrefix.length).trim();
  if (!stepId || stepId === "new") {
    return undefined;
  }
  return Object.freeze({ kind: "replace", stepId });
}

function buildStepSelectorTargetId(operation: StepSelectorOperation): string {
  if (operation.kind === "add") {
    return newStepSelectorTargetId;
  }
  return `${stepSelectorTargetPrefix}${operation.stepId}`;
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
  onSetHandoffStatus,
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
  const [selectorReturnTargetId, setSelectorReturnTargetId] = useState<string | undefined>(undefined);
  const [insertionPosition, setInsertionPosition] = useState("end");
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
  const addableAssetBackedDefinitions = useMemo(
    () => addableDefinitions.filter((definition) => definition.selectionKind === WorkflowWizardStepSelectionKinds.assetBacked),
    [addableDefinitions],
  );
  const addableBuiltInDefinitions = useMemo(
    () => addableDefinitions.filter((definition) => definition.selectionKind === WorkflowWizardStepSelectionKinds.builtIn),
    [addableDefinitions],
  );
  const insertionAfterStepId = insertionPosition !== "end" ? insertionPosition : undefined;

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
    setSelectorReturnTargetId(undefined);
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
    if (insertionPosition === "end") {
      return;
    }
    const stillAvailable = sharedDraft.steps.some((step) => step.id === insertionPosition);
    if (!stillAvailable) {
      setInsertionPosition("end");
    }
  }, [insertionPosition, sharedDraft.steps]);

  useEffect(() => {
    const expectedOperation = selectorOperation ?? parseStepSelectorOperationFromSearch(location.search, sharedDraft);
    const outcome = returnHandoffService.handle({
      search: location.search,
      sessionKey: selectorSessionKey,
      request: selectorRequest,
      expectedSelectorTargetId: expectedOperation ? buildStepSelectorTargetId(expectedOperation) : undefined,
      expectedOriginatingField: stepSelectorOriginatingField,
      expectedUsageContext: stepSelectorUsageContext,
      sessionStore: selectorSessionStore,
    });

    if (!outcome.handled) {
      return;
    }

    if (outcome.returnedAsset) {
      setSelectorReturnTargetId(outcome.selectorTargetId);
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
      onSetHandoffStatus?.({
        kind: WorkflowStudioHandoffStatusKinds.completed,
        flow: WorkflowStudioHandoffFlowKinds.agentStep,
        updatedAt: Date.now(),
        handoffId: selectorState?.creatingNewContext?.launchHandoffId,
        selectorSessionKey,
        selectorTargetId: outcome.selectorTargetId,
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
      setSelectorNotice("Step handoff ended without a returned asset. Existing workflow steps were preserved.");
      closeSelector();
      onSetHandoffStatus?.({
        kind: WorkflowStudioHandoffStatusKinds.cancelled,
        flow: WorkflowStudioHandoffFlowKinds.agentStep,
        updatedAt: Date.now(),
        handoffId: selectorState?.creatingNewContext?.launchHandoffId,
        selectorSessionKey,
        selectorTargetId: outcome.selectorTargetId,
        outcomeKind: outcome.outcomeKind,
      });
    }

    if (outcome.outcomeKind === "created" && !outcome.returnedAsset) {
      onSetHandoffStatus?.({
        kind: WorkflowStudioHandoffStatusKinds.recovered,
        flow: WorkflowStudioHandoffFlowKinds.agentStep,
        updatedAt: Date.now(),
        handoffId: selectorState?.creatingNewContext?.launchHandoffId,
        selectorSessionKey,
        selectorTargetId: outcome.selectorTargetId,
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
    selectorOperation,
    returnHandoffService,
    selectorRequest,
    selectorSessionKey,
    selectorSessionStore,
    sharedDraft,
    selectorState?.creatingNewContext?.launchHandoffId,
    onSetHandoffStatus,
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
      ?? parseStepSelectorOperationFromTargetId(selectorReturnTargetId);
    if (!operation) {
      return;
    }

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

      const added = addWorkflowStep(draft, defaultAgentAssistantStepDefinition, {
        afterStepId: insertionAfterStepId,
      });
      return setWorkflowStepAgentAssetSelection(added.draft, added.stepId, {
        assetId: selectedAsset.assetId,
        versionId: selectedAsset.versionId,
        name: selectedAsset.displayName,
      }).draft;
    });

    closeSelector();
    setSelectorReturnTargetId(undefined);
  }, [insertionAfterStepId, location.search, onUpdateSharedDraft, selectorOperation, selectorReturnTargetId, selectorState, sharedDraft]);

  const stateForShell = selectorState ?? selectorSessionStore.getSession(selectorSessionKey);

  return (
    <WizardSection sectionId="workflow-wizard-steps" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Steps Section"
        description="Configure ordered workflow steps and choose either asset-backed actions or built-in workflow logic. Agent and assistant discovery now uses the shared asset selector shell."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.steps.length, "step", "steps")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
          <strong>Add step</strong>
          <p className="ui-text-small ui-text-secondary">
            Select either an asset-backed action or a built-in workflow-native action.
          </p>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small">Insertion point</span>
            <select
              className="ui-select"
              value={insertionPosition}
              onChange={(event) => setInsertionPosition(event.target.value)}
              data-testid="workflow-step-insertion-position"
            >
              <option value="end">Append to end</option>
              {sharedDraft.steps.map((step, index) => (
                <option key={step.id} value={step.id}>
                  After {index + 1}. {step.title?.trim() || step.id}
                </option>
              ))}
            </select>
          </label>
          <div className="ui-form-grid ui-form-grid--single">
            {addableAssetBackedDefinitions.map((definition) => (
              <button
                key={buildWorkflowStepTypeDefinitionKey(definition)}
                type="button"
                className="ui-button ui-button--ghost workflow-step-selector-option"
                data-testid={`workflow-step-add-${buildWorkflowStepTypeDefinitionKey(definition)}`}
                disabled={!onUpdateSharedDraft}
                onClick={() => {
                  if (!onUpdateSharedDraft) {
                    return;
                  }
                  openSelector(Object.freeze({ kind: "add" } as const));
                }}
              >
                <span className="workflow-step-selector-option__header">
                  <strong>{definition.label}</strong>
                  <span className="ui-text-small ui-text-secondary">Asset-backed</span>
                </span>
                <span className="ui-text-small ui-text-secondary">{definition.summary}</span>
              </button>
            ))}
            {addableBuiltInDefinitions.map((definition) => (
              <button
                key={buildWorkflowStepTypeDefinitionKey(definition)}
                type="button"
                className="ui-button ui-button--ghost workflow-step-selector-option"
                data-testid={`workflow-step-add-${buildWorkflowStepTypeDefinitionKey(definition)}`}
                disabled={!onUpdateSharedDraft}
                onClick={() => {
                  if (!onUpdateSharedDraft) {
                    return;
                  }
                  onUpdateSharedDraft((draft) => addWorkflowStep(draft, definition, {
                    afterStepId: insertionAfterStepId,
                  }).draft);
                }}
              >
                <span className="workflow-step-selector-option__header">
                  <strong>{definition.label}</strong>
                  <span className="ui-text-small ui-text-secondary">
                    Built-in - {buildBuiltInCategoryLabel(definition.builtInCategory)}
                  </span>
                </span>
                <span className="ui-text-small ui-text-secondary">{definition.summary}</span>
              </button>
            ))}
          </div>
          <div className="ui-row ui-row--wrap workflow-step-controls-row">
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
              const operation = selectorOperation
                ?? parseStepSelectorOperationFromSearch(location.search, sharedDraft)
                ?? Object.freeze({ kind: "add" } as const);
              const launch = studioLaunchService.launch({
                sessionKey: selectorSessionKey,
                selectorRequest,
                routePath: location.pathname,
                routeSearch: writeStepSelectorOperationToSearch(location.search, operation),
                routeHash: location.hash || "#workflow-wizard-steps",
                selectorTargetId: buildStepSelectorTargetId(operation),
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
                launchHandoffId: launch.studioHandoff?.launch.handoffId,
              });
              onSetHandoffStatus?.({
                kind: WorkflowStudioHandoffStatusKinds.launching,
                flow: WorkflowStudioHandoffFlowKinds.agentStep,
                updatedAt: Date.now(),
                handoffId: launch.studioHandoff?.launch.handoffId,
                selectorSessionKey,
                selectorTargetId: buildStepSelectorTargetId(operation),
                detail: "Launching Agent Studio for workflow steps.",
              });
              onSetHandoffStatus?.({
                kind: WorkflowStudioHandoffStatusKinds.pending,
                flow: WorkflowStudioHandoffFlowKinds.agentStep,
                updatedAt: Date.now(),
                handoffId: launch.studioHandoff?.launch.handoffId,
                selectorSessionKey,
                selectorTargetId: buildStepSelectorTargetId(operation),
                detail: "Waiting for Agent Studio handoff return.",
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
                  <div className="ui-row ui-row--between ui-row--wrap workflow-step-controls-row">
                    <strong>{step.title || `Step ${index + 1}`}</strong>
                    <span className="ui-text-small ui-text-secondary">
                      {buildStepTypeBadgeLabel(stepDefinition.selectionKind)} - {stepDefinition.label}
                      {stepDefinition.selectionKind === WorkflowWizardStepSelectionKinds.builtIn
                        ? ` (${buildBuiltInCategoryLabel(stepDefinition.builtInCategory)})`
                        : ""}
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
                          {definition.selectionKind === WorkflowWizardStepSelectionKinds.builtIn
                            ? `Built-in - ${definition.label}`
                            : definition.label}
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

                      <div className="ui-row ui-row--wrap workflow-step-controls-row">
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
                      <div className="ui-form-grid ui-form-grid--single">
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
                          <span className="ui-text-small">Then branch step IDs (comma-separated)</span>
                          <input
                            className="ui-input"
                            data-testid={`workflow-step-if-then-step-ids-${index}`}
                            value={toDelimitedValues(ifThenConfig.thenStepIds)}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                                thenStepIds: parseDelimitedValues(event.target.value),
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
                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Else branch step IDs (comma-separated)</span>
                          <input
                            className="ui-input"
                            data-testid={`workflow-step-if-else-step-ids-${index}`}
                            value={toDelimitedValues(ifThenConfig.elseStepIds)}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, step.id, {
                                elseStepIds: parseDelimitedValues(event.target.value),
                              }).draft);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {step.type === WorkflowDraftBuiltInStepTypes.loopIteration ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-loop-config-${index}`}>
                      <div className="ui-form-grid">
                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Iteration mode</span>
                          <select
                            className="ui-select"
                            data-testid={`workflow-step-loop-mode-${index}`}
                            value={loopConfig.mode ?? WorkflowDraftLoopIterationModes.fixedCount}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                mode: event.target.value as WorkflowDraftLoopIterationStepConfig["mode"],
                              }).draft);
                            }}
                          >
                            <option value={WorkflowDraftLoopIterationModes.fixedCount}>Fixed count</option>
                            <option value={WorkflowDraftLoopIterationModes.collection}>Collection</option>
                            <option value={WorkflowDraftLoopIterationModes.range}>Range</option>
                          </select>
                        </label>

                        {loopConfig.mode === WorkflowDraftLoopIterationModes.fixedCount ? (
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
                        ) : null}

                        {loopConfig.mode === WorkflowDraftLoopIterationModes.collection ? (
                          <>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Collection input key</span>
                              <input
                                className="ui-input"
                                data-testid={`workflow-step-loop-collection-input-${index}`}
                                value={loopConfig.collectionInputKey ?? ""}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                    collectionInputKey: event.target.value,
                                  }).draft);
                                }}
                              />
                            </label>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Item alias (optional)</span>
                              <input
                                className="ui-input"
                                data-testid={`workflow-step-loop-item-alias-${index}`}
                                value={loopConfig.itemAlias ?? ""}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                    itemAlias: event.target.value,
                                  }).draft);
                                }}
                              />
                            </label>
                          </>
                        ) : null}

                        {loopConfig.mode === WorkflowDraftLoopIterationModes.range ? (
                          <>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Range start</span>
                              <input
                                className="ui-input"
                                type="number"
                                data-testid={`workflow-step-loop-range-start-${index}`}
                                value={String(loopConfig.range?.start ?? "")}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  const parsed = Number.parseInt(event.target.value, 10);
                                  onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                    rangeStart: Number.isFinite(parsed) ? parsed : undefined,
                                  }).draft);
                                }}
                              />
                            </label>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Range end</span>
                              <input
                                className="ui-input"
                                type="number"
                                data-testid={`workflow-step-loop-range-end-${index}`}
                                value={String(loopConfig.range?.end ?? "")}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  const parsed = Number.parseInt(event.target.value, 10);
                                  onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                    rangeEnd: Number.isFinite(parsed) ? parsed : undefined,
                                  }).draft);
                                }}
                              />
                            </label>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Range step (optional)</span>
                              <input
                                className="ui-input"
                                type="number"
                                min={1}
                                data-testid={`workflow-step-loop-range-step-${index}`}
                                value={String(loopConfig.range?.step ?? "")}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  const parsed = Number.parseInt(event.target.value, 10);
                                  onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                    rangeStep: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                                  }).draft);
                                }}
                              />
                            </label>
                          </>
                        ) : null}

                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Exit condition expression (optional)</span>
                          <input
                            className="ui-input"
                            data-testid={`workflow-step-loop-condition-${index}`}
                            value={loopConfig.loopConditionExpression ?? ""}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                loopConditionExpression: event.target.value,
                              }).draft);
                            }}
                          />
                        </label>

                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Loop label (optional)</span>
                          <input
                            className="ui-input"
                            data-testid={`workflow-step-loop-label-${index}`}
                            value={loopConfig.loopLabel ?? ""}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                loopLabel: event.target.value,
                              }).draft);
                            }}
                          />
                        </label>

                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Loop body step IDs (comma-separated)</span>
                          <input
                            className="ui-input"
                            data-testid={`workflow-step-loop-body-step-ids-${index}`}
                            value={toDelimitedValues(loopConfig.bodyStepIds)}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                bodyStepIds: parseDelimitedValues(event.target.value),
                              }).draft);
                            }}
                          />
                        </label>

                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Max iterations (optional)</span>
                          <input
                            className="ui-input"
                            type="number"
                            min={1}
                            data-testid={`workflow-step-loop-max-iterations-${index}`}
                            value={String(loopConfig.maxIterations ?? "")}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              const parsed = Number.parseInt(event.target.value, 10);
                              onUpdateSharedDraft((draft) => setWorkflowStepLoopConfig(draft, step.id, {
                                maxIterations: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                              }).draft);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {step.type === WorkflowDraftBuiltInStepTypes.delayWait ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-delay-config-${index}`}>
                      <div className="ui-form-grid">
                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Wait mode</span>
                          <select
                            className="ui-select"
                            data-testid={`workflow-step-delay-mode-${index}`}
                            value={delayConfig.mode ?? WorkflowDraftDelayWaitModes.duration}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepDelayConfig(draft, step.id, {
                                mode: event.target.value as WorkflowDraftDelayWaitStepConfig["mode"],
                              }).draft);
                            }}
                          >
                            <option value={WorkflowDraftDelayWaitModes.duration}>Duration</option>
                            <option value={WorkflowDraftDelayWaitModes.untilTime}>Until time</option>
                          </select>
                        </label>

                        {delayConfig.mode === WorkflowDraftDelayWaitModes.duration ? (
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
                        ) : null}

                        {delayConfig.mode === WorkflowDraftDelayWaitModes.untilTime ? (
                          <>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Wait until (ISO timestamp)</span>
                              <input
                                className="ui-input"
                                data-testid={`workflow-step-delay-wait-until-${index}`}
                                value={delayConfig.waitUntil ?? ""}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepDelayConfig(draft, step.id, {
                                    waitUntil: event.target.value,
                                  }).draft);
                                }}
                              />
                            </label>
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Timezone (optional)</span>
                              <input
                                className="ui-input"
                                data-testid={`workflow-step-delay-timezone-${index}`}
                                value={delayConfig.until?.timezone ?? ""}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepDelayConfig(draft, step.id, {
                                    timezone: event.target.value,
                                  }).draft);
                                }}
                              />
                            </label>
                          </>
                        ) : null}

                        <label className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">Note (optional)</span>
                          <input
                            className="ui-input"
                            data-testid={`workflow-step-delay-note-${index}`}
                            value={delayConfig.note ?? ""}
                            onChange={(event) => {
                              if (!onUpdateSharedDraft) {
                                return;
                              }
                              onUpdateSharedDraft((draft) => setWorkflowStepDelayConfig(draft, step.id, {
                                note: event.target.value,
                              }).draft);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {step.type === WorkflowDraftBuiltInStepTypes.manualApproval ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-step-manual-config-${index}`}>
                      {(() => {
                        const manualConfig = (step.config ?? {}) as WorkflowDraftManualApprovalStepConfig;
                        return (
                          <div className="ui-form-grid">
                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Prompt / instruction</span>
                              <textarea
                                className="ui-textarea"
                                rows={3}
                                data-testid={`workflow-step-manual-prompt-${index}`}
                                value={manualConfig.prompt ?? ""}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                    prompt: event.target.value,
                                  }).draft);
                                }}
                              />
                            </label>

                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Interaction mode</span>
                              <select
                                className="ui-select"
                                data-testid={`workflow-step-manual-mode-${index}`}
                                value={manualConfig.interactionMode ?? WorkflowDraftManualInteractionModes.approval}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                    interactionMode: event.target.value as WorkflowDraftManualApprovalStepConfig["interactionMode"],
                                  }).draft);
                                }}
                              >
                                <option value={WorkflowDraftManualInteractionModes.approval}>Approval</option>
                                <option value={WorkflowDraftManualInteractionModes.review}>Review</option>
                              </select>
                            </label>

                            {manualConfig.interactionMode === WorkflowDraftManualInteractionModes.review ? (
                              <>
                                <label className="ui-stack ui-stack--2xs">
                                  <span className="ui-text-small">Continue outcome label</span>
                                  <input
                                    className="ui-input"
                                    data-testid={`workflow-step-manual-continue-label-${index}`}
                                    value={manualConfig.outcomes.continue?.label ?? ""}
                                    onChange={(event) => {
                                      if (!onUpdateSharedDraft) {
                                        return;
                                      }
                                      onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                        continueLabel: event.target.value,
                                      }).draft);
                                    }}
                                  />
                                </label>
                                <label className="ui-stack ui-stack--2xs">
                                  <span className="ui-text-small">Continue outcome step IDs (comma-separated)</span>
                                  <input
                                    className="ui-input"
                                    data-testid={`workflow-step-manual-continue-step-ids-${index}`}
                                    value={toDelimitedValues(manualConfig.outcomes.continue?.stepIds)}
                                    onChange={(event) => {
                                      if (!onUpdateSharedDraft) {
                                        return;
                                      }
                                      onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                        continueStepIds: parseDelimitedValues(event.target.value),
                                      }).draft);
                                    }}
                                  />
                                </label>
                              </>
                            ) : (
                              <>
                                <label className="ui-stack ui-stack--2xs">
                                  <span className="ui-text-small">Approve outcome label</span>
                                  <input
                                    className="ui-input"
                                    data-testid={`workflow-step-manual-approve-label-${index}`}
                                    value={manualConfig.outcomes.approve?.label ?? ""}
                                    onChange={(event) => {
                                      if (!onUpdateSharedDraft) {
                                        return;
                                      }
                                      onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                        approveLabel: event.target.value,
                                      }).draft);
                                    }}
                                  />
                                </label>
                                <label className="ui-stack ui-stack--2xs">
                                  <span className="ui-text-small">Approve outcome step IDs (comma-separated)</span>
                                  <input
                                    className="ui-input"
                                    data-testid={`workflow-step-manual-approve-step-ids-${index}`}
                                    value={toDelimitedValues(manualConfig.outcomes.approve?.stepIds)}
                                    onChange={(event) => {
                                      if (!onUpdateSharedDraft) {
                                        return;
                                      }
                                      onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                        approveStepIds: parseDelimitedValues(event.target.value),
                                      }).draft);
                                    }}
                                  />
                                </label>
                                <label className="ui-stack ui-stack--2xs">
                                  <span className="ui-text-small">Reject outcome label</span>
                                  <input
                                    className="ui-input"
                                    data-testid={`workflow-step-manual-reject-label-${index}`}
                                    value={manualConfig.outcomes.reject?.label ?? ""}
                                    onChange={(event) => {
                                      if (!onUpdateSharedDraft) {
                                        return;
                                      }
                                      onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                        rejectLabel: event.target.value,
                                      }).draft);
                                    }}
                                  />
                                </label>
                                <label className="ui-stack ui-stack--2xs">
                                  <span className="ui-text-small">Reject outcome step IDs (comma-separated)</span>
                                  <input
                                    className="ui-input"
                                    data-testid={`workflow-step-manual-reject-step-ids-${index}`}
                                    value={toDelimitedValues(manualConfig.outcomes.reject?.stepIds)}
                                    onChange={(event) => {
                                      if (!onUpdateSharedDraft) {
                                        return;
                                      }
                                      onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                        rejectStepIds: parseDelimitedValues(event.target.value),
                                      }).draft);
                                    }}
                                  />
                                </label>
                              </>
                            )}

                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Required approver roles (comma-separated)</span>
                              <input
                                className="ui-input"
                                data-testid={`workflow-step-manual-roles-${index}`}
                                value={toDelimitedValues(manualConfig.requiredApproverRoles)}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                    requiredApproverRoles: parseDelimitedValues(event.target.value),
                                  }).draft);
                                }}
                              />
                            </label>

                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">Timeout (seconds, optional)</span>
                              <input
                                className="ui-input"
                                type="number"
                                min={1}
                                data-testid={`workflow-step-manual-timeout-${index}`}
                                value={String(manualConfig.timeoutSeconds ?? "")}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  const parsed = Number.parseInt(event.target.value, 10);
                                  onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                    timeoutSeconds: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                                  }).draft);
                                }}
                              />
                            </label>

                            <label className="ui-stack ui-stack--2xs">
                              <span className="ui-text-small">On timeout</span>
                              <select
                                className="ui-select"
                                data-testid={`workflow-step-manual-on-timeout-${index}`}
                                value={manualConfig.onTimeout ?? ""}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                    onTimeout: event.target.value as "reject" | "continue" | "escalate" | "",
                                  }).draft);
                                }}
                              >
                                <option value="">None</option>
                                <option value="reject">Reject</option>
                                <option value="continue">Continue</option>
                                <option value="escalate">Escalate</option>
                              </select>
                            </label>

                            <label className="ui-row ui-row--start workflow-step-checkbox-field">
                              <input
                                className="ui-checkbox"
                                type="checkbox"
                                data-testid={`workflow-step-manual-allow-self-approval-${index}`}
                                checked={manualConfig.allowSelfApproval ?? false}
                                onChange={(event) => {
                                  if (!onUpdateSharedDraft) {
                                    return;
                                  }
                                  onUpdateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(draft, step.id, {
                                    allowSelfApproval: event.target.checked,
                                  }).draft);
                                }}
                              />
                              <span className="ui-text-small">Allow self approval</span>
                            </label>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="ui-row ui-row--wrap workflow-step-controls-row">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-step-move-up-${index}`}
                      disabled={!onUpdateSharedDraft || !canMoveWorkflowStep(sharedDraft, step.id, WorkflowStepMoveDirections.up)}
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
                      disabled={!onUpdateSharedDraft || !canMoveWorkflowStep(sharedDraft, step.id, WorkflowStepMoveDirections.down)}
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
