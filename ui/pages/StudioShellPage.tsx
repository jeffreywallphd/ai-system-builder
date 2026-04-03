import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AssetDraftLifecycleStatuses, type AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import type {
  DataStudioExecutionReadinessReadModel,
  RunDataStudioPipelineReadModel,
  PersistedWorkflowReadModel,
  StudioShellSnapshotReadModel,
  StudioShellValidationIssue,
  WorkflowExecutionReadinessReadModel,
} from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import StudioAssetHostBoundary from "../components/studio-shell/studio-assets/StudioAssetHostBoundary";
import WorkflowStudioExecutionFeedbackPanel, {
  type WorkflowStudioRunFeedback,
} from "../components/studio-shell/workflow/WorkflowStudioExecutionFeedbackPanel";
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
  WorkflowStudioEntryPaths,
  type WorkflowStudioEntryRouteResolution,
} from "../studio-shell/workflow/WorkflowStudioEntryRouting";
import {
  buildWorkflowStudioRunDetailPath,
  buildWorkflowStudioRunHistoryPath,
} from "../studio-shell/workflow/WorkflowStudioRunRouting";
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
import { createWorkflowAssetMetadata } from "../../domain/workflow-studio/WorkflowStudioDomain";
import { DataStudioWizardPersistenceStorageKey } from "../studio-shell/data/DataStudioPreparationWizardStateAdapter";
import {
  createStudioHostContext,
  createStudioHostSessionState,
  datasetPipelineStudioSurfaceAssetDefinition,
  datasetStudioSurfaceAssetDefinition,
  schemaStudioSurfaceAssetDefinition,
  systemStudioSurfaceAssetDefinition,
  workflowStudioSurfaceAssetDefinition,
} from "../studio-shell/studio-assets/StudioSurfaceAssetDefinitions";
import { StudioAssetRenderModes } from "../studio-shell/studio-assets/StudioAssetContracts";
import type { StudioEmbeddedEvent } from "../studio-shell/studio-assets/StudioEmbeddedEventContracts";
import { resolveDraftAuthoringExperienceAssetIds } from "../studio-shell/experience-assets/ExperienceSurfaceAssets";

interface JsonParseResult<T> {
  readonly ok: boolean;
  readonly data?: T;
}

interface DraftDependencyInput {
  readonly assetId: string;
  readonly versionId: string;
}

interface WorkflowCoreMetadataDraft {
  readonly name: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
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

function toWorkflowCoreMetadataDraft(
  metadataPatch: AssetMetadataPatch,
  fallbackName: string,
  fallbackTags: ReadonlyArray<string>,
): WorkflowCoreMetadataDraft {
  const normalizedName = (metadataPatch.title ?? fallbackName).trim();
  const normalizedSummary = metadataPatch.summary === null
    ? undefined
    : metadataPatch.summary?.trim() || undefined;
  const normalizedTags = parseTagsInput(formatTags(metadataPatch.tags ?? fallbackTags));

  return Object.freeze({
    name: normalizedName,
    summary: normalizedSummary,
    tags: normalizedTags,
  });
}

function workflowCoreMetadataEquals(
  left: WorkflowCoreMetadataDraft,
  right: WorkflowCoreMetadataDraft,
): boolean {
  if (left.name !== right.name || left.summary !== right.summary) {
    return false;
  }
  if (left.tags.length !== right.tags.length) {
    return false;
  }
  for (let index = 0; index < left.tags.length; index += 1) {
    if (left.tags[index] !== right.tags[index]) {
      return false;
    }
  }
  return true;
}

function buildMetadataPatchFromDraftMetadata(
  metadata: NonNullable<StudioShellSnapshotReadModel["draft"]>["metadata"],
): AssetMetadataPatch {
  return Object.freeze({
    title: metadata.title,
    summary: metadata.summary,
    tags: metadata.tags,
    taxonomy: metadata.taxonomy,
    contract: metadata.contract,
    provenance: metadata.provenance,
  });
}

function validateWorkflowCoreMetadataDraft(metadata: WorkflowCoreMetadataDraft): string | undefined {
  if (!metadata.name.trim()) {
    return "Workflow name is required.";
  }
  return undefined;
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
  return "You have unsaved workflow changes. Click OK to save before leaving, or Cancel to leave without saving.";
}

function readPersistedDataStudioPipelineState(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage.getItem(DataStudioWizardPersistenceStorageKey) ?? undefined;
}

interface StudioShellPageProps {
  readonly studioRegistration?: StudioRegistration;
  readonly extensions?: ReadonlyArray<StudioShellExtensionContribution>;
  readonly workflowModeRoute?: WorkflowStudioModeRouteResolution;
  readonly workflowWizardPageRoute?: WorkflowStudioWizardPageRouteResolution;
  readonly workflowEntryRoute?: WorkflowStudioEntryRouteResolution;
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
  workflowEntryRoute,
}: StudioShellPageProps): JSX.Element {
  const studioId = studioRegistration?.studioId ?? "studio-shell-main";
  const isWorkflowStudio = studioRegistration?.role === "workflow";
  const isSystemStudio = studioRegistration?.kind === "system";
  const draftAuthoringExperienceAssetIds = resolveDraftAuthoringExperienceAssetIds({
    explicitAssetIds: studioRegistration?.shell?.experienceAssets,
    surfaces: studioRegistration?.shell?.draftAuthoringSurfaces,
  });
  const defaultDraftTitle = studioRegistration?.defaults.title ?? "Studio Shell Draft";
  const defaultDraftTags = studioRegistration?.defaults.tags ?? ["studio-shell"];
  const defaultContent = studioRegistration?.defaults.contentTemplate ?? "{}";
  const shellTitle = studioRegistration?.shell?.title ?? studioRegistration?.displayName ?? "Studio Shell";
  const shellSubtitle = studioRegistration?.shell?.subtitle
    ?? (studioRegistration
      ? `Shared ${studioRegistration.kind}-studio shell for ${studioRegistration.role} assets: focused authoring, lifecycle/version, and validation.`
      : "Reusable bounded shell for focused studio authoring, lifecycle/version state, and validation.");
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
  const initialWorkflowCoreMetadata = useMemo(
    () => toWorkflowCoreMetadataDraft(initialMetadataPatch, defaultDraftTitle, defaultDraftTags),
    [defaultDraftTags, defaultDraftTitle, initialMetadataPatch],
  );
  const [workflowMetadataBaseline, setWorkflowMetadataBaseline] = useState<WorkflowCoreMetadataDraft>(
    initialWorkflowCoreMetadata,
  );
  const [isWorkflowSavePending, setIsWorkflowSavePending] = useState(false);
  const [workflowSaveError, setWorkflowSaveError] = useState<string | undefined>();
  const [dependencies, setDependencies] = useState<ReadonlyArray<DraftDependencyInput>>(initialDependencies);
  const [workflowModeState, setWorkflowModeState] = useState<WorkflowStudioModeState | undefined>(
    () => workflowModeStore?.getState(),
  );
  const [workflowRunFeedback, setWorkflowRunFeedback] = useState<WorkflowStudioRunFeedback | undefined>();
  const [workflowExecutionReadiness, setWorkflowExecutionReadiness] = useState<WorkflowExecutionReadinessReadModel | undefined>();
  const [isWorkflowReadinessPending, setIsWorkflowReadinessPending] = useState(false);
  const [dataStudioExecutionReadiness, setDataStudioExecutionReadiness] = useState<DataStudioExecutionReadinessReadModel | undefined>();
  const [dataStudioRunResult, setDataStudioRunResult] = useState<RunDataStudioPipelineReadModel | undefined>();
  const [isDataStudioReadinessPending, setIsDataStudioReadinessPending] = useState(false);
  const leftDrawerConfiguration = studioRegistration?.shell?.drawers?.left;
  const rightDrawerConfiguration = studioRegistration?.shell?.drawers?.right;
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(leftDrawerConfiguration?.defaultOpen ?? true);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(rightDrawerConfiguration?.defaultOpen ?? true);
  const automationPrefillAppliedRef = useRef(false);
  const lastRestoredWorkflowReturnSearchRef = useRef<string | undefined>(undefined);
  const lastAppliedWorkflowEntryRef = useRef<string | undefined>(undefined);
  const lastWorkflowMetadataSyncKeyRef = useRef<string | undefined>(undefined);
  const workflowCoreMetadataDraft = useMemo(
    () => toWorkflowCoreMetadataDraft(metadataPatch, defaultDraftTitle, defaultDraftTags),
    [defaultDraftTags, defaultDraftTitle, metadataPatch],
  );
  const hasWorkflowMetadataUnsavedChanges = isWorkflowStudio
    && !workflowCoreMetadataEquals(workflowCoreMetadataDraft, workflowMetadataBaseline);

  const updateContent = (nextContent: string): void => {
    setContent(nextContent);
    if (isWorkflowStudio) {
      setWorkflowRunFeedback(undefined);
      setWorkflowExecutionReadiness(undefined);
      setIsWorkflowReadinessPending(false);
      setWorkflowSaveError(undefined);
    } else if (studioRegistration?.role === "dataset") {
      setDataStudioExecutionReadiness(undefined);
      setDataStudioRunResult(undefined);
      setIsDataStudioReadinessPending(false);
    }
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
    if (!isWorkflowStudio) {
      return;
    }

    const sourceMetadataPatch = snapshot?.draft
      ? buildMetadataPatchFromDraftMetadata(snapshot.draft.metadata)
      : initialMetadataPatch;
    const sourceWorkflowMetadata = toWorkflowCoreMetadataDraft(
      sourceMetadataPatch,
      defaultDraftTitle,
      defaultDraftTags,
    );
    const syncKey = `${studioId}:${snapshot?.draft?.draftId ?? "new"}:${snapshot?.draft?.revision ?? 0}`;
    const contextChanged = lastWorkflowMetadataSyncKeyRef.current !== syncKey;
    const shouldSynchronize = contextChanged || !hasWorkflowMetadataUnsavedChanges;

    if (shouldSynchronize) {
      if (!workflowCoreMetadataEquals(workflowCoreMetadataDraft, sourceWorkflowMetadata)) {
        setMetadataPatch(sourceMetadataPatch);
      }
      if (!workflowCoreMetadataEquals(workflowMetadataBaseline, sourceWorkflowMetadata)) {
        setWorkflowMetadataBaseline(sourceWorkflowMetadata);
      }
      setWorkflowSaveError(undefined);
    }

    lastWorkflowMetadataSyncKeyRef.current = syncKey;
  }, [
    defaultDraftTags,
    defaultDraftTitle,
    hasWorkflowMetadataUnsavedChanges,
    initialMetadataPatch,
    isWorkflowStudio,
    snapshot?.draft,
    studioId,
    workflowCoreMetadataDraft,
    workflowMetadataBaseline,
  ]);

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
    setWorkflowMetadataBaseline(initialWorkflowCoreMetadata);
    setWorkflowSaveError(undefined);
    setIsWorkflowSavePending(false);
    lastWorkflowMetadataSyncKeyRef.current = undefined;

    setDependencies(initialDependencies);
    setWorkflowRunFeedback(undefined);
    setWorkflowExecutionReadiness(undefined);
    setIsWorkflowReadinessPending(false);
    setDataStudioExecutionReadiness(undefined);
    setDataStudioRunResult(undefined);
    setIsDataStudioReadinessPending(false);
  }, [initialDependencies, initialMetadataPatch, initialWorkflowCoreMetadata]);

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
      return nextPatch;
    });
    automationPrefillAppliedRef.current = true;
  }, [automationIntent, content, defaultContent, isWorkflowStudio, shouldSeedAutomationIntent, snapshot?.draft]);

  useEffect(() => {
    if (!isWorkflowStudio || !workflowEntryRoute?.invalidEntryPath) {
      return;
    }
    setError(`Unsupported workflow entry '${workflowEntryRoute.invalidEntryPath}'. Opened default Workflow Studio route instead.`);
  }, [isWorkflowStudio, workflowEntryRoute?.invalidEntryPath]);

  useEffect(() => {
    if (!isWorkflowStudio || !workflowEntryRoute || !snapshot?.activeSessionId) {
      return;
    }

    const signature = `${workflowEntryRoute.resolvedEntryPath}:${workflowEntryRoute.workflowId ?? ""}`;
    if (lastAppliedWorkflowEntryRef.current === signature) {
      return;
    }

    let cancelled = false;

    const createDraftFromPersisted = async (
      sessionId: string,
      persistedWorkflow: PersistedWorkflowReadModel,
    ): Promise<boolean> => {
      const response = await service.createDraft({
        studioId,
        sessionId,
        assetId: persistedWorkflow.id,
        content: persistedWorkflow.serializedDraft,
        metadata: createWorkflowAssetMetadata({
          title: persistedWorkflow.name,
          summary: persistedWorkflow.metadata.summary,
          tags: persistedWorkflow.metadata.tags,
          sourceLabel: "workflow-persistence",
        }),
      });
      if (!response.ok) {
        if (!cancelled) {
          setError(response.error?.message ?? "Failed to open persisted workflow in Workflow Studio.");
        }
        return false;
      }
      return true;
    };

    const applyWorkflowEntry = async (): Promise<void> => {
      if (workflowEntryRoute.resolvedEntryPath === WorkflowStudioEntryPaths.default) {
        lastAppliedWorkflowEntryRef.current = signature;
        return;
      }

      if (workflowEntryRoute.resolvedEntryPath === WorkflowStudioEntryPaths.new) {
        const startSession = await service.startSession(studioId);
        if (!startSession.ok || !startSession.data?.activeSessionId) {
          if (!cancelled) {
            setError(startSession.error?.message ?? "Failed to create a new workflow authoring session.");
          }
          return;
        }

        const created = await service.createDraft({
          studioId,
          sessionId: startSession.data.activeSessionId,
          content: defaultContent,
          metadata: createWorkflowAssetMetadata({
            title: defaultDraftTitle,
            tags: defaultDraftTags,
            sourceLabel: "workflow-studio",
          }),
        });
        if (!created.ok) {
          if (!cancelled) {
            setError(created.error?.message ?? "Failed to initialize a new workflow draft.");
          }
          return;
        }

        await refreshSnapshot();
        if (!cancelled) {
          setError(undefined);
          lastAppliedWorkflowEntryRef.current = signature;
        }
        return;
      }

      const targetWorkflowId = workflowEntryRoute.workflowId?.trim();
      if (!targetWorkflowId) {
        if (!cancelled) {
          setError("Workflow entry requires a valid workflow id.");
          lastAppliedWorkflowEntryRef.current = signature;
        }
        return;
      }

      const persistedOrDuplicated = workflowEntryRoute.resolvedEntryPath === WorkflowStudioEntryPaths.duplicate
        ? await service.duplicatePersistedWorkflow({
          sourceWorkflowId: targetWorkflowId,
        })
        : await service.getPersistedWorkflow(targetWorkflowId);
      if (!persistedOrDuplicated.ok || !persistedOrDuplicated.data) {
        if (!cancelled) {
          const defaultMessage = workflowEntryRoute.resolvedEntryPath === WorkflowStudioEntryPaths.duplicate
            ? `Persisted workflow '${targetWorkflowId}' could not be duplicated.`
            : `Persisted workflow '${targetWorkflowId}' could not be loaded.`;
          setError(persistedOrDuplicated.error?.message ?? defaultMessage);
          lastAppliedWorkflowEntryRef.current = signature;
        }
        return;
      }

      if (
        workflowEntryRoute.resolvedEntryPath === WorkflowStudioEntryPaths.resumeDraft
        && persistedOrDuplicated.data.status !== "draft"
      ) {
        if (!cancelled) {
          setError(`Workflow '${targetWorkflowId}' is not a resumable draft.`);
          lastAppliedWorkflowEntryRef.current = signature;
        }
        return;
      }

      const startSession = await service.startSession(studioId);
      if (!startSession.ok || !startSession.data?.activeSessionId) {
        if (!cancelled) {
          setError(startSession.error?.message ?? "Failed to start a workflow authoring session.");
          lastAppliedWorkflowEntryRef.current = signature;
        }
        return;
      }

      const created = await createDraftFromPersisted(startSession.data.activeSessionId, persistedOrDuplicated.data);
      if (!created) {
        if (!cancelled) {
          lastAppliedWorkflowEntryRef.current = signature;
        }
        return;
      }

      await refreshSnapshot();
      if (!cancelled) {
        setError(undefined);
        lastAppliedWorkflowEntryRef.current = signature;
      }
    };

    void applyWorkflowEntry();
    return () => {
      cancelled = true;
    };
  }, [
    defaultContent,
    defaultDraftTags,
    defaultDraftTitle,
    isWorkflowStudio,
    snapshot?.activeSessionId,
    studioId,
    workflowEntryRoute,
    service,
  ]);

  const runAndRefreshWithResult = async (
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ): Promise<{ readonly ok: boolean; readonly errorMessage?: string }> => {
    setIsBusy(true);
    try {
      const response = await action();
      if (!response.ok) {
        const errorMessage = response.error?.message ?? "Studio shell operation failed.";
        setError(errorMessage);
        return Object.freeze({
          ok: false,
          errorMessage,
        });
      }
      await refreshSnapshot();
      setError(undefined);
      return Object.freeze({ ok: true });
    } finally {
      setIsBusy(false);
    }
  };

  const runAndRefresh = async (action: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    await runAndRefreshWithResult(action);
  };

  const updateMetadataPatch = (updater: (current: AssetMetadataPatch) => AssetMetadataPatch): void => {
    setMetadataPatch((current) => updater(current));
    if (isWorkflowStudio) {
      setWorkflowSaveError(undefined);
    }
  };

  const resolveMetadataPatchForSave = (): AssetMetadataPatch | undefined => {
    if (isWorkflowStudio) {
      const metadataValidationError = validateWorkflowCoreMetadataDraft(workflowCoreMetadataDraft);
      if (metadataValidationError) {
        setWorkflowSaveError(metadataValidationError);
        return undefined;
      }
      setWorkflowSaveError(undefined);
      return Object.freeze({
        title: workflowCoreMetadataDraft.name,
        summary: workflowCoreMetadataDraft.summary,
        tags: workflowCoreMetadataDraft.tags,
        taxonomy: metadataPatch.taxonomy,
        contract: metadataPatch.contract,
        provenance: metadataPatch.provenance,
      });
    }
    return metadataPatch;
  };

  const resolveDependenciesForSave = (): ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }> | undefined => {
    return toDependencyReferences(dependencies);
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
  const hasWorkflowUnsavedChanges = isWorkflowStudio
    && (Boolean(workflowModeState?.hasLocalDraftEdits) || hasWorkflowMetadataUnsavedChanges);
  const workflowDraftStatusTone = hasWorkflowDraftParseError
    ? "danger"
    : isWorkflowSavePending
      ? "neutral"
      : workflowSaveError
        ? "danger"
        : hasWorkflowUnsavedChanges
          ? "warning"
          : "success";
  const workflowDraftStatusLabel = hasWorkflowDraftParseError
    ? "Draft parse error"
    : isWorkflowSavePending
      ? "Saving changes..."
      : workflowSaveError
        ? "Save failed"
        : hasWorkflowUnsavedChanges
          ? "Unsaved changes"
          : "Saved";
  const workflowDraftStatusDetail = hasWorkflowDraftParseError
    ? "Workflow draft JSON has parse errors. Fix JSON before saving this draft."
    : isWorkflowSavePending
      ? "Saving workflow draft and metadata to studio persistence..."
      : workflowSaveError
        ? workflowSaveError
        : hasWorkflowUnsavedChanges
          ? "Workflow draft or metadata edits are unsaved. Save before leaving Workflow Studio to persist changes."
          : "Workflow draft and metadata are synchronized with persisted storage.";
  const workflowRunHistoryPath = snapshot?.draft?.assetId
    ? buildWorkflowStudioRunHistoryPath({
      workflowId: snapshot.draft.assetId,
      workflowStatus: snapshot.draft.lifecycleStatus === AssetDraftLifecycleStatuses.draft
        ? "draft"
        : "saved",
    })
    : undefined;
  const workflowLatestRunDetailPath = workflowRunFeedback?.result?.run?.runId && snapshot?.draft?.assetId
    ? buildWorkflowStudioRunDetailPath(workflowRunFeedback.result.run.runId, {
      workflowId: snapshot.draft.assetId,
      workflowStatus: snapshot.draft.lifecycleStatus === AssetDraftLifecycleStatuses.draft
        ? "draft"
        : "saved",
    })
    : undefined;
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

    if (isWorkflowStudio) {
      setIsWorkflowSavePending(true);
      setWorkflowSaveError(undefined);
    }

    const resolvedMetadataPatch = resolveMetadataPatchForSave();
    if (!resolvedMetadataPatch) {
      if (isWorkflowStudio) {
        setIsWorkflowSavePending(false);
      }
      return false;
    }

    const dataStudioPipelineState = studioRegistration?.role === "dataset"
      ? (readPersistedDataStudioPipelineState() ?? content).trim()
      : undefined;
    if (studioRegistration?.role === "dataset" && !dataStudioPipelineState) {
      setError("Data pipeline state is unavailable. Configure the Data Studio wizard before saving.");
      if (isWorkflowStudio) {
        setIsWorkflowSavePending(false);
      }
      return false;
    }

    const contentToSave = studioRegistration?.role === "dataset"
      ? dataStudioPipelineState!
      : workflowDraftContent;

    let saveResult: { readonly ok: boolean; readonly errorMessage?: string };
    if (!draftId) {
      const metadata = buildCreateMetadata(defaultDraftTitle, defaultDraftTags, resolvedMetadataPatch);
      saveResult = await runAndRefreshWithResult(() => service.createDraft({
        studioId,
        sessionId,
        assetId: studioRegistration?.defaults.assetId,
        content: contentToSave,
        metadata,
      }));
    } else {
      saveResult = await runAndRefreshWithResult(() => service.updateDraft({
        studioId,
        sessionId,
        draftId,
        content: contentToSave,
        metadataPatch: resolvedMetadataPatch,
      }));
    }

    if (isWorkflowStudio) {
      setIsWorkflowSavePending(false);
      if (saveResult.ok) {
        setWorkflowSaveError(undefined);
        setWorkflowMetadataBaseline(workflowCoreMetadataDraft);
      } else {
        setWorkflowSaveError(saveResult.errorMessage ?? "Workflow save failed.");
      }
    }

    return saveResult.ok;
  };

  const saveDraftFromAuthoring = (): void => {
    void saveDraftFromAuthoringAsync();
  };

  const handleStudioAssetEvent = (event: StudioEmbeddedEvent): void => {
    if (event.intent.kind === "studio.intent.commit-request") {
      saveDraftFromAuthoring();
    }
  };

  const runValidationFromAuthoring = (): void => {
    if (isWorkflowStudio) {
      setIsWorkflowReadinessPending(true);
      void (async () => {
        const response = await service.assessWorkflowExecutionReadiness({
          studioId,
          draftId,
          content: workflowDraftContent,
        });
        setIsWorkflowReadinessPending(false);
        if (!response.ok || !response.data) {
          setError(response.error?.message ?? "Failed to validate workflow execution readiness.");
          return;
        }
        setWorkflowExecutionReadiness(response.data);
        setError(undefined);
      })();
      return;
    }

    if (studioRegistration?.role === "dataset") {
      const persistedPipelineState = (readPersistedDataStudioPipelineState() ?? content).trim();
      if (!persistedPipelineState) {
        setError("Data pipeline state is unavailable. Configure the Data Studio wizard before running validation.");
        return;
      }
      setIsDataStudioReadinessPending(true);
      void (async () => {
        const response = await service.assessDataStudioExecutionReadiness({
          studioId,
          pipelineState: persistedPipelineState,
        });
        setIsDataStudioReadinessPending(false);
        if (!response.ok || !response.data) {
          setError(response.error?.message ?? "Failed to validate Data Studio pipeline readiness.");
          return;
        }
        setDataStudioExecutionReadiness(response.data);
        setError(undefined);
      })();
      return;
    }

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

  const runWorkflowFromAuthoring = (): void => {
    if (!isWorkflowStudio || hasWorkflowDraftParseError) {
      return;
    }

    setWorkflowRunFeedback({
      status: "running",
      message: "Running workflow validation and launch pipeline...",
    });
    setIsWorkflowReadinessPending(false);

    void (async () => {
      const response = await service.runWorkflowDraft({
        studioId,
        draftId,
        content: workflowDraftContent,
      });
      if (!response.ok || !response.data) {
        const message = response.error?.message ?? "Workflow launch failed.";
        setWorkflowRunFeedback({
          status: "failed",
          message,
        });
        setError(message);
        return;
      }

      if (response.data.launchStatus === "blocked") {
        setWorkflowExecutionReadiness(response.data.validation);
        setWorkflowRunFeedback({
          status: "blocked",
          message: "Workflow launch was blocked by pre-execution validation issues.",
          result: response.data,
        });
        return;
      }

      if (response.data.launchStatus === "failed") {
        setWorkflowExecutionReadiness(response.data.validation);
        setWorkflowRunFeedback({
          status: "failed",
          message: response.data.failureMessage ?? "Workflow launch failed during execution startup.",
          result: response.data,
        });
        return;
      }

      const runtimeStatus = response.data.runtime?.status ?? "completed";
      setWorkflowExecutionReadiness(response.data.validation);
      setWorkflowRunFeedback({
        status: "launched",
        message: `Workflow launch started successfully. Runtime status: ${runtimeStatus}.`,
        result: response.data,
      });
      setError(undefined);
    })();
  };

  const runDataStudioPipelineFromAuthoring = (): void => {
    if (studioRegistration?.role !== "dataset") {
      return;
    }
    const persistedPipelineState = (readPersistedDataStudioPipelineState() ?? content).trim();
    if (!persistedPipelineState) {
      setError("Data pipeline state is unavailable. Configure the Data Studio wizard before running execution.");
      return;
    }
    setIsDataStudioReadinessPending(true);
    setDataStudioRunResult(undefined);
    void (async () => {
      const response = await service.runDataStudioPipeline({
        studioId,
        pipelineState: persistedPipelineState,
        initiatedBy: "studio-shell",
        executionReason: "toolbar-run",
      });
      setIsDataStudioReadinessPending(false);
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Data pipeline launch failed.");
        return;
      }
      setDataStudioExecutionReadiness(response.data.readiness);
      setDataStudioRunResult(response.data);
      if (response.data.launchStatus === "blocked") {
        setError("Data pipeline launch was blocked by readiness validation.");
        return;
      }
      if (response.data.launchStatus === "failed") {
        setError(response.data.failureMessage ?? "Data pipeline execution failed.");
        return;
      }
      setError(undefined);
    })();
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

    if (action.kind === StudioShellToolbarActionKinds.runWorkflowDraft) {
      runWorkflowFromAuthoring();
      return;
    }

    if (action.kind === StudioShellToolbarActionKinds.runDataPipeline) {
      runDataStudioPipelineFromAuthoring();
      return;
    }

    setWorkflowModeFromToolbar(action.modeId);
  };

  const isToolbarActionDisabled = (action: StudioShellToolbarAction): boolean => {
    if (action.kind === StudioShellToolbarActionKinds.refreshSnapshot) {
      return isBusy;
    }
    if (action.kind === StudioShellToolbarActionKinds.saveDraft) {
      return isBusy || isWorkflowSavePending || !sessionId || hasWorkflowDraftParseError;
    }
    if (action.kind === StudioShellToolbarActionKinds.runValidation) {
      if (isWorkflowStudio) {
        return isBusy || hasWorkflowDraftParseError || isWorkflowReadinessPending;
      }
      if (studioRegistration?.role === "dataset") {
        return isBusy || isDataStudioReadinessPending;
      }
      return isBusy || !draftId;
    }
    if (action.kind === StudioShellToolbarActionKinds.runWorkflowDraft) {
      return isBusy
        || !isWorkflowStudio
        || hasWorkflowDraftParseError
        || workflowRunFeedback?.status === "running"
        || isWorkflowReadinessPending
        || (workflowExecutionReadiness?.ready === false && workflowExecutionReadiness.blockingIssueCount > 0);
    }
    if (action.kind === StudioShellToolbarActionKinds.runDataPipeline) {
      return isBusy
        || studioRegistration?.role !== "dataset"
        || isDataStudioReadinessPending
        || (dataStudioExecutionReadiness?.executionReady === false && dataStudioExecutionReadiness.blockingIssueCount > 0);
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
      setDraftContent: (nextContent) => {
        updateContent(nextContent);
      },
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
  const operationError = error;

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
            <p className={hasWorkflowDraftParseError || workflowSaveError ? "ui-text-small ui-text-danger" : "ui-text-small ui-text-secondary"}>
              {workflowDraftStatusDetail}
            </p>
            {workflowRunHistoryPath ? (
              <div className="ui-row ui-row--wrap">
                <Link className="ui-button ui-button--ghost ui-button--sm" to={workflowRunHistoryPath}>
                  View run history
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {isWorkflowStudio ? (
          <WorkflowStudioExecutionFeedbackPanel
            readiness={workflowExecutionReadiness}
            isReadinessPending={isWorkflowReadinessPending}
            runFeedback={workflowRunFeedback}
            runHistoryPath={workflowRunHistoryPath}
            runDetailPath={workflowLatestRunDetailPath}
          />
        ) : null}
        {studioRegistration?.role === "dataset" ? (
          <StudioShellPanel
            title="Data Pipeline Run"
            subtitle="Execution readiness and launch diagnostics for the canonical Data Studio pipeline state."
          >
            <div className="ui-stack ui-stack--2xs">
              <div><strong>Readiness:</strong> {dataStudioExecutionReadiness?.executionReady ? "ready" : "not-ready"}</div>
              <div><strong>Blocking issues:</strong> {dataStudioExecutionReadiness?.blockingIssueCount ?? 0}</div>
              <div><strong>Warnings:</strong> {dataStudioExecutionReadiness?.warningIssueCount ?? 0}</div>
              <div><strong>Run status:</strong> {dataStudioRunResult?.launchStatus ?? "-"}</div>
              <div><strong>Execution state:</strong> {dataStudioRunResult?.execution.state ?? "-"}</div>
              {dataStudioRunResult?.result ? (
                <div><strong>Prepared output:</strong> {dataStudioRunResult.result.preparedOutput?.storageReference ?? "not-persisted"}</div>
              ) : null}
              {isDataStudioReadinessPending ? (
                <span className="ui-text-small ui-text-secondary">Assessing readiness / running pipeline...</span>
              ) : null}
              {dataStudioRunResult?.failureMessage ? (
                <span className="ui-text-small ui-text-danger">{dataStudioRunResult.failureMessage}</span>
              ) : null}
            </div>
          </StudioShellPanel>
        ) : null}

        <StudioShellPanel title="Asset draft authoring" subtitle="Thin authoring surface over studio-shell draft contracts.">
          {isSystemStudio ? (
            <StudioAssetHostBoundary
              asset={systemStudioSurfaceAssetDefinition}
              context={createStudioHostContext({
                mode: StudioAssetRenderModes.full,
                input: {
                  content,
                  validationIssues,
                  extensionContext,
                  experienceAssetIds: draftAuthoringExperienceAssetIds,
                },
              })}
              session={createStudioHostSessionState({
                sessionId,
                draftId,
                isBusy,
                operationError,
              })}
              onEvent={handleStudioAssetEvent}
            />
          ) : studioRegistration?.role === "dataset" ? (
            <StudioAssetHostBoundary
              asset={datasetStudioSurfaceAssetDefinition}
              context={createStudioHostContext({
                mode: StudioAssetRenderModes.full,
                input: {
                  content,
                  extensionContext,
                  experienceAssetIds: draftAuthoringExperienceAssetIds,
                },
              })}
              session={createStudioHostSessionState({
                sessionId,
                draftId,
                isBusy,
                operationError,
              })}
              onEvent={handleStudioAssetEvent}
            />
          ) : studioRegistration?.role === "schema" ? (
            <StudioAssetHostBoundary
              asset={schemaStudioSurfaceAssetDefinition}
              context={createStudioHostContext({
                mode: StudioAssetRenderModes.full,
                input: {
                  content,
                  onChangeContent: updateContent,
                },
              })}
              session={createStudioHostSessionState({
                sessionId,
                draftId,
                isBusy,
                operationError,
              })}
              onEvent={handleStudioAssetEvent}
            />
          ) : studioRegistration?.role === "dataset-pipeline" ? (
            <StudioAssetHostBoundary
              asset={datasetPipelineStudioSurfaceAssetDefinition}
              context={createStudioHostContext({
                mode: StudioAssetRenderModes.full,
                input: {
                  content,
                  onChangeContent: updateContent,
                },
              })}
              session={createStudioHostSessionState({
                sessionId,
                draftId,
                isBusy,
                operationError,
              })}
              onEvent={handleStudioAssetEvent}
            />
          ) : (
            <StudioAssetHostBoundary
              asset={workflowStudioSurfaceAssetDefinition}
              context={createStudioHostContext({
                mode: StudioAssetRenderModes.full,
                input: {
                  isWorkflowStudio,
                  content,
                  onChangeContent: updateContent,
                  invalidModeRouteId: isWorkflowStudio ? workflowModeRoute?.invalidModeId : undefined,
                  invalidWizardPageRouteId: isWorkflowStudio ? workflowWizardPageRoute?.invalidPageId : undefined,
                  workflowModeContext: workflowModeStore && workflowModeState
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
                    : undefined,
                  experienceAssetIds: draftAuthoringExperienceAssetIds,
                },
              })}
              session={createStudioHostSessionState({
                sessionId,
                draftId,
                isBusy,
                operationError,
              })}
              onEvent={handleStudioAssetEvent}
            />
          )}
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
            <button
              className="ui-button ui-button--primary"
              disabled={isBusy || isWorkflowSavePending || !sessionId || hasWorkflowDraftParseError}
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
        {inlineCreationReturnTarget ? (
          <StudioShellPanel title="Return to previous workspace" subtitle="When you're done, send this draft back to where you started.">
            <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="studio-shell-inline-return-panel">
              <span className="ui-text-small ui-text-secondary">
                {selectorLaunchContext
                  ? `This studio was launched from selector session ${selectorLaunchContext.selectorSessionId}.`
                  : "This studio was opened from another workspace."}
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
          </StudioShellPanel>
        ) : null}

        <StudioShellPanel
          title={isWorkflowStudio ? "Workflow details" : "Asset details"}
          subtitle={isWorkflowStudio
            ? "Edit the workflow name and summary used across saved drafts and Explore."
            : "Edit the name and summary shown across saved drafts and Explore."}
        >
          <div className="ui-stack ui-stack--sm">
            <div className="ui-form-grid">
              <label className="ui-field">
                <span className="ui-field__label">{isWorkflowStudio ? "Workflow name" : "Asset name"}</span>
                <input
                  className="ui-input"
                  value={metadataPatch.title ?? ""}
                  onChange={(event) => updateMetadataPatch((current) => ({
                    ...current,
                    title: event.target.value,
                  }))}
                  placeholder={isWorkflowStudio ? "Workflow name" : "Asset name"}
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Tags</span>
                <input
                  className="ui-input"
                  value={formatTags(metadataPatch.tags)}
                  onChange={(event) => updateMetadataPatch((current) => ({
                    ...current,
                    tags: parseTagsInput(event.target.value),
                  }))}
                  placeholder={isWorkflowStudio ? "workflow, orchestration" : "studio-shell"}
                />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Summary</span>
              <textarea
                className="ui-textarea"
                rows={4}
                value={metadataPatch.summary === null ? "" : (metadataPatch.summary ?? "")}
                onChange={(event) => updateMetadataPatch((current) => ({
                  ...current,
                  summary: event.target.value || undefined,
                }))}
              />
            </label>
          </div>
        </StudioShellPanel>
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
