import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AssetDraftLifecycleStatuses, type AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import type { StudioShellSnapshotReadModel, StudioShellValidationIssue } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import WorkflowStudioDraftAuthoringBoundary from "../components/studio-shell/workflow/WorkflowStudioDraftAuthoringBoundary";
import { StudioShellService } from "../services/StudioShellService";
import { StudioShellPanel } from "../components/studio-shell/StudioShellPanel";
import { StudioShellValidationIssuesPanel } from "../components/studio-shell/StudioShellValidationIssuesPanel";
import {
  type StudioRegistration,
  StudioShellExtensionRegistry,
  StudioShellExtensionSlots,
  type StudioShellExtensionContext,
  type StudioShellExtensionContribution,
  type StudioShellExtensionSlot,
  type StudioShellToolbarAction,
  StudioShellToolbarActionKinds,
} from "../studio-shell/StudioShellExtensions";
import {
  getWorkflowStudioModeStateStore,
  type WorkflowStudioModeState,
} from "../studio-shell/workflow/WorkflowStudioModeStateStore";
import type { WorkflowStudioModeId } from "../studio-shell/workflow/WorkflowStudioModes";
import {
  buildWorkflowStudioModePath,
  type WorkflowStudioModeRouteResolution,
} from "../studio-shell/workflow/WorkflowStudioModeRouting";
import {
  buildWorkflowStudioWizardPagePath,
  type WorkflowStudioWizardPageId,
  type WorkflowStudioWizardPageRouteResolution,
} from "../studio-shell/workflow/WorkflowStudioWizardRouting";
import { WorkflowStudioReturnRestorationService } from "../studio-shell/workflow/WorkflowStudioReturnRestorationService";
import {
  WorkflowStudioHandoffFlowKinds,
  WorkflowStudioHandoffStatusKinds,
} from "../studio-shell/workflow/WorkflowStudioHandoffStatus";
import { StudioEntryService } from "../routes/StudioRouteMapping";
import { readAutomationIntentFromSearch } from "../routes/BuildAutomationIntent";
import { BuildIntents } from "../routes/BuildIntentModels";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import {
  InlineAssetCreationService,
  InlineAssetReturnStatuses,
  type InlineAssetCreationReturnTarget,
} from "../routes/InlineAssetCreation";

interface JsonParseResult<T> {
  readonly ok: boolean;
  readonly data?: T;
}

interface DraftDependencyInput {
  readonly assetId: string;
  readonly versionId: string;
}

function parseJson<T>(value: string): JsonParseResult<T> {
  try {
    if (!value.trim()) {
      return Object.freeze({ ok: true, data: undefined as T | undefined });
    }
    return Object.freeze({ ok: true, data: JSON.parse(value) as T });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function toDependencyInputs(
  dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>,
): ReadonlyArray<DraftDependencyInput> {
  if (dependencies.length === 0) {
    return Object.freeze([{ assetId: "", versionId: "" }]);
  }
  return Object.freeze(dependencies.map((entry) => ({ assetId: entry.assetId, versionId: entry.versionId ?? "" })));
}

function toDependencyReferences(
  dependencies: ReadonlyArray<DraftDependencyInput>,
): ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }> {
  return Object.freeze(
    dependencies
      .map((entry) => ({
        assetId: entry.assetId.trim(),
        versionId: entry.versionId.trim(),
      }))
      .filter((entry) => entry.assetId.length > 0)
      .map((entry) => ({
        assetId: entry.assetId,
        versionId: entry.versionId.length > 0 ? entry.versionId : undefined,
      })),
  );
}

function parseTagsInput(value: string): ReadonlyArray<string> {
  return Object.freeze([...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))]);
}

function formatTags(tags?: ReadonlyArray<string>): string {
  return (tags ?? []).join(", ");
}

function getToolbarButtonClassName(action: StudioShellToolbarAction): string {
  if (action.tone === "primary") {
    return "ui-button ui-button--primary";
  }
  if (action.tone === "ghost") {
    return "ui-button ui-button--ghost";
  }
  return "ui-button";
}

function getDrawerToggleButtonClassName(isOpen: boolean): string {
  return isOpen
    ? "ui-button ui-button--primary"
    : "ui-button ui-button--ghost";
}

function buildCreateMetadata(
  defaultDraftTitle: string,
  defaultDraftTags: ReadonlyArray<string>,
  metadataPatch: AssetMetadataPatch,
): {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly taxonomy?: AssetMetadataPatch["taxonomy"];
  readonly contract?: AssetMetadataPatch["contract"];
  readonly provenance?: AssetMetadataPatch["provenance"];
} {
  return {
    title: metadataPatch.title ?? defaultDraftTitle,
    summary: metadataPatch.summary === null ? undefined : metadataPatch.summary,
    tags: metadataPatch.tags ?? defaultDraftTags,
    taxonomy: metadataPatch.taxonomy === null ? undefined : metadataPatch.taxonomy,
    contract: metadataPatch.contract === null ? undefined : metadataPatch.contract,
    provenance: metadataPatch.provenance === null ? undefined : metadataPatch.provenance,
  };
}

function isWorkflowStudioPath(pathname: string): boolean {
  return pathname === ROUTE_PATHS.workflowStudio || pathname.startsWith("/studio-shell/workflow/");
}

function getWorkflowStudioUnsavedPrompt(): string {
  return "You have unsaved workflow draft changes. Click OK to save before leaving, or Cancel to leave without saving.";
}

interface StudioShellPageProps {
  readonly studioRegistration?: StudioRegistration;
  readonly extensions?: ReadonlyArray<StudioShellExtensionContribution>;
  readonly workflowModeRoute?: WorkflowStudioModeRouteResolution;
  readonly workflowWizardPageRoute?: WorkflowStudioWizardPageRouteResolution;
}

function renderExtensions(
  registry: StudioShellExtensionRegistry,
  slot: StudioShellExtensionSlot,
  context: StudioShellExtensionContext,
): JSX.Element | null {
  const extensions = registry.listBySlot(slot);
  if (extensions.length === 0) {
    return null;
  }

  return (
    <>
      {extensions.map((extension) => (
        <StudioShellPanel key={extension.id} title={extension.title} subtitle={extension.subtitle}>
          {extension.render(context)}
        </StudioShellPanel>
      ))}
    </>
  );
}

export default function StudioShellPage({
  studioRegistration,
  extensions = [],
  workflowModeRoute,
  workflowWizardPageRoute,
}: StudioShellPageProps): JSX.Element {
  const studioId = studioRegistration?.studioId ?? "studio-shell-main";
  const isWorkflowStudio = studioRegistration?.role === "workflow";
  const defaultDraftTitle = studioRegistration?.defaults.title ?? "Studio Shell Draft";
  const defaultDraftTags = studioRegistration?.defaults.tags ?? ["studio-shell"];
  const defaultContent = studioRegistration?.defaults.contentTemplate ?? "{}";
  const shellTitle = studioRegistration?.shell?.title ?? studioRegistration?.displayName ?? "Studio Shell";
  const shellSubtitle = studioRegistration?.shell?.subtitle
    ?? (studioRegistration
      ? `Shared ${studioRegistration.kind}-studio shell for ${studioRegistration.role} assets: session/draft context, metadata/dependencies, lifecycle/version, and validation.`
      : "Reusable bounded shell for studio/session context, authoring, taxonomy/contract/provenance/dependencies, lifecycle/version state, and validation.");
  const service = useMemo(() => new StudioShellService(), []);
  const inlineAssetCreationService = useMemo(() => new InlineAssetCreationService(), []);
  const workflowReturnRestorationService = useMemo(() => new WorkflowStudioReturnRestorationService(), []);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const studioEntryService = useMemo(() => new StudioEntryService(), []);
  const contextualInitialization = useMemo(
    () => studioEntryService.parseInitializationFromSearch(location.search),
    [location.search, studioEntryService],
  );
  const automationIntent = useMemo(
    () => readAutomationIntentFromSearch(location.search),
    [location.search],
  );
  const inlineCreationReturnTarget = useMemo<InlineAssetCreationReturnTarget | undefined>(
    () => inlineAssetCreationService.parseReturnTargetFromSearch(location.search),
    [inlineAssetCreationService, location.search],
  );
  const inlineCreationReturnPayload = useMemo(
    () => inlineAssetCreationService.parseInlineReturnFromSearch(location.search),
    [inlineAssetCreationService, location.search],
  );
  const selectorLaunchContext = useMemo(
    () => inlineAssetCreationService.parseSelectorLaunchFromSearch(location.search),
    [inlineAssetCreationService, location.search],
  );
  const studioLaunchHandoff = useMemo(
    () => inlineAssetCreationService.parseStudioHandoffFromSearch(location.search),
    [inlineAssetCreationService, location.search],
  );
  const workflowModeStore = useMemo(
    () => (isWorkflowStudio ? getWorkflowStudioModeStateStore(studioId) : undefined),
    [isWorkflowStudio, studioId],
  );
  const resolvedWorkflowModeId = workflowModeRoute?.resolvedModeId;
  const resolvedWorkflowWizardPageId = workflowWizardPageRoute?.resolvedPageId;
  const shouldSeedAutomationIntent = searchParams.get("buildIntent")?.trim() === BuildIntents.automateTask && Boolean(automationIntent);
  const extensionRegistry = useMemo(() => {
    const registry = new StudioShellExtensionRegistry();
    registry.registerMany([...(studioRegistration?.extensions ?? []), ...extensions]);
    return registry;
  }, [studioRegistration, extensions]);
  const [snapshot, setSnapshot] = useState<StudioShellSnapshotReadModel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [validationIssues, setValidationIssues] = useState<ReadonlyArray<StudioShellValidationIssue>>([]);
  const [systemCompatibility, setSystemCompatibility] = useState<StudioShellExtensionContext["systemCompatibility"]>();
  const [isBusy, setIsBusy] = useState(false);
  const [content, setContent] = useState(defaultContent);
  const initialMetadataPatch = useMemo<AssetMetadataPatch>(
    () => studioRegistration?.defaults.metadataPatch ?? { title: defaultDraftTitle, tags: defaultDraftTags },
    [defaultDraftTags, defaultDraftTitle, studioRegistration?.defaults.metadataPatch],
  );
  const initialDependencies = useMemo(
    () => toDependencyInputs(studioRegistration?.defaults.dependencies ?? []),
    [studioRegistration?.defaults.dependencies],
  );
  const [metadataPatch, setMetadataPatch] = useState<AssetMetadataPatch>(initialMetadataPatch);
  const [metadataPatchJson, setMetadataPatchJson] = useState(() => JSON.stringify(initialMetadataPatch, null, 2));
  const [isMetadataJsonMode, setIsMetadataJsonMode] = useState(false);
  const [metadataJsonError, setMetadataJsonError] = useState<string | undefined>();
  const [dependencies, setDependencies] = useState<ReadonlyArray<DraftDependencyInput>>(initialDependencies);
  const [dependenciesJson, setDependenciesJson] = useState(() => JSON.stringify(toDependencyReferences(initialDependencies), null, 2));
  const [isDependenciesJsonMode, setIsDependenciesJsonMode] = useState(false);
  const [dependenciesJsonError, setDependenciesJsonError] = useState<string | undefined>();
  const [workflowModeState, setWorkflowModeState] = useState<WorkflowStudioModeState | undefined>(
    () => workflowModeStore?.getState(),
  );
  const leftDrawerConfiguration = studioRegistration?.shell?.drawers?.left;
  const rightDrawerConfiguration = studioRegistration?.shell?.drawers?.right;
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(leftDrawerConfiguration?.defaultOpen ?? true);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(rightDrawerConfiguration?.defaultOpen ?? true);
  const automationPrefillAppliedRef = useRef(false);
  const lastRestoredWorkflowReturnSearchRef = useRef<string | undefined>(undefined);

  const updateContent = (nextContent: string): void => {
    setContent(nextContent);
    workflowModeStore?.hydrateFromSerializedDraft(nextContent);
  };

  useEffect(() => {
    if (!workflowModeStore) {
      setWorkflowModeState(undefined);
      return;
    }

    setWorkflowModeState(workflowModeStore.getState());
    return workflowModeStore.subscribe((state) => setWorkflowModeState(state));
  }, [workflowModeStore]);

  useEffect(() => {
    if (!isWorkflowStudio || !workflowModeState) {
      return;
    }

    setContent(workflowModeState.draftEditorContent);
  }, [isWorkflowStudio, workflowModeState]);

  useEffect(() => {
    if (!workflowModeStore || !resolvedWorkflowModeId) {
      return;
    }

    if (workflowModeStore.getState().selectedModeId === resolvedWorkflowModeId) {
      return;
    }

    workflowModeStore.setSelectedMode(resolvedWorkflowModeId);
  }, [resolvedWorkflowModeId, workflowModeStore]);

  useEffect(() => {
    if (!isWorkflowStudio || !workflowModeStore || !location.search.trim()) {
      return;
    }
    if (lastRestoredWorkflowReturnSearchRef.current === location.search) {
      return;
    }

    const restoration = workflowReturnRestorationService.restoreFromReturnSearch({
      search: location.search,
      workflowModeStore,
    });
    if (!restoration.handled || !restoration.handoffId) {
      return;
    }

    const flow = restoration.assetType === "agent"
      ? WorkflowStudioHandoffFlowKinds.agentStep
      : WorkflowStudioHandoffFlowKinds.datasetInput;
    if (restoration.restored) {
      workflowModeStore.setHandoffStatus({
        kind: WorkflowStudioHandoffStatusKinds.resumed,
        flow,
        updatedAt: Date.now(),
        handoffId: restoration.handoffId,
        selectorSessionKey: restoration.selectorSessionId,
        selectorTargetId: restoration.selectorTargetId,
      });
    } else if (restoration.ignoredReason === "draft-context-mismatch") {
      workflowModeStore.setHandoffStatus({
        kind: WorkflowStudioHandoffStatusKinds.recovered,
        flow,
        updatedAt: Date.now(),
        handoffId: restoration.handoffId,
        selectorSessionKey: restoration.selectorSessionId,
        selectorTargetId: restoration.selectorTargetId,
        detail: "Ignored stale handoff restoration for a different draft session.",
      });
    }
    lastRestoredWorkflowReturnSearchRef.current = location.search;
  }, [isWorkflowStudio, location.search, workflowModeStore, workflowReturnRestorationService]);

  const refreshSnapshot = async () => {
    setIsBusy(true);
    try {
      const response = await service.loadSnapshot(studioId);
      if (!response.ok) {
        setError(response.error?.message ?? "Failed to load Studio Shell snapshot.");
        return;
      }
      if (!response.data) {
        const initialized = await service.initializeStudio(studioId, studioRegistration?.displayName ?? "Studio Shell");
        if (!initialized.ok || !initialized.data) {
          setError(initialized.error?.message ?? "Failed to initialize Studio Shell.");
          return;
        }
        setSnapshot(initialized.data);
        setValidationIssues(initialized.data.validationIssues);
        return;
      }
      setSnapshot(response.data);
      setValidationIssues(response.data.validationIssues);
      if (studioRegistration?.kind === "system" && response.data.draft?.draftId) {
        const compatibilityResponse = await service.getSystemCompatibilityInsights({
          studioId,
          draftId: response.data.draft.draftId,
        });
        setSystemCompatibility(compatibilityResponse.ok ? compatibilityResponse.data : undefined);
      } else {
        setSystemCompatibility(undefined);
      }
      setError(undefined);
      if (response.data.draft) {
        if (workflowModeStore && isWorkflowStudio) {
          workflowModeStore.synchronizeSharedDraftFromSnapshot({
            serializedDraft: response.data.draft.content,
            context: {
              studioId,
              sessionId: response.data.activeSessionId,
              draftId: response.data.draft.draftId,
              revision: response.data.draft.revision,
            },
          });
        } else {
          updateContent(response.data.draft.content);
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    setMetadataPatch(initialMetadataPatch);
    setMetadataPatchJson(JSON.stringify(initialMetadataPatch, null, 2));
    setIsMetadataJsonMode(false);
    setMetadataJsonError(undefined);

    setDependencies(initialDependencies);
    setDependenciesJson(JSON.stringify(toDependencyReferences(initialDependencies), null, 2));
    setIsDependenciesJsonMode(false);
    setDependenciesJsonError(undefined);
  }, [initialDependencies, initialMetadataPatch]);

  useEffect(() => {
    void refreshSnapshot();
  }, [studioId]);

  useEffect(() => {
    automationPrefillAppliedRef.current = false;
  }, [studioId, location.search]);

  useEffect(() => {
    setIsLeftDrawerOpen(leftDrawerConfiguration?.defaultOpen ?? true);
    setIsRightDrawerOpen(rightDrawerConfiguration?.defaultOpen ?? true);
  }, [leftDrawerConfiguration?.defaultOpen, rightDrawerConfiguration?.defaultOpen, studioId]);

  useEffect(() => {
    if (!shouldSeedAutomationIntent || !automationIntent || snapshot?.draft || automationPrefillAppliedRef.current) {
      return;
    }

    if (!isWorkflowStudio) {
      updateContent(content === defaultContent ? automationIntent : content);
    }
    setMetadataPatch((current) => {
      const nextPatch: AssetMetadataPatch = {
        ...current,
        title: current.title ?? "Automation draft",
        summary: current.summary ?? automationIntent,
      };
      setMetadataPatchJson(JSON.stringify(nextPatch, null, 2));
      return nextPatch;
    });
    automationPrefillAppliedRef.current = true;
  }, [automationIntent, content, defaultContent, isWorkflowStudio, shouldSeedAutomationIntent, snapshot?.draft]);

  const runAndRefreshWithResult = async (
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ): Promise<boolean> => {
    setIsBusy(true);
    try {
      const response = await action();
      if (!response.ok) {
        setError(response.error?.message ?? "Studio shell operation failed.");
        return false;
      }
      await refreshSnapshot();
      setError(undefined);
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  const runAndRefresh = async (action: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    await runAndRefreshWithResult(action);
  };

  const updateMetadataPatch = (updater: (current: AssetMetadataPatch) => AssetMetadataPatch): void => {
    setMetadataPatch((current) => {
      const next = updater(current);
      setMetadataPatchJson(JSON.stringify(next, null, 2));
      return next;
    });
  };

  const updateDependenciesForm = (nextDependencies: ReadonlyArray<DraftDependencyInput>): void => {
    setDependencies(nextDependencies);
    setDependenciesJson(JSON.stringify(toDependencyReferences(nextDependencies), null, 2));
  };

  const resolveMetadataPatchForSave = (): AssetMetadataPatch | undefined => {
    if (!isMetadataJsonMode) {
      return metadataPatch;
    }

    const parsed = parseJson<AssetMetadataPatch>(metadataPatchJson);
    if (!parsed.ok) {
      setMetadataJsonError("Metadata patch JSON is invalid. Fix JSON or switch back to form mode.");
      return undefined;
    }
    setMetadataJsonError(undefined);
    return parsed.data ?? {};
  };

  const resolveDependenciesForSave = (): ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }> | undefined => {
    if (!isDependenciesJsonMode) {
      return toDependencyReferences(dependencies);
    }

    const parsed = parseJson<Array<{ assetId: string; versionId?: string }>>(dependenciesJson);
    if (!parsed.ok) {
      setDependenciesJsonError("Dependencies JSON is invalid. Fix JSON or switch back to form mode.");
      return undefined;
    }
    setDependenciesJsonError(undefined);
    return (parsed.data ?? [])
      .map((entry) => ({ assetId: entry.assetId.trim(), versionId: entry.versionId?.trim() }))
      .filter((entry) => entry.assetId.length > 0);
  };

  const sessionId = snapshot?.activeSessionId;
  const draftId = snapshot?.draft?.draftId;
  const latestVersionId = snapshot && snapshot.versions.length > 0
    ? snapshot.versions[snapshot.versions.length - 1]?.versionId
    : undefined;
  const returnVersionId = snapshot?.draft?.lastPublishedVersionId
    ?? latestVersionId
    ?? undefined;
  const inlineReturnPaths = useMemo(() => {
    if (!inlineCreationReturnTarget) {
      return undefined;
    }

    return Object.freeze({
      withAsset: snapshot?.draft?.assetId
        ? inlineAssetCreationService.buildReturnPath({
          returnTarget: inlineCreationReturnTarget,
          payload: {
            status: InlineAssetReturnStatuses.created,
            assetId: snapshot.draft.assetId,
            versionId: returnVersionId,
            assetType: studioRegistration?.role,
            displayName: snapshot.draft.metadata.title,
            sourceStudioType: studioRegistration?.studioType,
            sourceStudioId: studioId,
            returnContextId: inlineCreationReturnTarget.contextId,
            handoffId: studioLaunchHandoff?.launch.handoffId,
          },
        })
        : undefined,
      noSelection: inlineAssetCreationService.buildReturnPath({
        returnTarget: inlineCreationReturnTarget,
        payload: {
          status: InlineAssetReturnStatuses.noSelection,
          assetType: studioRegistration?.role,
          sourceStudioType: studioRegistration?.studioType,
          sourceStudioId: studioId,
          returnContextId: inlineCreationReturnTarget.contextId,
          handoffId: studioLaunchHandoff?.launch.handoffId,
        },
      }),
      cancelled: inlineAssetCreationService.buildReturnPath({
        returnTarget: inlineCreationReturnTarget,
        payload: {
          status: InlineAssetReturnStatuses.cancelled,
          assetType: studioRegistration?.role,
          sourceStudioType: studioRegistration?.studioType,
          sourceStudioId: studioId,
          returnContextId: inlineCreationReturnTarget.contextId,
          handoffId: studioLaunchHandoff?.launch.handoffId,
        },
      }),
      abandoned: inlineAssetCreationService.buildReturnPath({
        returnTarget: inlineCreationReturnTarget,
        payload: {
          status: InlineAssetReturnStatuses.abandoned,
          assetType: studioRegistration?.role,
          sourceStudioType: studioRegistration?.studioType,
          sourceStudioId: studioId,
          returnContextId: inlineCreationReturnTarget.contextId,
          handoffId: studioLaunchHandoff?.launch.handoffId,
        },
      }),
    });
  }, [
    inlineAssetCreationService,
    inlineCreationReturnTarget,
    latestVersionId,
    returnVersionId,
    snapshot?.draft?.assetId,
    studioLaunchHandoff?.launch.handoffId,
    studioId,
    studioRegistration?.studioType,
    studioRegistration?.role,
  ]);
  const autoReturnedFromSelectorRef = useRef(false);

  useEffect(() => {
    autoReturnedFromSelectorRef.current = false;
  }, [selectorLaunchContext?.selectorSessionId, studioId]);

  useEffect(() => {
    if (!selectorLaunchContext || !inlineReturnPaths?.withAsset || autoReturnedFromSelectorRef.current) {
      return;
    }
    if (!snapshot?.draft?.assetId) {
      return;
    }
    autoReturnedFromSelectorRef.current = true;
    void navigate(inlineReturnPaths.withAsset, { replace: true });
  }, [inlineReturnPaths?.withAsset, navigate, selectorLaunchContext, snapshot?.draft?.assetId]);
  const workflowDraftContent = workflowModeState?.sharedDraftSerialized ?? content;
  const hasWorkflowDraftParseError = isWorkflowStudio && Boolean(workflowModeState?.draftParseError);
  const hasWorkflowUnsavedChanges = isWorkflowStudio && Boolean(workflowModeState?.hasLocalDraftEdits);
  const workflowDraftStatusTone = hasWorkflowDraftParseError
    ? "danger"
    : hasWorkflowUnsavedChanges
      ? "warning"
      : "success";
  const workflowDraftStatusLabel = hasWorkflowDraftParseError
    ? "Draft parse error"
    : hasWorkflowUnsavedChanges
      ? "Unsaved changes"
      : "All changes saved";
  const toolbarActions = studioRegistration?.shell?.toolbar?.actions ?? [];
  const workflowModeToolbarActions = toolbarActions.filter(
    (action): action is Extract<StudioShellToolbarAction, { kind: "set-workflow-mode" }> => (
      action.kind === StudioShellToolbarActionKinds.setWorkflowMode
    ),
  );
  const nonWorkflowModeToolbarActions = toolbarActions.filter(
    (action): action is Exclude<StudioShellToolbarAction, { kind: "set-workflow-mode" }> => (
      action.kind !== StudioShellToolbarActionKinds.setWorkflowMode
    ),
  );
  const wizardModeToolbarAction = workflowModeToolbarActions.find((action) => action.modeId === "wizard");
  const canvasModeToolbarAction = workflowModeToolbarActions.find((action) => action.modeId === "canvas");
  const workflowModeToggleAction = isWorkflowStudio
    && workflowModeState
    && wizardModeToolbarAction
    && canvasModeToolbarAction
    ? Object.freeze({
      ...(workflowModeState.selectedModeId === "canvas" ? wizardModeToolbarAction : canvasModeToolbarAction),
      label: workflowModeState.selectedModeId === "canvas" ? "Wizard" : "Canvas",
    } satisfies StudioShellToolbarAction)
    : undefined;
  const toolbarActionsToRender = workflowModeToggleAction
    ? Object.freeze(
      [...nonWorkflowModeToolbarActions, workflowModeToggleAction].sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.id.localeCompare(right.id);
      }),
    )
    : toolbarActions;
  const saveToolbarAction = toolbarActionsToRender.find(
    (action) => action.kind === StudioShellToolbarActionKinds.saveDraft,
  );
  const toolbarActionsWithoutSave = saveToolbarAction
    ? toolbarActionsToRender.filter((action) => action.id !== saveToolbarAction.id)
    : toolbarActionsToRender;
  const toolbarActionsBeforeSave = workflowModeToggleAction
    ? toolbarActionsWithoutSave.filter((action) => action.id !== workflowModeToggleAction.id)
    : toolbarActionsWithoutSave;
  const shouldShowLeftDrawerToggle = Boolean(leftDrawerConfiguration)
    && (!isWorkflowStudio || workflowModeState?.selectedModeId === "canvas");
  const hasToolbar = toolbarActionsToRender.length > 0 || shouldShowLeftDrawerToggle || Boolean(rightDrawerConfiguration);

  const saveDraftFromAuthoringAsync = async (): Promise<boolean> => {
    if (!sessionId) {
      return false;
    }

    const resolvedMetadataPatch = resolveMetadataPatchForSave();
    if (!resolvedMetadataPatch) {
      return false;
    }

    if (!draftId) {
      const metadata = buildCreateMetadata(defaultDraftTitle, defaultDraftTags, resolvedMetadataPatch);
      return runAndRefreshWithResult(() => service.createDraft({
        studioId,
        sessionId,
        content: workflowDraftContent,
        metadata,
      }));
    }

    return runAndRefreshWithResult(() => service.updateDraft({
      studioId,
      sessionId,
      draftId,
      content: workflowDraftContent,
      metadataPatch: resolvedMetadataPatch,
    }));
  };

  const saveDraftFromAuthoring = (): void => {
    void saveDraftFromAuthoringAsync();
  };

  const runValidationFromAuthoring = (): void => {
    if (!draftId) {
      return;
    }

    void runAndRefresh(async () => {
      const response = await service.validateDraft(studioId, draftId);
      if (response.ok && response.data) {
        setValidationIssues(response.data);
      }
      return response;
    });
  };

  const buildWorkflowStudioSearchWithoutModeParams = (): string => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete("mode");
    nextSearchParams.delete("wizardPage");
    return nextSearchParams.toString().length > 0 ? `?${nextSearchParams.toString()}` : "";
  };

  const setWorkflowModeFromToolbar = (modeId: WorkflowStudioModeId): void => {
    if (!isWorkflowStudio || !workflowModeStore) {
      return;
    }

    workflowModeStore.setSelectedMode(modeId);
    const nextPathname = modeId === "wizard"
      ? buildWorkflowStudioWizardPagePath(
        resolvedWorkflowWizardPageId ?? "trigger",
      )
      : buildWorkflowStudioModePath(modeId);
    void navigate(
      {
        pathname: nextPathname,
        search: buildWorkflowStudioSearchWithoutModeParams(),
        hash: location.hash,
      },
      { replace: true },
    );
  };

  const runToolbarAction = (action: StudioShellToolbarAction): void => {
    if (action.kind === StudioShellToolbarActionKinds.refreshSnapshot) {
      void refreshSnapshot();
      return;
    }

    if (action.kind === StudioShellToolbarActionKinds.saveDraft) {
      saveDraftFromAuthoring();
      return;
    }

    if (action.kind === StudioShellToolbarActionKinds.runValidation) {
      runValidationFromAuthoring();
      return;
    }

    setWorkflowModeFromToolbar(action.modeId);
  };

  const isToolbarActionDisabled = (action: StudioShellToolbarAction): boolean => {
    if (action.kind === StudioShellToolbarActionKinds.refreshSnapshot) {
      return isBusy;
    }
    if (action.kind === StudioShellToolbarActionKinds.saveDraft) {
      return isBusy || !sessionId || hasWorkflowDraftParseError;
    }
    if (action.kind === StudioShellToolbarActionKinds.runValidation) {
      return isBusy || !draftId;
    }
    if (!isWorkflowStudio || !workflowModeState) {
      return true;
    }
    return workflowModeState.selectedModeId === action.modeId;
  };

  const workflowUnsavedNavigationBlocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!isWorkflowStudio || !hasWorkflowUnsavedChanges) {
      return false;
    }
    if (!isWorkflowStudioPath(currentLocation.pathname)) {
      return false;
    }
    if (isWorkflowStudioPath(nextLocation.pathname)) {
      return false;
    }
    return currentLocation.pathname !== nextLocation.pathname
      || currentLocation.search !== nextLocation.search
      || currentLocation.hash !== nextLocation.hash;
  });

  useEffect(() => {
    if (workflowUnsavedNavigationBlocker.state !== "blocked") {
      return;
    }

    let cancelled = false;
    const handleNavigationBlock = async (): Promise<void> => {
      const shouldSave = window.confirm(getWorkflowStudioUnsavedPrompt());
      if (cancelled) {
        return;
      }
      if (shouldSave) {
        const saved = await saveDraftFromAuthoringAsync();
        if (cancelled || !saved) {
          workflowUnsavedNavigationBlocker.reset();
          return;
        }
      }
      workflowUnsavedNavigationBlocker.proceed();
    };

    void handleNavigationBlock();
    return () => {
      cancelled = true;
    };
  }, [workflowUnsavedNavigationBlocker]);

  useBeforeUnload((event) => {
    if (!isWorkflowStudio || !hasWorkflowUnsavedChanges || !isWorkflowStudioPath(location.pathname)) {
      return;
    }
    event.preventDefault();
    event.returnValue = getWorkflowStudioUnsavedPrompt();
  });

  const extensionContext: StudioShellExtensionContext = {
    studioId,
    snapshot,
    validationIssues,
    workflowModeState: workflowModeStore && workflowModeState
      ? {
        state: workflowModeState,
        setSelectedMode: (modeId) => setWorkflowModeFromToolbar(modeId),
      }
      : undefined,
    systemCompatibility,
    handoffContext: {
      assetId: contextualInitialization.context.authoritativeAsset?.assetId
        ?? (searchParams.get("assetId")?.trim() || undefined),
      versionId: contextualInitialization.context.authoritativeAsset?.versionId
        ?? (searchParams.get("versionId")?.trim() || undefined),
      handoff: searchParams.get("handoff")?.trim() || undefined,
      registryContext: searchParams.get("registryContext")?.trim() || undefined,
      selectedComponent: searchParams.get("selectedComponent")?.trim() || undefined,
    },
    operationError: error,
    isBusy,
    operations: {
      refresh: refreshSnapshot,
      startSystemExecution: async (request) => service.startSystemExecution(request),
      getSystemExecutionStatus: async (executionId) => service.getSystemExecutionStatus(executionId),
      getSystemExecutionTrace: async (request) => service.getSystemExecutionTrace(request),
      getSystemExecutionResult: async (executionId) => service.getSystemExecutionResult(executionId),
      saveSystemChildComponent: async (request) => {
        const response = await service.addSystemChildComponent(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to add system child component.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      removeSystemChildComponent: async (request) => {
        const response = await service.removeSystemChildComponent(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to remove system child component.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      reorderSystemChildComponent: async (request) => {
        const response = await service.reorderSystemChildComponent(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to reorder system child component.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      updateSystemInterfaces: async (request) => {
        const response = await service.updateSystemInterfaces(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to update system interfaces.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      updateSystemParameters: async (request) => {
        const response = await service.updateSystemParameters(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to update system parameters.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      updateSystemExecutionMetadata: async (request) => {
        const response = await service.updateSystemExecutionMetadata(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to update system execution metadata.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
    },
  };

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="studio-shell-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{shellTitle}</h1>
          <p className="ui-page__subtitle">{shellSubtitle}</p>
        </div>
      </div>

      <div className="ui-studio-shell__authoring">
        {hasToolbar ? (
          <div className="ui-toolbar ui-toolbar--panel ui-studio-shell__authoring-toolbar" data-testid="studio-shell-authoring-toolbar">
            <div className="ui-toolbar__group">
              {!workflowModeToggleAction && shouldShowLeftDrawerToggle && leftDrawerConfiguration ? (
                <button
                  type="button"
                  className={getDrawerToggleButtonClassName(isLeftDrawerOpen)}
                  data-testid="studio-shell-left-drawer-toggle"
                  onClick={() => setIsLeftDrawerOpen((current) => !current)}
                >
                  {leftDrawerConfiguration.label}
                </button>
              ) : null}
              {workflowModeToggleAction ? (
                <button
                  key={workflowModeToggleAction.id}
                  type="button"
                  className={getToolbarButtonClassName(workflowModeToggleAction)}
                  disabled={isToolbarActionDisabled(workflowModeToggleAction)}
                  onClick={() => runToolbarAction(workflowModeToggleAction)}
                >
                  {workflowModeToggleAction.label}
                </button>
              ) : null}
              {workflowModeToggleAction && shouldShowLeftDrawerToggle && leftDrawerConfiguration ? (
                <button
                  type="button"
                  className={getDrawerToggleButtonClassName(isLeftDrawerOpen)}
                  data-testid="studio-shell-left-drawer-toggle"
                  onClick={() => setIsLeftDrawerOpen((current) => !current)}
                >
                  {leftDrawerConfiguration.label}
                </button>
              ) : null}
              {toolbarActionsBeforeSave.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={getToolbarButtonClassName(action)}
                  disabled={isToolbarActionDisabled(action)}
                  onClick={() => runToolbarAction(action)}
                >
                  {action.label}
                </button>
              ))}
              {rightDrawerConfiguration ? (
                <button
                  type="button"
                  className={getDrawerToggleButtonClassName(isRightDrawerOpen)}
                  data-testid="studio-shell-right-drawer-toggle"
                  onClick={() => setIsRightDrawerOpen((current) => !current)}
                >
                  {rightDrawerConfiguration.label}
                </button>
              ) : null}
              {saveToolbarAction ? (
                <button
                  key={saveToolbarAction.id}
                  type="button"
                  className={getToolbarButtonClassName(saveToolbarAction)}
                  disabled={isToolbarActionDisabled(saveToolbarAction)}
                  onClick={() => runToolbarAction(saveToolbarAction)}
                >
                  {hasWorkflowUnsavedChanges ? `${saveToolbarAction.label} *` : saveToolbarAction.label}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isWorkflowStudio && workflowModeState ? (
          <div className="ui-card ui-card--padded ui-studio-shell__workflow-draft-status" data-testid="studio-shell-workflow-draft-status">
            <div className="ui-row ui-row--between ui-row--wrap">
              <strong>Workflow draft status</strong>
              <span className={`ui-badge ui-badge--${workflowDraftStatusTone}`} data-testid="studio-shell-workflow-draft-status-badge">
                {workflowDraftStatusLabel}
              </span>
            </div>
            {hasWorkflowDraftParseError ? (
              <p className="ui-text-small ui-text-danger">
                Workflow draft JSON has parse errors. Fix JSON before saving this draft.
              </p>
            ) : hasWorkflowUnsavedChanges ? (
              <p className="ui-text-small ui-text-secondary">
                Local workflow edits are unsaved. Save before leaving Workflow Studio to persist these changes in the draft session.
              </p>
            ) : (
              <p className="ui-text-small ui-text-secondary">
                Local and persisted workflow draft content are synchronized.
              </p>
            )}
          </div>
        ) : null}

        <StudioShellPanel title="Asset draft authoring" subtitle="Thin authoring surface over studio-shell draft contracts.">
          <WorkflowStudioDraftAuthoringBoundary
            isWorkflowStudio={isWorkflowStudio}
            content={content}
            onChangeContent={updateContent}
            invalidModeRouteId={isWorkflowStudio ? workflowModeRoute?.invalidModeId : undefined}
            invalidWizardPageRouteId={isWorkflowStudio ? workflowWizardPageRoute?.invalidPageId : undefined}
            workflowModeContext={workflowModeStore && workflowModeState
              ? {
                studioId,
                selectedModeId: workflowModeState.selectedModeId,
                selectedWizardPageId: resolvedWorkflowWizardPageId ?? "trigger",
                onSelectWizardPage: (pageId: WorkflowStudioWizardPageId) => {
                  void navigate(
                    {
                      pathname: buildWorkflowStudioWizardPagePath(pageId),
                      search: buildWorkflowStudioSearchWithoutModeParams(),
                      hash: location.hash,
                    },
                    { replace: true },
                  );
                },
                sharedDraft: workflowModeState.sharedDraft,
                sharedDraftSerialized: workflowModeState.sharedDraftSerialized,
                draftEditorContent: workflowModeState.draftEditorContent,
                draftParseError: workflowModeState.draftParseError,
                modeValidationIssues: workflowModeState.modeValidationIssues,
                draftValidationIssues: workflowModeState.draftValidationIssues,
                updateSharedDraft: (updater) => workflowModeStore.updateSharedDraft(updater),
                handoffStatus: workflowModeState.handoffStatus,
                setHandoffStatus: (status) => workflowModeStore.setHandoffStatus(status),
                clearHandoffStatus: () => workflowModeStore.clearHandoffStatus(),
                canvasDrawers: {
                  left: leftDrawerConfiguration
                    ? {
                      label: leftDrawerConfiguration.label,
                      isOpen: isLeftDrawerOpen,
                      onClose: () => setIsLeftDrawerOpen(false),
                    }
                    : undefined,
                  right: rightDrawerConfiguration
                    ? {
                      label: rightDrawerConfiguration.label,
                      isOpen: isRightDrawerOpen,
                    }
                    : undefined,
                },
              }
              : undefined}
          />
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
            <button
              className="ui-button ui-button--primary"
              disabled={isBusy || !sessionId || hasWorkflowDraftParseError}
              onClick={saveDraftFromAuthoring}
            >
              {draftId
                ? (hasWorkflowUnsavedChanges ? "Save Draft Changes" : "Save")
                : "Create Draft"}
            </button>
          </div>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.draftAuthoring, extensionContext)}
      </div>

      <div className="ui-grid ui-grid--2 ui-studio-shell__grid">
        <StudioShellPanel title="Studio/session context" subtitle="Current studio, active session, and draft context.">
          <div className="ui-stack ui-stack--2xs">
            <div><strong>Studio:</strong> {snapshot?.studioName ?? "-"} ({snapshot?.studioId ?? studioId})</div>
            <div><strong>Session:</strong> {snapshot?.activeSessionId ?? "-"} ({snapshot?.sessionStatus ?? "n/a"})</div>
            <div><strong>Draft:</strong> {snapshot?.draft?.draftId ?? "-"}</div>
            <div><strong>Revision:</strong> {snapshot?.draft?.revision ?? 0}</div>
          </div>
          {inlineCreationReturnTarget ? (
            <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="studio-shell-inline-return-panel">
              <strong>Inline creation handoff</strong>
              <span className="ui-text-small ui-text-secondary">
                {selectorLaunchContext
                  ? `This studio was launched from selector session ${selectorLaunchContext.selectorSessionId}. Return when creation completes.`
                  : "This studio was opened from another workspace. Return when done, optionally attaching this asset."}
              </span>
              <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {inlineReturnPaths?.withAsset ? (
                  <Link
                    className="ui-button ui-button--sm ui-button--primary"
                    to={inlineReturnPaths.withAsset}
                    data-testid="studio-shell-inline-return-with-asset"
                  >
                    Return with asset
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="ui-button ui-button--sm ui-button--primary"
                    disabled
                    data-testid="studio-shell-inline-return-with-asset-disabled"
                  >
                    Return with asset
                  </button>
                )}
                <Link
                  className="ui-button ui-button--sm ui-button--ghost"
                  to={selectorLaunchContext
                    ? (inlineReturnPaths?.noSelection ?? inlineCreationReturnTarget.routePath)
                    : (inlineReturnPaths?.cancelled ?? inlineCreationReturnTarget.routePath)}
                  data-testid={selectorLaunchContext
                    ? "studio-shell-inline-return-no-selection"
                    : "studio-shell-inline-return-cancel"}
                >
                  {selectorLaunchContext ? "Return without selection" : "Cancel and return"}
                </Link>
                {selectorLaunchContext ? (
                  <Link
                    className="ui-button ui-button--sm ui-button--ghost"
                    to={inlineReturnPaths?.cancelled ?? inlineCreationReturnTarget.routePath}
                    data-testid="studio-shell-inline-return-cancel"
                  >
                    Cancel and return
                  </Link>
                ) : null}
                {selectorLaunchContext ? (
                  <Link
                    className="ui-button ui-button--sm ui-button--ghost"
                    to={inlineReturnPaths?.abandoned ?? inlineCreationReturnTarget.routePath}
                    data-testid="studio-shell-inline-return-abandon"
                  >
                    Abandon and return
                  </Link>
                ) : null}
              </div>
              {inlineCreationReturnPayload ? (
                <span className="ui-text-small ui-text-secondary">
                  Last return status: {inlineCreationReturnPayload.status}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
            <button className="ui-button" disabled={isBusy} onClick={() => { void refreshSnapshot(); }}>Refresh</button>
            <button className="ui-button" disabled={isBusy} onClick={() => { void runAndRefresh(() => service.startSession(studioId)); }}>Start Session</button>
          </div>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.sessionContext, extensionContext)}

        <StudioShellPanel title="Taxonomy / contract / provenance" subtitle="Form-first metadata editing with optional advanced JSON.">
          <div className="ui-form-json-toggle">
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => {
                if (!isMetadataJsonMode) {
                  setMetadataPatchJson(JSON.stringify(metadataPatch, null, 2));
                  setIsMetadataJsonMode(true);
                  setMetadataJsonError(undefined);
                  return;
                }
                const parsed = parseJson<AssetMetadataPatch>(metadataPatchJson);
                if (!parsed.ok) {
                  setMetadataJsonError("Metadata patch JSON is invalid. Fix JSON before leaving advanced mode.");
                  return;
                }
                setMetadataPatch(parsed.data ?? {});
                setMetadataPatchJson(JSON.stringify(parsed.data ?? {}, null, 2));
                setMetadataJsonError(undefined);
                setIsMetadataJsonMode(false);
              }}
            >
              {isMetadataJsonMode ? "Use Form Editor" : "Edit JSON"}
            </button>
          </div>

          {isMetadataJsonMode ? (
            <label className="ui-stack ui-stack--2xs">
              <span className="ui-text-small">Metadata patch JSON</span>
              <textarea className="ui-textarea" rows={12} value={metadataPatchJson} onChange={(event) => setMetadataPatchJson(event.target.value)} />
            </label>
          ) : (
            <div className="ui-stack ui-stack--sm">
              <div className="ui-form-grid">
                <label className="ui-field">
                  <span className="ui-field__label">Title</span>
                  <input
                    className="ui-input"
                    value={metadataPatch.title ?? ""}
                    onChange={(event) => updateMetadataPatch((current) => ({ ...current, title: event.target.value || undefined }))}
                  />
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Tags</span>
                  <input
                    className="ui-input"
                    value={formatTags(metadataPatch.tags)}
                    onChange={(event) => updateMetadataPatch((current) => ({ ...current, tags: parseTagsInput(event.target.value) }))}
                    placeholder="studio-shell, workflow"
                  />
                </label>
              </div>

              <label className="ui-field">
                <span className="ui-field__label">Summary</span>
                <textarea
                  className="ui-textarea"
                  rows={4}
                  value={metadataPatch.summary === null ? "" : (metadataPatch.summary ?? "")}
                  onChange={(event) => updateMetadataPatch((current) => ({ ...current, summary: event.target.value || undefined }))}
                />
              </label>

              <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
                <strong>Taxonomy</strong>
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Structural kind</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.taxonomy?.structuralKind ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        taxonomy: {
                          structuralKind: event.target.value as never,
                          semanticRole: (current.taxonomy?.semanticRole ?? "") as never,
                          behaviorKind: (current.taxonomy?.behaviorKind ?? "") as never,
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Semantic role</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.taxonomy?.semanticRole ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        taxonomy: {
                          structuralKind: (current.taxonomy?.structuralKind ?? "") as never,
                          semanticRole: event.target.value as never,
                          behaviorKind: (current.taxonomy?.behaviorKind ?? "") as never,
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Behavior kind</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.taxonomy?.behaviorKind ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        taxonomy: {
                          structuralKind: (current.taxonomy?.structuralKind ?? "") as never,
                          semanticRole: (current.taxonomy?.semanticRole ?? "") as never,
                          behaviorKind: event.target.value as never,
                        },
                      }))}
                    />
                  </label>
                </div>
              </div>

              <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
                <strong>Contract</strong>
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Version</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.contract?.version ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        contract: {
                          ...(current.contract ?? { version: "", parameters: [] }),
                          version: event.target.value,
                          parameters: current.contract?.parameters ?? [],
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Execution mode</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.contract?.execution?.invocationMode ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        contract: {
                          ...(current.contract ?? { version: "", parameters: [] }),
                          version: current.contract?.version ?? "1.0.0",
                          parameters: current.contract?.parameters ?? [],
                          execution: {
                            ...(current.contract?.execution ?? {}),
                            invocationMode: event.target.value as never,
                          },
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Input shape</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.contract?.input?.kind ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        contract: {
                          ...(current.contract ?? { version: "", parameters: [] }),
                          version: current.contract?.version ?? "1.0.0",
                          parameters: current.contract?.parameters ?? [],
                          input: {
                            ...(current.contract?.input ?? {}),
                            kind: event.target.value as never,
                          },
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Output shape</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.contract?.output?.kind ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        contract: {
                          ...(current.contract ?? { version: "", parameters: [] }),
                          version: current.contract?.version ?? "1.0.0",
                          parameters: current.contract?.parameters ?? [],
                          output: {
                            ...(current.contract?.output ?? {}),
                            kind: event.target.value as never,
                          },
                        },
                      }))}
                    />
                  </label>
                </div>
              </div>

              <div className="ui-card ui-card--padded ui-stack ui-stack--sm">
                <strong>Provenance</strong>
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Creator ID</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.provenance?.creatorId ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        provenance: {
                          ...(current.provenance ?? {}),
                          creatorId: event.target.value || undefined,
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Source type</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.provenance?.sourceType ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        provenance: {
                          ...(current.provenance ?? {}),
                          sourceType: event.target.value as never,
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Source label</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.provenance?.sourceLabel ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        provenance: {
                          ...(current.provenance ?? {}),
                          sourceLabel: event.target.value || undefined,
                        },
                      }))}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Derivation context</span>
                    <input
                      className="ui-input"
                      value={metadataPatch.provenance?.derivationContext ?? ""}
                      onChange={(event) => updateMetadataPatch((current) => ({
                        ...current,
                        provenance: {
                          ...(current.provenance ?? {}),
                          derivationContext: event.target.value || undefined,
                        },
                      }))}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
          {metadataJsonError ? <p className="ui-text-muted">{metadataJsonError}</p> : null}
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.metadata, extensionContext)}

        <StudioShellPanel title="Dependencies" subtitle="Draft dependency references and version pinning.">
          <div className="ui-form-json-toggle">
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => {
                if (!isDependenciesJsonMode) {
                  setDependenciesJson(JSON.stringify(toDependencyReferences(dependencies), null, 2));
                  setIsDependenciesJsonMode(true);
                  setDependenciesJsonError(undefined);
                  return;
                }
                const parsed = parseJson<Array<{ assetId: string; versionId?: string }>>(dependenciesJson);
                if (!parsed.ok) {
                  setDependenciesJsonError("Dependencies JSON is invalid. Fix JSON before leaving advanced mode.");
                  return;
                }
                const nextDependencies = toDependencyInputs(parsed.data ?? []);
                setDependencies(nextDependencies);
                setDependenciesJson(JSON.stringify(toDependencyReferences(nextDependencies), null, 2));
                setDependenciesJsonError(undefined);
                setIsDependenciesJsonMode(false);
              }}
            >
              {isDependenciesJsonMode ? "Use Form Editor" : "Edit JSON"}
            </button>
          </div>
          {isDependenciesJsonMode ? (
            <textarea className="ui-textarea" rows={8} value={dependenciesJson} onChange={(event) => setDependenciesJson(event.target.value)} />
          ) : (
            <div className="ui-form-array">
              <div className="ui-form-array__header">
                <strong>Dependency references</strong>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  onClick={() => updateDependenciesForm([...dependencies, { assetId: "", versionId: "" }])}
                >
                  Add dependency
                </button>
              </div>
              {dependencies.map((dependency, index) => (
                <div key={`dependency-row-${index}`} className="ui-form-array__row">
                  <div className="ui-form-grid">
                    <label className="ui-field">
                      <span className="ui-field__label">Asset ID</span>
                      <input
                        className="ui-input"
                        value={dependency.assetId}
                        onChange={(event) => {
                          const next = [...dependencies];
                          next[index] = { ...dependency, assetId: event.target.value };
                          updateDependenciesForm(next);
                        }}
                      />
                    </label>
                    <label className="ui-field">
                      <span className="ui-field__label">Version ID (optional)</span>
                      <input
                        className="ui-input"
                        value={dependency.versionId}
                        onChange={(event) => {
                          const next = [...dependencies];
                          next[index] = { ...dependency, versionId: event.target.value };
                          updateDependenciesForm(next);
                        }}
                      />
                    </label>
                  </div>
                  <div className="ui-row ui-row--end">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => {
                        const next = dependencies.filter((_, entryIndex) => entryIndex !== index);
                        updateDependenciesForm(next.length > 0 ? next : [{ assetId: "", versionId: "" }]);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {dependenciesJsonError ? <p className="ui-text-muted">{dependenciesJsonError}</p> : null}
          <button
            className="ui-button"
            disabled={isBusy || !sessionId || !draftId}
            onClick={() => {
              if (!sessionId || !draftId) {
                return;
              }
              const dependenciesToSave = resolveDependenciesForSave();
              if (!dependenciesToSave) {
                return;
              }
              void runAndRefresh(() => service.updateDependencies({
                studioId,
                sessionId,
                draftId,
                dependencies: dependenciesToSave,
              }));
            }}
          >
            Save Dependencies
          </button>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.dependencies, extensionContext)}

        <StudioShellPanel
          sectionId="studio-shell-lifecycle-panel"
          title="Lifecycle / publish / version status"
          subtitle="Explicit draft lifecycle transitions and publish/version operations."
        >
          <div className="ui-stack ui-stack--2xs">
            <div><strong>Lifecycle:</strong> {snapshot?.draft?.lifecycleStatus ?? "n/a"}</div>
            <div><strong>Published versions:</strong> {snapshot?.versions.length ?? 0}</div>
            <div><strong>Last published:</strong> {snapshot?.draft?.lastPublishedVersionId ?? "-"}</div>
          </div>
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <button
              className="ui-button"
              disabled={isBusy || !sessionId || !draftId}
              onClick={() => {
                if (!sessionId || !draftId) {
                  return;
                }
                void runAndRefresh(() => service.transitionLifecycle({
                  studioId,
                  sessionId,
                  draftId,
                  targetStatus: AssetDraftLifecycleStatuses.validated,
                }));
              }}
            >Mark Validated</button>
            <button
              className="ui-button"
              disabled={isBusy || !sessionId || !draftId}
              onClick={() => {
                if (!sessionId || !draftId) {
                  return;
                }
                void runAndRefresh(() => service.transitionLifecycle({
                  studioId,
                  sessionId,
                  draftId,
                  targetStatus: AssetDraftLifecycleStatuses.draft,
                }));
              }}
            >Back to Draft</button>
            <button
              className="ui-button ui-button--primary"
              disabled={isBusy || !sessionId || !draftId}
              onClick={() => {
                if (!sessionId || !draftId) {
                  return;
                }
                void runAndRefresh(() => service.publishVersion({
                  studioId,
                  sessionId,
                  draftId,
                }));
              }}
            >Publish Version</button>
            <button
              className="ui-button"
              disabled={isBusy || !draftId}
              onClick={runValidationFromAuthoring}
            >Run Validation</button>
          </div>
          <ul className="ui-stack ui-stack--2xs">
            {(snapshot?.versions ?? []).map((version) => (
              <li key={version.versionId}>{version.versionLabel ?? version.versionId} - {version.createdAt}</li>
            ))}
          </ul>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.lifecycle, extensionContext)}

        <StudioShellValidationIssuesPanel operationError={error} validationIssues={validationIssues} />
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.validation, extensionContext)}
      </div>
    </section>
  );
}
