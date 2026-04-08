import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
  resolveComfyImageManipulationConfig,
  validateComfyImageManipulationConfig,
  type ComfyImageManipulationConfig,
  type ComfyImageManipulationConfigValidationIssue,
} from "@application/system-studio/ComfyImageManipulationPropertySchema";
import { ImageManipulationSystemTemplate } from "@application/system-studio/ImageManipulationSystemTemplate";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";
import { validateReferenceImageCrossStudioContext, type CrossStudioIntegrityIssue } from "@application/system-studio/ReferenceImageCrossStudioIntegrity";
import type { OutputGalleryItem } from "@application/system-runtime/OutputGalleryDataContract";
import type { ReferenceImageDatasetBindingId } from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import type { FileIngestionPolicy } from "@domain/ingestion/interfaces/IFileIngestion";
import { createBrowserImageUploadIngestionAdapter } from "../assets/image-system/BrowserImageUploadIngestionAdapter";
import { ImageUploadPanel } from "../assets/image-system/ImageUploadPanel";
import { ImageGallerySlider } from "../assets/image-system/ImageGallerySlider";
import { ImagePreviewPanel } from "../assets/image-system/ImagePreviewPanel";
import { ImageRenderFrame } from "../assets/image-system/ImageRenderFrame";
import { ImageStatusNotice } from "../assets/image-system/ImageStatusNotice";
import { mapOutputGalleryItemToImageViewModel } from "../assets/image-system/ImageOutputGalleryDataAdapter";
import type { ImageUiViewModel } from "../assets/image-system/ImageUiContracts";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";
import {
  ImageAssetManagementService,
  type ImageLibraryStudioImageAsset,
  type RecentStudioImageAsset,
} from "../../services/ImageAssetManagementService";
import ComfyImageManipulationPropertyEditor from "../assets/image-system/ComfyImageManipulationPropertyEditor";
import {
  createReferenceImageOutputPersistenceRequest,
  type ReferenceImageExecutionFlowIssue,
  type ReferenceImageExecutionFlowStep,
} from "../../runtime/ReferenceImageExecutionFlowService";
import { mapImageManipulationRuntimeStateToExecutionRequest } from "../../runtime/ImageManipulationRuntimeExecutionRequestMapper";
import {
  RuntimeWindowSessionPersistenceVersion,
  SystemRuntimeWindowSessionPersistenceService,
  type RuntimeWindowSessionSelectionState,
  type RuntimeWindowSessionScope,
  type RuntimeWindowSessionState,
} from "../../runtime/SystemRuntimeWindowSessionPersistenceService";
import {
  buildRunProgressSnapshot,
  createIdleImageManipulationRunLifecycleState,
  mapExecutionReadinessToRunLifecycleState,
  mapRuntimeStatusToRunLifecycleState,
  type ImageManipulationRunLifecycleSnapshot,
} from "./image-manipulation/ImageManipulationRunLifecycleState";
import {
  getSelectionRecordIdForRole,
  setActivePreviewRole,
  setRoleSelection,
  type ImageManipulationSelectionRole,
  type ImageManipulationSelectionState,
} from "./image-manipulation/ImageManipulationSelectionState";
import type { SystemRuntimeWindowLaunchContract } from "@application/system-runtime/SystemRuntimeWindowLaunchContract";
import type {
  HydratedRuntimeDatasetBinding,
  SystemRuntimeHydratedState,
} from "../../runtime/SystemRuntimeWindowHydrationService";
import type { ImageRunHistoryRecord } from "@application/system-runtime/ImageRunHistoryDataContract";
import {
  ImageManipulationRuntimeDatasetBindingService,
  type ImageManipulationSelectionSnapshot,
} from "../../runtime/ImageManipulationRuntimeDatasetBindingService";
import { IdentityAuthSessionStore } from "../../shared/identity/IdentityAuthSessionStore";
import { RuntimeOperationsService } from "../../services/RuntimeOperationsService";
import type {
  RuntimeExecutionReadinessResponse,
  RuntimeSdkExecutionResultResponse,
  RuntimeSdkExecutionStatusResponse,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import type { StudioImageSystemDefinitionSummaryReadModel } from "@infrastructure/api/studio-shell/StudioShellBackendApi";

const uploadPolicy: FileIngestionPolicy = Object.freeze({
  acceptedExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
  acceptedMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  maxFileSizeBytes: 15 * 1024 * 1024,
  conversion: Object.freeze({
    mode: "forbidden",
    allowedOutputFormats: Object.freeze([]),
    passThroughExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
    passThroughMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  }),
});

const previewContextLabels: Record<ImageManipulationSelectionRole, string> = Object.freeze({
  source: "Source photo",
  output: "Created image",
  reference: "Face reference photo",
});

const runStateLabels: Record<ImageManipulationRunLifecycleSnapshot["state"], string> = Object.freeze({
  idle: "Ready",
  validating: "Checking settings",
  queued: "Queued",
  preparing: "Preparing",
  running: "Creating",
  degraded: "Degraded",
  completed: "Finished",
  failed: "Needs attention",
  cancelled: "Cancelled",
});

const emptyHydratedDatasetBindings: ReadonlyArray<HydratedRuntimeDatasetBinding> = Object.freeze([]);

function toFriendlyTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }
  return timestamp.toLocaleString();
}

function mapItemsToDisplayViewModels(items: ReadonlyArray<OutputGalleryItem>, context: ImageManipulationSelectionRole): ReadonlyArray<ImageUiViewModel> {
  const singularLabel = context === "source"
    ? "Source"
    : context === "reference"
      ? "Reference"
      : "Result";

  return Object.freeze(items.map((item, index) => {
    const mapped = mapOutputGalleryItemToImageViewModel(item);
    return Object.freeze({
      ...mapped,
      title: `${singularLabel} ${index + 1}`,
      subtitle: toFriendlyTimestamp(item.timestamps.updatedAt),
    });
  }));
}

function resolveSelectedItem(
  items: ReadonlyArray<OutputGalleryItem>,
  selectedRecordId?: string,
): OutputGalleryItem | undefined {
  if (items.length < 1) {
    return undefined;
  }
  if (selectedRecordId) {
    const matched = items.find((item) => item.image.recordId === selectedRecordId);
    if (matched) {
      return matched;
    }
  }
  return items[0];
}

function toSelectionRole(value: string | undefined): ImageManipulationSelectionRole | undefined {
  if (value === "source" || value === "output" || value === "reference") {
    return value;
  }
  return undefined;
}

function mergeHydratedSelectionWithPersistedSession(input: {
  readonly hydratedSelection: {
    readonly selectedDatasetBindingId?: string;
    readonly activePreviewRole: ImageManipulationSelectionRole;
    readonly selectedRecordIds: Readonly<Record<string, string>>;
    readonly gallerySelectionRecordIds: ReadonlyArray<string>;
  };
  readonly persistedSelection?: RuntimeWindowSessionSelectionState;
}) {
  if (!input.persistedSelection) {
    return input.hydratedSelection;
  }
  return Object.freeze({
    selectedDatasetBindingId: input.persistedSelection.selectedDatasetBindingId
      ?? input.hydratedSelection.selectedDatasetBindingId,
    activePreviewRole: input.persistedSelection.activePreviewRole,
    selectedRecordIds: Object.freeze({
      ...input.hydratedSelection.selectedRecordIds,
      ...input.persistedSelection.selectedRecordIds,
    }),
    gallerySelectionRecordIds: input.persistedSelection.gallerySelectionRecordIds.length > 0
      ? input.persistedSelection.gallerySelectionRecordIds
      : input.hydratedSelection.gallerySelectionRecordIds,
  });
}

async function encodeFileBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export interface ImageManipulationRuntimeEditorPanelProps {
  readonly context: StudioShellExtensionContext;
  readonly runtimeLaunch?: SystemRuntimeWindowLaunchContract;
  readonly hydratedRuntime?: SystemRuntimeHydratedState;
  readonly restoredSession?: RuntimeWindowSessionState;
}

interface ImageCollections {
  readonly sources: ReadonlyArray<OutputGalleryItem>;
  readonly outputs: ReadonlyArray<OutputGalleryItem>;
  readonly references: ReadonlyArray<OutputGalleryItem>;
}

interface LoadCollectionsOptions {
  readonly preferredSourceRecordId?: string;
  readonly preferredOutputRecordId?: string;
  readonly preferredReferenceRecordId?: string;
  readonly preferLatestOutput?: boolean;
  readonly hydration?: boolean;
}

type ReusableStudioImageAsset = Pick<
  ImageLibraryStudioImageAsset,
  "assetId" | "originalFilename" | "mediaType" | "sizeBytes" | "lifecycleStatus" | "createdAt" | "updatedAt"
>;

type UploadProgressStage = "idle" | "uploading" | "processing";

type RecentImageAssetContinuityGroupKey = "today" | "week" | "older";

interface RecentImageAssetContinuityGroup {
  readonly key: RecentImageAssetContinuityGroupKey;
  readonly label: string;
  readonly assets: ReadonlyArray<RecentStudioImageAsset>;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function groupRecentImageAssetsByContinuityWindow(
  assets: ReadonlyArray<RecentStudioImageAsset>,
  now: Date = new Date(),
): ReadonlyArray<RecentImageAssetContinuityGroup> {
  const todayStart = startOfDay(now).getTime();
  const sevenDaysAgo = todayStart - (6 * 24 * 60 * 60 * 1000);
  const grouped = new Map<RecentImageAssetContinuityGroupKey, RecentStudioImageAsset[]>();
  grouped.set("today", []);
  grouped.set("week", []);
  grouped.set("older", []);

  for (const asset of assets) {
    const updatedAt = new Date(asset.updatedAt).getTime();
    if (Number.isNaN(updatedAt)) {
      grouped.get("older")?.push(asset);
      continue;
    }
    if (updatedAt >= todayStart) {
      grouped.get("today")?.push(asset);
      continue;
    }
    if (updatedAt >= sevenDaysAgo) {
      grouped.get("week")?.push(asset);
      continue;
    }
    grouped.get("older")?.push(asset);
  }

  return Object.freeze(([
    { key: "today" as const, label: "Today" },
    { key: "week" as const, label: "Earlier this week" },
    { key: "older" as const, label: "Older" },
  ]).flatMap((group) => {
    const bucket = grouped.get(group.key) ?? [];
    if (bucket.length < 1) {
      return [];
    }
    return [Object.freeze({
      key: group.key,
      label: group.label,
      assets: Object.freeze(bucket),
    })];
  }));
}

function getCollectionLoadErrorMessage(datasetBindingId: ReferenceImageDatasetBindingId): string {
  if (datasetBindingId === "input-image-dataset") {
    return "We couldn't load your source photos right now.";
  }
  if (datasetBindingId === "reference-image-dataset") {
    return "We couldn't load your face reference photos right now.";
  }
  return "We couldn't load your created images right now.";
}

function toReferenceImageDatasetBindingId(
  bindingId: string | undefined,
): ReferenceImageDatasetBindingId | undefined {
  return bindingId === "input-image-dataset"
    || bindingId === "output-image-dataset"
    || bindingId === "reference-image-dataset"
    ? bindingId
    : undefined;
}

function resolveRunStatusTone(state: ImageManipulationRunLifecycleSnapshot["state"]): "neutral" | "warning" | "danger" | "success" {
  if (state === "completed") {
    return "success";
  }
  if (state === "failed") {
    return "danger";
  }
  if (
    state === "validating"
    || state === "queued"
    || state === "preparing"
    || state === "running"
    || state === "degraded"
  ) {
    return "warning";
  }
  return "neutral";
}

function resolveRunStatusMessage(runLifecycle: ImageManipulationRunLifecycleSnapshot, fallbackStatusMessage?: string): string {
  return runLifecycle.message ?? fallbackStatusMessage ?? "Adjust your settings, then create a new image.";
}

function resolveHistoryRunBadgeTone(
  status: ImageRunHistoryRecord["status"] | undefined,
): "neutral" | "success" | "warning" | "danger" {
  if (!status) {
    return "neutral";
  }
  if (status === "completed") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "partial" || status === "running" || status === "queued") {
    return "warning";
  }
  return "neutral";
}

export function resolveRunOutputRecordId(run: ImageRunHistoryRecord): string | undefined {
  const datasetRecordId = run.outputs.datasetInstance?.persistedRecordIds[0]?.trim();
  if (datasetRecordId) {
    return datasetRecordId;
  }
  const imageRecordId = run.outputs.images[0]?.recordId?.trim();
  if (imageRecordId) {
    return imageRecordId;
  }
  return undefined;
}

function resolveRunSourceRecordId(run: ImageRunHistoryRecord): string | undefined {
  return run.inputs.images[0]?.recordId?.trim() || undefined;
}

function resolveRunOutputCount(run: ImageRunHistoryRecord): number {
  return run.outputs.datasetInstance?.persistedRecordIds.length ?? run.outputs.images.length;
}

export function resolveRunHistorySummary(run: ImageRunHistoryRecord): string {
  const promptSummary = run.inputs.parameterSummary["editInstruction"];
  if (typeof promptSummary === "string" && promptSummary.trim().length > 0) {
    return promptSummary.trim();
  }
  const positivePrompt = (run.inputs.parameterSummary["imageConfig"] as { readonly prompts?: { readonly positivePrompt?: string } } | undefined)
    ?.prompts?.positivePrompt;
  if (typeof positivePrompt === "string" && positivePrompt.trim().length > 0) {
    return positivePrompt.trim();
  }
  return "No saved instruction summary.";
}

export function resolveRunParameterSnapshot(input: {
  readonly run: ImageRunHistoryRecord;
  readonly fallbackPresetId: string;
}): { readonly presetId: string; readonly config: ComfyImageManipulationConfig } | undefined {
  const summary = input.run.inputs.parameterSummary as Readonly<Record<string, unknown>>;
  const configuredPresetId = summary["presetId"];
  const presetId = typeof configuredPresetId === "string" && configuredPresetId.trim().length > 0
    ? configuredPresetId.trim()
    : input.fallbackPresetId;
  const candidateConfig = "imageConfig" in summary
    ? summary["imageConfig"]
    : summary;
  try {
    return Object.freeze({
      presetId,
      config: resolveComfyImageManipulationConfig(candidateConfig, { presetId }),
    });
  } catch {
    return undefined;
  }
}

export function resolveLinkedRunForSelectedOutput(input: {
  readonly selectedOutputItem?: OutputGalleryItem;
  readonly runHistory: ReadonlyArray<ImageRunHistoryRecord>;
  readonly activeRunId?: string;
}): ImageRunHistoryRecord | undefined {
  const workflowRunId = input.selectedOutputItem?.workflow?.workflowRunId?.trim();
  if (workflowRunId) {
    const byRunId = input.runHistory.find((run) => run.runId === workflowRunId);
    if (byRunId) {
      return byRunId;
    }
    const byExecutionId = input.runHistory.find((run) => run.workflowExecutionId === workflowRunId);
    if (byExecutionId) {
      return byExecutionId;
    }
  }

  if (input.activeRunId?.trim()) {
    const byActiveRunId = input.runHistory.find((run) => (
      run.runId === input.activeRunId || run.workflowExecutionId === input.activeRunId
    ));
    if (byActiveRunId) {
      return byActiveRunId;
    }
  }

  return undefined;
}

function toFriendlyValidationMessage(path: string): string {
  if (path.startsWith("prompts.")) {
    return "Update your instructions to continue.";
  }
  if (path.startsWith("output.")) {
    return "Review your result settings before running.";
  }
  if (path.startsWith("faceId.")) {
    return "Review your face reference settings before running.";
  }
  if (path.startsWith("models.")) {
    return "Review advanced model settings before running.";
  }
  return "Review your settings before running.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatAssetFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "Unknown size";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolveSelectionConfirmationMessage(input: {
  readonly selectedSourceItem?: OutputGalleryItem;
  readonly selectedReferenceItem?: OutputGalleryItem;
}): string | undefined {
  const selectedSourceAssetId = input.selectedSourceItem?.sourceImage?.assetId;
  const selectedReferenceAssetId = input.selectedReferenceItem?.sourceImage?.assetId;

  if (selectedSourceAssetId && selectedReferenceAssetId) {
    return "Source and face reference photos are selected.";
  }
  if (selectedSourceAssetId) {
    return "Source photo selected and ready.";
  }
  if (selectedReferenceAssetId) {
    return "Face reference photo selected.";
  }
  return undefined;
}

export interface ImageRunPrecheckIssue {
  readonly source: "setup" | "backend";
  readonly severity: "blocking" | "advisory";
  readonly message: string;
}

export interface ImageRunLaunchPrecheckState {
  readonly launchReady: boolean;
  readonly setupBlockingIssues: ReadonlyArray<ImageRunPrecheckIssue>;
  readonly setupAdvisories: ReadonlyArray<ImageRunPrecheckIssue>;
  readonly backendBlockingIssues: ReadonlyArray<ImageRunPrecheckIssue>;
  readonly backendAdvisories: ReadonlyArray<ImageRunPrecheckIssue>;
}

export function buildImageRunLaunchPrecheckState(input: {
  readonly selectedSourceRecordId?: string;
  readonly selectedSourceAssetId?: string;
  readonly selectedSourceDatasetInstanceId?: string;
  readonly prompt: string;
  readonly validationIssues: ReadonlyArray<ComfyImageManipulationConfigValidationIssue>;
  readonly executionReadiness?: RuntimeExecutionReadinessResponse;
  readonly executionReadinessError?: string;
}): ImageRunLaunchPrecheckState {
  const setupBlockingIssues: ImageRunPrecheckIssue[] = [];
  const setupAdvisories: ImageRunPrecheckIssue[] = [];
  const backendBlockingIssues: ImageRunPrecheckIssue[] = [];
  const backendAdvisories: ImageRunPrecheckIssue[] = [];

  if (!input.selectedSourceRecordId || !input.selectedSourceAssetId) {
    setupBlockingIssues.push(Object.freeze({
      source: "setup",
      severity: "blocking",
      message: "Choose a source photo before launching.",
    }));
  }
  if (!input.selectedSourceDatasetInstanceId) {
    setupBlockingIssues.push(Object.freeze({
      source: "setup",
      severity: "blocking",
      message: "Source image collection is not linked for this run.",
    }));
  }
  if (!input.prompt.trim()) {
    setupBlockingIssues.push(Object.freeze({
      source: "setup",
      severity: "blocking",
      message: "Add edit instructions before launching.",
    }));
  }
  for (const validationIssue of input.validationIssues) {
    setupBlockingIssues.push(Object.freeze({
      source: "setup",
      severity: "blocking",
      message: validationIssue.message,
    }));
  }
  if (input.executionReadinessError) {
    backendBlockingIssues.push(Object.freeze({
      source: "backend",
      severity: "blocking",
      message: input.executionReadinessError,
    }));
  } else if (!input.executionReadiness) {
    backendBlockingIssues.push(Object.freeze({
      source: "backend",
      severity: "blocking",
      message: "Execution environment readiness has not been checked yet.",
    }));
  } else {
    for (const issue of input.executionReadiness.issues) {
      if (issue.severity === "error") {
        backendBlockingIssues.push(Object.freeze({
          source: "backend",
          severity: "blocking",
          message: issue.message,
        }));
      } else {
        backendAdvisories.push(Object.freeze({
          source: "backend",
          severity: "advisory",
          message: issue.message,
        }));
      }
    }
    if (!input.executionReadiness.readyForExecution && backendBlockingIssues.length < 1) {
      backendBlockingIssues.push(Object.freeze({
        source: "backend",
        severity: "blocking",
        message: input.executionReadiness.message ?? "Execution environment is not currently available for this run.",
      }));
    }
    if (
      input.executionReadiness.readyForExecution
      && input.executionReadiness.readiness === "degraded"
      && (input.executionReadiness.message?.trim() ?? "").length > 0
    ) {
      backendAdvisories.push(Object.freeze({
        source: "backend",
        severity: "advisory",
        message: input.executionReadiness.message!.trim(),
      }));
    }
  }

  return Object.freeze({
    launchReady: setupBlockingIssues.length < 1 && backendBlockingIssues.length < 1,
    setupBlockingIssues: Object.freeze(setupBlockingIssues),
    setupAdvisories: Object.freeze(setupAdvisories),
    backendBlockingIssues: Object.freeze(backendBlockingIssues),
    backendAdvisories: Object.freeze(backendAdvisories),
  });
}

function isRuntimeTerminalStatus(
  status: RuntimeSdkExecutionResultResponse["status"],
): status is "succeeded" | "failed" | "cancelled" {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

function mapRuntimeSdkResultToPersistenceResult(
  result: RuntimeSdkExecutionResultResponse,
): NonNullable<Parameters<typeof createReferenceImageOutputPersistenceRequest>[0]["runtimeResult"]> {
  return Object.freeze({
    executionId: result.executionId,
    status: result.status,
    output: result.output,
    rootAssetId: result.rootAssetId,
    rootVersionId: result.rootVersionId,
    completedAt: result.completedAt,
    outputSummary: Object.freeze({
      hasOutput: result.outputSummary.hasOutput,
      hasError: result.outputSummary.hasError,
      outputFieldCount: result.outputSummary.outputFieldCount,
      contractOutputIds: Object.freeze([...result.outputSummary.contractOutputIds]),
    }),
    nodeResults: Object.freeze([]),
    nestedSystemResults: Object.freeze([]),
    diagnostics: Object.freeze([...result.diagnostics]),
    executedVersionMap: Object.freeze({
      rootVersionId: result.rootVersionId,
      nodeVersionIds: Object.freeze({}),
    }),
    nestedExecutionLineage: Object.freeze([]),
  });
}

export function ImageManipulationRuntimeEditorPanel({
  context,
  runtimeLaunch,
  hydratedRuntime,
  restoredSession,
}: ImageManipulationRuntimeEditorPanelProps): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const isImageRuntimeTarget = (hydratedRuntime?.resolvedPage.pageBindingId ?? runtimeLaunch?.launchTarget.pageBindingId)
    === ImageManipulationSystemTemplate.compositionBindings.pageBindingId;
  const studioShell = useMemo(() => new StudioShellService(), []);
  const imageAssets = useMemo(() => new ImageAssetManagementService(), []);
  const runtimeOperations = useMemo(() => new RuntimeOperationsService(), []);
  const authSessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const uploadAdapter = useMemo(() => createBrowserImageUploadIngestionAdapter({ policy: uploadPolicy }), []);
  const datasetBindingService = useMemo(() => new ImageManipulationRuntimeDatasetBindingService(), []);
  const sessionPersistence = useMemo(() => new SystemRuntimeWindowSessionPersistenceService(), []);
  const requestIdRef = useRef(0);
  const runPollRequestIdRef = useRef(0);

  const roleBindings = useMemo(
    () => datasetBindingService.resolveRoleBindings(hydratedRuntime?.datasetBindings ?? emptyHydratedDatasetBindings),
    [datasetBindingService, hydratedRuntime?.datasetBindings],
  );
  const sessionScope = useMemo<RuntimeWindowSessionScope | undefined>(() => {
    if (!runtimeLaunch) {
      return undefined;
    }
    return sessionPersistence.resolveScope({
      launch: runtimeLaunch,
      hydratedRuntime,
      draftId: draft?.draftId,
    });
  }, [draft?.draftId, hydratedRuntime, runtimeLaunch, sessionPersistence]);
  const persistedSession = useMemo(
    () => restoredSession ?? (sessionScope ? sessionPersistence.load(sessionScope) : undefined),
    [restoredSession, sessionPersistence, sessionScope],
  );
  const initialPresetId = persistedSession?.property.presetId
    ?? hydratedRuntime?.propertySchema.presetId
    ?? runtimeLaunch?.initialSelection.presetId
    ?? ComfyImageManipulationPropertySchema.defaultPresetId;
  const [presetId, setPresetId] = useState(initialPresetId);
  const [config, setConfig] = useState<ComfyImageManipulationConfig>(() => {
    if (persistedSession?.property.config) {
      return resolveComfyImageManipulationConfig(persistedSession.property.config, {
        presetId: persistedSession.property.presetId,
      });
    }
    return hydratedRuntime?.propertySchema.defaults
      ?? createComfyImageManipulationDefaultConfig({ presetId: initialPresetId });
  });
  const hydratedSelection = useMemo(() => {
    const baseSelection = (() => {
      if (hydratedRuntime) {
        return hydratedRuntime.initialSelection;
      }
      return Object.freeze({
        selectedDatasetBindingId: runtimeLaunch?.initialSelection.selectedDatasetBindingId ?? roleBindings.outputBindingId,
        activePreviewRole: toSelectionRole(runtimeLaunch?.initialSelection.activePreviewRole) ?? "output",
        selectedRecordIds: Object.freeze({ ...(runtimeLaunch?.initialSelection.selectedRecordIds ?? {}) }),
        gallerySelectionRecordIds: Object.freeze([]),
      });
    })();
    return mergeHydratedSelectionWithPersistedSession({
      hydratedSelection: baseSelection,
      persistedSelection: persistedSession?.selection,
    });
  }, [
    hydratedRuntime,
    persistedSession?.selection,
    roleBindings.outputBindingId,
    runtimeLaunch?.initialSelection.activePreviewRole,
    runtimeLaunch?.initialSelection.selectedDatasetBindingId,
    runtimeLaunch?.initialSelection.selectedRecordIds,
  ]);
  const [selection, setSelection] = useState<ImageManipulationSelectionState>(() => (
    datasetBindingService.createSelectionStateFromHydration({
      roleBindings,
      hydratedSelection,
    })
  ));
  const [selectionSnapshot, setSelectionSnapshot] = useState<ImageManipulationSelectionSnapshot>(() => (
    persistedSession?.selection
      ? Object.freeze({
        selectedDatasetBindingId: persistedSession.selection.selectedDatasetBindingId,
        activePreviewRole: persistedSession.selection.activePreviewRole,
        selectedRecordIds: Object.freeze({ ...persistedSession.selection.selectedRecordIds }),
        gallerySelectionRecordIds: Object.freeze([...persistedSession.selection.gallerySelectionRecordIds]),
      })
      : datasetBindingService.createEmptySelectionSnapshot(roleBindings)
  ));
  const [isRunAdvancedDetailsOpen, setIsRunAdvancedDetailsOpen] = useState(
    persistedSession?.panelState.runAdvancedDetailsOpen === true,
  );
  const [datasetInstanceId, setDatasetInstanceId] = useState<string | undefined>();

  const [outputItems, setOutputItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [sourceItems, setSourceItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [referenceItems, setReferenceItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [outputLoadError, setOutputLoadError] = useState<string | undefined>();
  const [sourceLoadError, setSourceLoadError] = useState<string | undefined>();
  const [referenceLoadError, setReferenceLoadError] = useState<string | undefined>();
  const [isHydrating, setIsHydrating] = useState(false);
  const [recentImageAssets, setRecentImageAssets] = useState<ReadonlyArray<RecentStudioImageAsset>>([]);
  const [isLoadingRecentImageAssets, setIsLoadingRecentImageAssets] = useState(false);
  const [recentImageAssetsError, setRecentImageAssetsError] = useState<string | undefined>();
  const [isReusingRecentImageAssetId, setIsReusingRecentImageAssetId] = useState<string | undefined>();
  const [recentSystems, setRecentSystems] = useState<ReadonlyArray<StudioImageSystemDefinitionSummaryReadModel>>([]);
  const [isLoadingRecentSystems, setIsLoadingRecentSystems] = useState(false);
  const [recentSystemsError, setRecentSystemsError] = useState<string | undefined>();
  const [isReopeningRecentSystemId, setIsReopeningRecentSystemId] = useState<string | undefined>();
  const [uploadProgressStage, setUploadProgressStage] = useState<UploadProgressStage>("idle");
  const [imageLibrarySearch, setImageLibrarySearch] = useState("");
  const [appliedImageLibrarySearch, setAppliedImageLibrarySearch] = useState("");
  const [imageLibraryAssets, setImageLibraryAssets] = useState<ReadonlyArray<ImageLibraryStudioImageAsset>>([]);
  const [isLoadingImageLibrary, setIsLoadingImageLibrary] = useState(false);
  const [isLoadingMoreImageLibrary, setIsLoadingMoreImageLibrary] = useState(false);
  const [imageLibraryHasMore, setImageLibraryHasMore] = useState(false);
  const [imageLibraryOffset, setImageLibraryOffset] = useState(0);
  const [imageLibraryError, setImageLibraryError] = useState<string | undefined>();

  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [runLifecycle, setRunLifecycle] = useState<ImageManipulationRunLifecycleSnapshot>(() => createIdleImageManipulationRunLifecycleState());
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const [activeRunStatus, setActiveRunStatus] = useState<RuntimeSdkExecutionStatusResponse | undefined>();
  const [runHistory, setRunHistory] = useState<ReadonlyArray<ImageRunHistoryRecord>>([]);
  const [isLoadingRunHistory, setIsLoadingRunHistory] = useState(false);
  const [runHistoryError, setRunHistoryError] = useState<string | undefined>();
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | undefined>();
  const [isContinuingFromRunId, setIsContinuingFromRunId] = useState<string | undefined>();
  const [isResultQuickActionPending, setIsResultQuickActionPending] = useState<"source" | "reference" | undefined>();
  const [executionReadiness, setExecutionReadiness] = useState<RuntimeExecutionReadinessResponse | undefined>();
  const [executionReadinessError, setExecutionReadinessError] = useState<string | undefined>();
  const [isCheckingExecutionReadiness, setIsCheckingExecutionReadiness] = useState(false);
  const [integrityIssues, setIntegrityIssues] = useState<ReadonlyArray<CrossStudioIntegrityIssue>>([]);
  const [flowSteps, setFlowSteps] = useState<ReadonlyArray<ReferenceImageExecutionFlowStep>>([]);
  const [flowIssues, setFlowIssues] = useState<ReadonlyArray<ReferenceImageExecutionFlowIssue>>([]);
  const recentImageAssetGroups = useMemo(
    () => groupRecentImageAssetsByContinuityWindow(recentImageAssets),
    [recentImageAssets],
  );

  useEffect(() => {
    setSelection(datasetBindingService.createSelectionStateFromHydration({
      roleBindings,
      hydratedSelection,
    }));
    setSelectionSnapshot(
      persistedSession?.selection
        ? Object.freeze({
          selectedDatasetBindingId: persistedSession.selection.selectedDatasetBindingId,
          activePreviewRole: persistedSession.selection.activePreviewRole,
          selectedRecordIds: Object.freeze({ ...persistedSession.selection.selectedRecordIds }),
          gallerySelectionRecordIds: Object.freeze([...persistedSession.selection.gallerySelectionRecordIds]),
        })
        : datasetBindingService.createEmptySelectionSnapshot(roleBindings),
    );
    setIsRunAdvancedDetailsOpen(persistedSession?.panelState.runAdvancedDetailsOpen === true);
  }, [datasetBindingService, hydratedSelection, persistedSession?.panelState.runAdvancedDetailsOpen, persistedSession?.selection, roleBindings]);

  useEffect(() => {
    setPresetId(initialPresetId);
    setConfig(() => {
      if (persistedSession?.property.config) {
        return resolveComfyImageManipulationConfig(persistedSession.property.config, {
          presetId: persistedSession.property.presetId,
        });
      }
      return hydratedRuntime?.propertySchema.defaults
        ?? createComfyImageManipulationDefaultConfig({ presetId: initialPresetId });
    });
  }, [hydratedRuntime?.propertySchema.defaults, initialPresetId, persistedSession?.property.config, persistedSession?.property.presetId]);

  const validationIssues = useMemo(() => validateComfyImageManipulationConfig(config), [config]);
  const validationSummaryMessage = useMemo(() => {
    if (validationIssues.length < 1) {
      return "Your settings are ready. You can create an image.";
    }
    return toFriendlyValidationMessage(validationIssues[0]?.path ?? "");
  }, [validationIssues]);
  const validationSummaryDetails = useMemo(() => {
    if (validationIssues.length < 1) {
      return Object.freeze([] as string[]);
    }
    const unique = Array.from(new Set(validationIssues.map((issue) => issue.message.trim()).filter((message) => message.length > 0)));
    return Object.freeze(unique.slice(0, 3));
  }, [validationIssues]);

  const sourceViewModels = useMemo(
    () => mapItemsToDisplayViewModels(sourceItems, "source"),
    [sourceItems],
  );
  const outputViewModels = useMemo(
    () => mapItemsToDisplayViewModels(outputItems, "output"),
    [outputItems],
  );
  const referenceViewModels = useMemo(
    () => mapItemsToDisplayViewModels(referenceItems, "reference"),
    [referenceItems],
  );

  const selectedSourceItem = useMemo(
    () => resolveSelectedItem(sourceItems, selection.sourceRecordId),
    [sourceItems, selection.sourceRecordId],
  );
  const selectedOutputItem = useMemo(
    () => resolveSelectedItem(outputItems, selection.outputRecordId),
    [outputItems, selection.outputRecordId],
  );
  const selectedReferenceItem = useMemo(
    () => resolveSelectedItem(referenceItems, selection.referenceRecordId),
    [referenceItems, selection.referenceRecordId],
  );

  useEffect(() => {
    if (selectedSourceItem?.dataset.instanceId && selectedSourceItem.dataset.instanceId !== datasetInstanceId) {
      setDatasetInstanceId(selectedSourceItem.dataset.instanceId);
    }
  }, [selectedSourceItem?.dataset.instanceId, datasetInstanceId]);

  const selectedSourceRecordId = selectedSourceItem?.image.recordId;
  const selectedSourceAssetId = selectedSourceItem?.image.imageReference
    ?? selectedSourceItem?.image.thumbnailReference
    ?? selectedSourceItem?.image.recordId;
  const selectedSourceDatasetInstanceId = selectedSourceItem?.dataset.instanceId ?? datasetInstanceId;
  const datasetBindingsById = useMemo(
    () => new Map((hydratedRuntime?.datasetBindings ?? []).map((entry) => [entry.bindingId, entry] as const)),
    [hydratedRuntime?.datasetBindings],
  );
  const sourceDatasetBinding = datasetBindingsById.get(roleBindings.sourceBindingId);
  const runtimeSystemAssetId = hydratedRuntime?.resolvedSystemAsset.assetId ?? draft?.assetId;
  const runtimeWorkflowAssetId = hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateAssetId
    ?? ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId;
  const runtimeWorkflowAssetVersionId = hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateVersionId
    ?? ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId;

  const refreshExecutionReadiness = (): Promise<void> => {
    if (!sessionToken) {
      setExecutionReadiness(undefined);
      setExecutionReadinessError("Sign in to check execution environment availability.");
      return Promise.resolve();
    }
    setIsCheckingExecutionReadiness(true);
    setExecutionReadinessError(undefined);
    return runtimeOperations.getExecutionReadiness({
      systemId: runtimeWorkflowAssetId,
    }).then((response) => {
      if (!response.ok || !response.data) {
        setExecutionReadiness(undefined);
        setExecutionReadinessError(response.error?.message ?? "Could not check execution environment availability.");
        return;
      }
      setExecutionReadiness(response.data);
      setExecutionReadinessError(undefined);
    }).finally(() => {
      setIsCheckingExecutionReadiness(false);
    });
  };

  const selectedPreviewViewModel = useMemo(() => {
    if (selection.activePreviewRole === "source") {
      return selectedSourceItem ? mapItemsToDisplayViewModels([selectedSourceItem], "source")[0] : undefined;
    }
    if (selection.activePreviewRole === "reference") {
      return selectedReferenceItem ? mapItemsToDisplayViewModels([selectedReferenceItem], "reference")[0] : undefined;
    }
    return selectedOutputItem ? mapItemsToDisplayViewModels([selectedOutputItem], "output")[0] : undefined;
  }, [selection.activePreviewRole, selectedSourceItem, selectedReferenceItem, selectedOutputItem]);

  const previewLoading = selection.activePreviewRole === "source"
    ? isLoadingSources
    : selection.activePreviewRole === "reference"
      ? isLoadingReferences
      : isLoadingOutputs;

  const previewErrorMessage = selection.activePreviewRole === "source"
    ? sourceLoadError
    : selection.activePreviewRole === "reference"
      ? referenceLoadError
      : outputLoadError;
  const hasCollectionLoadError = Boolean(sourceLoadError || outputLoadError || referenceLoadError);
  const runStatusMessage = resolveRunStatusMessage(runLifecycle, statusMessage);
  const runProgress = useMemo(() => buildRunProgressSnapshot(activeRunStatus), [activeRunStatus]);
  const selectionConfirmationMessage = useMemo(() => resolveSelectionConfirmationMessage({
    selectedSourceItem,
    selectedReferenceItem,
  }), [selectedReferenceItem, selectedSourceItem]);
  const session = useMemo(() => authSessionStore.getSession(), [authSessionStore]);
  const actorUserIdentityId = session?.userIdentityId;
  const workspaceId = session?.workspaceContext?.resolvedWorkspaceId ?? session?.initialCapabilityState?.workspaceId;
  const sessionToken = session?.sessionToken;

  const activeGallery = useMemo(() => {
    if (selection.activePreviewRole === "source") {
      return {
        title: "Source photos",
        subtitle: "Images you've uploaded for editing",
        items: sourceViewModels,
        selectedId: getSelectionRecordIdForRole(selection, "source") ?? selectedSourceItem?.image.recordId,
        loading: isLoadingSources,
        errorMessage: sourceLoadError,
        emptyMessage: "Upload a photo to get started.",
      } as const;
    }
    if (selection.activePreviewRole === "reference") {
      return {
        title: "Face reference photos",
        subtitle: "Optional reference images for identity guidance",
        items: referenceViewModels,
        selectedId: getSelectionRecordIdForRole(selection, "reference") ?? selectedReferenceItem?.image.recordId,
        loading: isLoadingReferences,
        errorMessage: referenceLoadError,
        emptyMessage: "No face reference photos are available yet.",
      } as const;
    }
    return {
      title: "Created images",
      subtitle: "Recent results from this editor",
      items: outputViewModels,
      selectedId: getSelectionRecordIdForRole(selection, "output") ?? selectedOutputItem?.image.recordId,
      loading: isLoadingOutputs,
      errorMessage: outputLoadError,
      emptyMessage: "Create an image to see results here.",
    } as const;
  }, [
    selection,
    sourceViewModels,
    outputViewModels,
    referenceViewModels,
    selectedSourceItem,
    selectedOutputItem,
    selectedReferenceItem,
    isLoadingSources,
    isLoadingReferences,
    isLoadingOutputs,
    sourceLoadError,
    referenceLoadError,
    outputLoadError,
  ]);

  const loadCollection = (
    datasetBindingId: ReferenceImageDatasetBindingId | undefined,
    setLoading: (value: boolean) => void,
    setError: (value: string | undefined) => void,
  ): Promise<ReadonlyArray<OutputGalleryItem>> => {
    if (!datasetBindingId || !draft?.draftId) {
      return Promise.resolve(Object.freeze([]));
    }
    setLoading(true);
    setError(undefined);

    const request = datasetBindingId === "output-image-dataset"
      ? studioShell.listReferenceImageOutputs({
        studioId: context.studioId,
        draftId: draft.draftId,
        limit: 24,
        offset: 0,
      })
      : studioShell.listReferenceImageDatasetItems({
        studioId: context.studioId,
        draftId: draft.draftId,
        datasetBindingId,
        limit: 24,
        offset: 0,
      });

    return request.then((response) => {
      if (!response.ok || !response.data) {
        setError(getCollectionLoadErrorMessage(datasetBindingId));
        return Object.freeze([]);
      }
      return response.data.items;
    }).finally(() => setLoading(false));
  };

  const loadRecentAssets = (): Promise<ReadonlyArray<RecentStudioImageAsset>> => {
    if (!actorUserIdentityId || !workspaceId || !sessionToken) {
      setRecentImageAssets(Object.freeze([]));
      setRecentImageAssetsError(undefined);
      return Promise.resolve(Object.freeze([]));
    }
    setIsLoadingRecentImageAssets(true);
    setRecentImageAssetsError(undefined);
    return imageAssets.listRecentImageAssets({
      actorUserIdentityId,
      workspaceId,
      sessionToken,
      limit: 8,
    }).then((response) => {
      if (!response.ok || !response.data) {
        setRecentImageAssets(Object.freeze([]));
        setRecentImageAssetsError("We couldn't load your recently used images.");
        return Object.freeze([]);
      }
      setRecentImageAssets(response.data);
      return response.data;
    }).finally(() => {
      setIsLoadingRecentImageAssets(false);
    });
  };

  const loadRecentSystems = (): Promise<ReadonlyArray<StudioImageSystemDefinitionSummaryReadModel>> => {
    if (!sessionToken) {
      setRecentSystems(Object.freeze([]));
      setRecentSystemsError(undefined);
      return Promise.resolve(Object.freeze([]));
    }
    setIsLoadingRecentSystems(true);
    setRecentSystemsError(undefined);
    return studioShell.listImageSystemDefinitions({
      workflowIds: runtimeWorkflowAssetId ? [runtimeWorkflowAssetId] : undefined,
      limit: 8,
      offset: 0,
    }).then((response) => {
      if (!response.ok || !response.data) {
        setRecentSystems(Object.freeze([]));
        setRecentSystemsError(response.error?.message ?? "We couldn't load your recent systems.");
        return Object.freeze([]);
      }
      setRecentSystems(response.data.items);
      return response.data.items;
    }).finally(() => {
      setIsLoadingRecentSystems(false);
    });
  };

  const loadImageLibrary = (options?: {
    readonly append?: boolean;
    readonly search?: string;
    readonly offset?: number;
  }): Promise<ReadonlyArray<ImageLibraryStudioImageAsset>> => {
    if (!actorUserIdentityId || !workspaceId || !sessionToken) {
      setImageLibraryAssets(Object.freeze([]));
      setImageLibraryError(undefined);
      setImageLibraryHasMore(false);
      setImageLibraryOffset(0);
      return Promise.resolve(Object.freeze([]));
    }

    const append = options?.append === true;
    const search = options?.search ?? appliedImageLibrarySearch;
    const offset = options?.offset ?? 0;

    if (append) {
      setIsLoadingMoreImageLibrary(true);
    } else {
      setIsLoadingImageLibrary(true);
    }
    setImageLibraryError(undefined);

    return imageAssets.listImageLibraryImageAssets({
      actorUserIdentityId,
      workspaceId,
      sessionToken,
      search,
      limit: 12,
      offset,
    }).then((response) => {
      if (!response.ok || !response.data) {
        setImageLibraryError("We couldn't load your image library right now.");
        if (!append) {
          setImageLibraryAssets(Object.freeze([]));
          setImageLibraryHasMore(false);
          setImageLibraryOffset(0);
        }
        return Object.freeze([]);
      }

      const nextItems = append
        ? Object.freeze([...imageLibraryAssets, ...response.data.items])
        : response.data.items;

      setImageLibraryAssets(nextItems);
      setImageLibraryHasMore(response.data.pagination.hasMore);
      setImageLibraryOffset(response.data.pagination.offset + response.data.pagination.returned);
      return nextItems;
    }).finally(() => {
      if (append) {
        setIsLoadingMoreImageLibrary(false);
      } else {
        setIsLoadingImageLibrary(false);
      }
    });
  };

  const reuseRecentImageAsset = async (input: {
    readonly asset: ReusableStudioImageAsset;
    readonly targetDatasetBindingId: Extract<ReferenceImageDatasetBindingId, "input-image-dataset" | "reference-image-dataset">;
  }): Promise<void> => {
    if (!draft?.draftId || !workspaceId || !sessionToken) {
      setStatusMessage("Sign in to reuse recent images.");
      return;
    }
    setIsReusingRecentImageAssetId(input.asset.assetId);
    setStatusMessage(undefined);
    try {
      const [metadata, original] = await Promise.all([
        imageAssets.getImageAsset({
          assetId: input.asset.assetId,
          workspaceId,
          sessionToken,
        }),
        imageAssets.getImageAssetOriginalContent({
          assetId: input.asset.assetId,
          workspaceId,
          sessionToken,
        }),
      ]);
      if (!metadata.ok || !metadata.data) {
        setStatusMessage(metadata.error?.message ?? "We couldn't load this image metadata.");
        return;
      }
      if (!original.ok || !original.data) {
        setStatusMessage(original.error?.message ?? "We couldn't load this image content.");
        return;
      }

      const ingested = await studioShell.ingestReferenceImageUpload({
        studioId: context.studioId,
        draftId: draft.draftId,
        fileName: metadata.data.asset.originalFilename,
        mimeType: metadata.data.asset.mediaType ?? original.data.mimeType,
        payloadBase64: original.data.payloadBase64,
        sourceImageAssetId: metadata.data.asset.assetId,
        targetDatasetBindingId: input.targetDatasetBindingId,
      });
      if (!ingested.ok || !ingested.data) {
        setStatusMessage(ingested.error?.message ?? "We couldn't reuse this image.");
        return;
      }

      if (input.targetDatasetBindingId === "input-image-dataset") {
        setDatasetInstanceId(ingested.data.datasetInstanceId);
        setSelection((current) => setRoleSelection(current, {
          role: "source",
          recordId: ingested.data.recordId,
          syncPreviewRole: true,
        }));
      } else {
        setSelection((current) => setRoleSelection(current, {
          role: "reference",
          recordId: ingested.data.recordId,
          syncPreviewRole: true,
        }));
      }
      setStatusMessage(input.targetDatasetBindingId === "input-image-dataset"
        ? "Recent image ready as your source photo."
        : "Recent image ready as your face reference photo.");
      await loadCollections({
        preferredSourceRecordId: input.targetDatasetBindingId === "input-image-dataset"
          ? ingested.data.recordId
          : undefined,
        preferredReferenceRecordId: input.targetDatasetBindingId === "reference-image-dataset"
          ? ingested.data.recordId
          : undefined,
      });
    } finally {
      setIsReusingRecentImageAssetId(undefined);
    }
  };

  const loadCollections = (options: LoadCollectionsOptions = {}): Promise<ImageCollections> => {
    if (!draft?.draftId) {
      setSourceItems(Object.freeze([]));
      setOutputItems(Object.freeze([]));
      setReferenceItems(Object.freeze([]));
      setSelection(datasetBindingService.createSelectionStateFromHydration({
        roleBindings,
        hydratedSelection,
      }));
      setSelectionSnapshot(datasetBindingService.createEmptySelectionSnapshot(roleBindings));
      setIsHydrating(false);
      return Promise.resolve(Object.freeze({
        sources: Object.freeze([]),
        outputs: Object.freeze([]),
        references: Object.freeze([]),
      }));
    }
    if (options.hydration) {
      setIsHydrating(true);
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    return Promise.all([
      loadCollection(toReferenceImageDatasetBindingId(roleBindings.sourceBindingId), setIsLoadingSources, setSourceLoadError),
      loadCollection(toReferenceImageDatasetBindingId(roleBindings.outputBindingId), setIsLoadingOutputs, setOutputLoadError),
      loadCollection(toReferenceImageDatasetBindingId(roleBindings.referenceBindingId), setIsLoadingReferences, setReferenceLoadError),
    ]).then(([nextSources, nextOutputs, nextReferences]) => {
      if (requestId !== requestIdRef.current) {
        return Object.freeze({
          sources: nextSources,
          outputs: nextOutputs,
          references: nextReferences,
        });
      }

      setSourceItems(nextSources);
      setOutputItems(nextOutputs);
      setReferenceItems(nextReferences);

      setSelection((current) => {
        const reconciled = datasetBindingService.reconcileSelection({
          current,
          roleBindings,
          hydratedSelection: Object.freeze({
            ...hydratedSelection,
            selectedRecordIds: Object.freeze({
              ...hydratedSelection.selectedRecordIds,
              ...(options.preferredSourceRecordId ? { [roleBindings.sourceBindingId]: options.preferredSourceRecordId } : {}),
              ...(options.preferredOutputRecordId ? { [roleBindings.outputBindingId]: options.preferredOutputRecordId } : {}),
              ...(options.preferredReferenceRecordId && roleBindings.referenceBindingId
                ? { [roleBindings.referenceBindingId]: options.preferredReferenceRecordId }
                : {}),
            }),
          }),
          collections: {
            sourceItems: nextSources,
            outputItems: nextOutputs,
            referenceItems: nextReferences,
          },
          preferLatestOutput: options.preferLatestOutput,
        });
        const withPreviewRole = reconciled.selection;
        setSelectionSnapshot(reconciled.serializedSelection);

        const nextSource = resolveSelectedItem(nextSources, withPreviewRole.sourceRecordId);
        if (nextSource?.dataset.instanceId) {
          setDatasetInstanceId(nextSource.dataset.instanceId);
        }

        return withPreviewRole;
      });

      return Object.freeze({
        sources: nextSources,
        outputs: nextOutputs,
        references: nextReferences,
      });
    }).finally(() => {
      if (options.hydration) {
        setIsHydrating(false);
      }
    });
  };

  const loadRunHistory = (): Promise<ReadonlyArray<ImageRunHistoryRecord>> => {
    if (!draft?.draftId) {
      setRunHistory(Object.freeze([]));
      setRunHistoryError(undefined);
      return Promise.resolve(Object.freeze([]));
    }
    setIsLoadingRunHistory(true);
    setRunHistoryError(undefined);
    return studioShell.listReferenceImageRunHistory({
      studioId: context.studioId,
      draftId: draft.draftId,
      limit: 20,
      offset: 0,
    }).then((response) => {
      if (!response.ok || !response.data) {
        setRunHistory(Object.freeze([]));
        setRunHistoryError(response.error?.message ?? "We couldn't load run history.");
        return Object.freeze([]);
      }
      setRunHistory(response.data.runs);
      return response.data.runs;
    }).finally(() => {
      setIsLoadingRunHistory(false);
    });
  };

  useEffect(() => {
    void loadCollections({ hydration: true });
  }, [draft?.draftId, roleBindings.sourceBindingId, roleBindings.outputBindingId, roleBindings.referenceBindingId]);

  useEffect(() => {
    void loadRunHistory();
  }, [draft?.draftId]);

  useEffect(() => {
    void loadRecentAssets();
  }, [actorUserIdentityId, workspaceId, sessionToken]);

  useEffect(() => {
    void loadRecentSystems();
  }, [sessionToken, runtimeWorkflowAssetId]);

  useEffect(() => {
    void loadImageLibrary({
      search: appliedImageLibrarySearch,
      offset: 0,
    });
  }, [actorUserIdentityId, workspaceId, sessionToken, appliedImageLibrarySearch]);

  useEffect(() => {
    void refreshExecutionReadiness();
  }, [runtimeWorkflowAssetId, sessionToken]);

  useEffect(() => {
    if (!selectedHistoryRunId) {
      return;
    }
    if (!runHistory.some((entry) => entry.runId === selectedHistoryRunId)) {
      setSelectedHistoryRunId(undefined);
    }
  }, [runHistory, selectedHistoryRunId]);

  useEffect(() => {
    if (activeRunId) {
      return;
    }
    setRunLifecycle((current) => {
      if (current.state !== "idle" && current.state !== "degraded" && current.state !== "validating") {
        return current;
      }
      return mapExecutionReadinessToRunLifecycleState(executionReadiness);
    });
  }, [activeRunId, executionReadiness]);

  useEffect(() => {
    if (!draft?.draftId) {
      setSelectionSnapshot(datasetBindingService.createEmptySelectionSnapshot(roleBindings));
      return;
    }
    const reconciled = datasetBindingService.reconcileSelection({
      current: selection,
      roleBindings,
      hydratedSelection,
      collections: {
        sourceItems,
        outputItems,
        referenceItems,
      },
    });
    setSelectionSnapshot(reconciled.serializedSelection);
  }, [datasetBindingService, draft?.draftId, hydratedSelection, outputItems, referenceItems, roleBindings, selection, sourceItems]);

  useEffect(() => {
    if (!runtimeLaunch || !sessionScope) {
      return;
    }
    sessionPersistence.save(Object.freeze({
      schemaVersion: RuntimeWindowSessionPersistenceVersion,
      scope: sessionScope,
      launch: Object.freeze({
        launchId: runtimeLaunch.launchId,
        runtimeSessionId: context.snapshot?.activeSessionId,
        restoredFromLaunchId: persistedSession?.launch.launchId,
      }),
      resolvedPage: Object.freeze({
        systemAssetId: hydratedRuntime?.resolvedSystemAsset.assetId ?? runtimeLaunch.launchTarget.systemAssetId,
        pageBindingId: hydratedRuntime?.resolvedPage.pageBindingId ?? runtimeLaunch.launchTarget.pageBindingId,
        pageId: hydratedRuntime?.resolvedPage.pageId,
        pageTitle: hydratedRuntime?.resolvedPage.pageTitle,
        workflowTemplateAssetId: hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateAssetId,
        workflowTemplateVersionId: hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateVersionId,
        datasetBindingIds: Object.freeze((hydratedRuntime?.datasetBindings ?? []).map((entry) => entry.bindingId)),
      }),
      property: Object.freeze({
        presetId,
        config,
      }),
      selection: selectionSnapshot,
      panelState: Object.freeze({
        runAdvancedDetailsOpen: isRunAdvancedDetailsOpen,
      }),
      updatedAt: new Date().toISOString(),
    }));
  }, [
    config,
    context.snapshot?.activeSessionId,
    hydratedRuntime?.datasetBindings,
    hydratedRuntime?.resolvedPage.pageBindingId,
    hydratedRuntime?.resolvedPage.pageId,
    hydratedRuntime?.resolvedPage.pageTitle,
    hydratedRuntime?.resolvedSystemAsset.assetId,
    hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateAssetId,
    hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateVersionId,
    isRunAdvancedDetailsOpen,
    persistedSession?.launch.launchId,
    presetId,
    runtimeLaunch,
    selectionSnapshot,
    sessionPersistence,
    sessionScope,
  ]);

  useEffect(() => () => {
    runPollRequestIdRef.current += 1;
  }, []);

  const monitorRunUntilTerminal = async (
    runId: string,
  ): Promise<{ readonly ok: true; readonly status: "succeeded" | "failed" | "cancelled" } | { readonly ok: false; readonly message: string }> => {
    const pollRequestId = runPollRequestIdRef.current + 1;
    runPollRequestIdRef.current = pollRequestId;
    let attempt = 0;
    while (attempt < 180) {
      const statusResponse = await runtimeOperations.getRunStatus(runId);
      if (pollRequestId !== runPollRequestIdRef.current) {
        return Object.freeze({
          ok: false,
          message: "Run monitoring was replaced by a newer request.",
        });
      }
      if (!statusResponse.ok || !statusResponse.data) {
        return Object.freeze({
          ok: false,
          message: statusResponse.error?.message ?? "We couldn't load run status.",
        });
      }

      setRunLifecycle(mapRuntimeStatusToRunLifecycleState(statusResponse.data.status, statusResponse.data.progress));
      setActiveRunStatus(statusResponse.data);
      setFlowSteps(Object.freeze([
        Object.freeze({
          stepId: "trigger",
          status: "completed",
          userLabel: "Submitted",
          details: runId,
        }),
        Object.freeze({
          stepId: "execution",
          status: statusResponse.data.status === "pending"
            ? "started"
            : statusResponse.data.status === "running"
              ? "running"
              : statusResponse.data.status === "succeeded"
                ? "completed"
                : "failed",
          userLabel: "Monitoring",
          details: `${statusResponse.data.status} (${statusResponse.data.progress.completedNodeCount}/${statusResponse.data.progress.totalNodeCount})`,
        }),
      ]));

      if (isRuntimeTerminalStatus(statusResponse.data.status)) {
        return Object.freeze({
          ok: true,
          status: statusResponse.data.status,
        });
      }

      attempt += 1;
      await delay(1250);
    }

    return Object.freeze({
      ok: false,
      message: "Run monitoring timed out before terminal status.",
    });
  };

  if (!isImageRuntimeTarget || !draft) {
    return (
      <ImageStatusNotice
        title="Image editor unavailable"
        message="This runtime page is unavailable for the current launch context."
      />
    );
  }

  const isRunInProgress = runLifecycle.state === "validating"
    || runLifecycle.state === "queued"
    || runLifecycle.state === "preparing"
    || runLifecycle.state === "running";
  const launchPrecheck = buildImageRunLaunchPrecheckState({
    selectedSourceRecordId,
    selectedSourceAssetId,
    selectedSourceDatasetInstanceId,
    prompt: config.prompts.positivePrompt,
    validationIssues,
    executionReadiness,
    executionReadinessError,
  });
  const hasLaunchBlockingIssues = launchPrecheck.setupBlockingIssues.length > 0
    || launchPrecheck.backendBlockingIssues.length > 0;
  const runDisabled = isRunInProgress
    || isCheckingExecutionReadiness
    || hasLaunchBlockingIssues;
  const selectedOutputViewModel = selectedOutputItem
    ? mapItemsToDisplayViewModels([selectedOutputItem], "output")[0]
    : undefined;
  const selectedSourceViewModel = selectedSourceItem
    ? mapItemsToDisplayViewModels([selectedSourceItem], "source")[0]
    : undefined;
  const linkedRun = resolveLinkedRunForSelectedOutput({
    selectedOutputItem,
    runHistory,
    activeRunId,
  });
  const linkedRunStatusTone = resolveHistoryRunBadgeTone(linkedRun?.status);
  const runStatusBadgeClassName = linkedRunStatusTone === "success"
    ? "ui-badge ui-badge--success"
    : linkedRunStatusTone === "warning"
      ? "ui-badge ui-badge--warning"
      : linkedRunStatusTone === "danger"
        ? "ui-badge ui-badge--danger"
        : "ui-badge ui-badge--neutral";
  const quickActionDisabled = !selectedOutputItem || isResultQuickActionPending !== undefined;

  const chainRecordForReuse = async (input: {
    readonly sourceRecordId: string;
    readonly targetDatasetBindingId: Extract<ReferenceImageDatasetBindingId, "input-image-dataset" | "reference-image-dataset">;
  }): Promise<void> => {
    if (!draft?.draftId) {
      return;
    }
    setStatusMessage(undefined);
    setIsResultQuickActionPending(input.targetDatasetBindingId === "input-image-dataset" ? "source" : "reference");
    try {
      const chained = await studioShell.chainReferenceImageDatasetItemToInput({
        studioId: context.studioId,
        draftId: draft.draftId,
        sourceDatasetBindingId: "output-image-dataset",
        sourceRecordId: input.sourceRecordId,
        targetDatasetBindingId: input.targetDatasetBindingId,
      });
      if (!chained.ok || !chained.data) {
        setStatusMessage(chained.error?.message ?? "Couldn't reuse this result.");
        return;
      }

      if (input.targetDatasetBindingId === "input-image-dataset") {
        setDatasetInstanceId(chained.data.target.datasetInstanceId);
        setSelection((current) => setRoleSelection(current, {
          role: "source",
          recordId: chained.data.target.recordId,
          syncPreviewRole: true,
        }));
      } else {
        setSelection((current) => setRoleSelection(current, {
          role: "reference",
          recordId: chained.data.target.recordId,
          syncPreviewRole: true,
        }));
      }

      await loadCollections({
        preferredSourceRecordId: input.targetDatasetBindingId === "input-image-dataset"
          ? chained.data.target.recordId
          : undefined,
        preferredReferenceRecordId: input.targetDatasetBindingId === "reference-image-dataset"
          ? chained.data.target.recordId
          : undefined,
      });

      setStatusMessage(input.targetDatasetBindingId === "input-image-dataset"
        ? "Result prepared as your next source photo."
        : "Result prepared as your face reference photo.");
    } finally {
      setIsResultQuickActionPending(undefined);
    }
  };

  const chainOutputForReuse = async (
    targetDatasetBindingId: Extract<ReferenceImageDatasetBindingId, "input-image-dataset" | "reference-image-dataset">,
  ): Promise<void> => {
    if (!selectedOutputItem || !draft?.draftId) {
      return;
    }
    await chainRecordForReuse({
      sourceRecordId: selectedOutputItem.image.recordId,
      targetDatasetBindingId,
    });
  };

  const continueFromRunHistory = async (run: ImageRunHistoryRecord): Promise<void> => {
    const runId = run.runId;
    setSelectedHistoryRunId(runId);
    setIsContinuingFromRunId(runId);
    try {
      const snapshot = resolveRunParameterSnapshot({
        run,
        fallbackPresetId: presetId,
      });
      if (snapshot) {
        setPresetId(snapshot.presetId);
        setConfig(snapshot.config);
      }

      const outputRecordId = resolveRunOutputRecordId(run);
      if (outputRecordId) {
        await loadCollections({
          preferredOutputRecordId: outputRecordId,
        });
        setSelection((current) => setRoleSelection(current, {
          role: "output",
          recordId: outputRecordId,
          syncPreviewRole: true,
        }));
        setStatusMessage(`Loaded run ${runId} output for review and continuation.`);
        return;
      }

      const sourceRecordId = resolveRunSourceRecordId(run);
      if (sourceRecordId) {
        await loadCollections({
          preferredSourceRecordId: sourceRecordId,
        });
        setSelection((current) => setRoleSelection(current, {
          role: "source",
          recordId: sourceRecordId,
          syncPreviewRole: true,
        }));
        setStatusMessage(`Loaded run ${runId} context. Add changes, then create a new image.`);
        return;
      }

      setStatusMessage(`Run ${runId} has no reusable records yet, but settings were restored.`);
    } finally {
      setIsContinuingFromRunId(undefined);
    }
  };

  const reopenRecentSystem = async (systemId: string): Promise<void> => {
    if (!draft?.draftId || !sessionId) {
      setStatusMessage("Open a draft session before reopening saved systems.");
      return;
    }
    setIsReopeningRecentSystemId(systemId);
    try {
      const response = await studioShell.getImageSystemDefinition({ systemId });
      if (!response.ok || !response.data) {
        setStatusMessage(response.error?.message ?? "Couldn't reopen this saved system.");
        return;
      }
      const reopened = response.data;
      const summaryRecord = reopened.parameterBaseline as Readonly<Record<string, unknown>>;
      const configuredPresetId = summaryRecord["presetId"];
      const resolvedPresetId = typeof configuredPresetId === "string" && configuredPresetId.trim().length > 0
        ? configuredPresetId.trim()
        : presetId;
      const resolvedConfigInput = "imageConfig" in summaryRecord
        ? summaryRecord["imageConfig"]
        : summaryRecord;
      const resolvedConfig = resolveComfyImageManipulationConfig(resolvedConfigInput, {
        presetId: resolvedPresetId,
      });

      const workflowBindingId = hydratedRuntime?.resolvedWorkflowTemplate.bindingId
        ?? ImageManipulationSystemTemplate.compositionBindings.workflowTemplateBindingId;

      const modifyResponse = await studioShell.modifySystemDefinition({
        studioId: context.studioId,
        sessionId,
        draftId: draft.draftId,
        workflowBindings: [Object.freeze({
          bindingId: workflowBindingId,
          workflowAssetId: reopened.workflowId,
          workflowVersionId: reopened.workflowVersionTag,
        })],
        runtimeStatePatch: Object.freeze({
          imageSystemDefinitionId: reopened.systemId,
          imageWorkflowParameterValuesByWorkflowId: Object.freeze({
            [reopened.workflowId]: reopened.parameterBaseline,
          }),
        }),
      });
      if (!modifyResponse.ok) {
        setStatusMessage("Saved system loaded, but draft synchronization failed.");
        return;
      }

      setPresetId(resolvedPresetId);
      setConfig(resolvedConfig);
      await Promise.all([
        loadCollections({ hydration: true }),
        loadRunHistory(),
      ]);
      setStatusMessage(`Reopened '${reopened.title}'.`);
      void context.operations.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Couldn't reopen this saved system.");
    } finally {
      setIsReopeningRecentSystemId(undefined);
    }
  };

  return (
    <section className="ui-image-editor-page ui-stack ui-stack--sm">
      {isHydrating ? (
        <ImageStatusNotice
          title="Loading editor"
          message="Getting your photos and settings ready."
        />
      ) : null}
      {hasCollectionLoadError ? (
        <ImageStatusNotice
          title="Some images are unavailable"
          message="You can keep editing settings and try loading images again from the browser tabs."
          tone="warning"
        />
      ) : null}
      <div className="ui-image-editor-page__layout">
        <aside className="ui-image-editor-page__left-column ui-stack ui-stack--sm">
          <ImageUploadPanel
            title="Choose a photo"
            acceptedMimeTypes={["image/png", "image/jpeg", "image/webp"]}
            maxUploadCount={1}
            ingestionAdapter={uploadAdapter}
            targetContext={{
              system: { systemAssetId: draft.assetId },
              dataset: selectedSourceDatasetInstanceId
                ? {
                  datasetAssetId: sourceDatasetBinding?.datasetAssetId
                    ?? "asset:dataset:image-reference-input",
                  datasetVersionId: sourceDatasetBinding?.datasetAssetVersionId
                    ?? "v1",
                  systemDatasetInstanceId: selectedSourceDatasetInstanceId,
                }
                : undefined,
            }}
            disabled={context.isBusy || isUploading}
            onUploadRequested={(event) => {
              const file = event.files[0];
              if (!file) {
                return;
              }
              if (!actorUserIdentityId || !workspaceId || !sessionToken) {
                setStatusMessage("Sign in to upload images.");
                return;
              }
              setStatusMessage(undefined);
              setIsUploading(true);
              setUploadProgressStage("uploading");
              void encodeFileBase64(file)
                .then(async (payloadBase64) => {
                  const uploaded = await imageAssets.uploadStudioSourceImage({
                    file,
                    actorUserIdentityId,
                    workspaceId,
                    sessionToken,
                  });
                  if (!uploaded.ok || !uploaded.data) {
                    setStatusMessage(uploaded.error?.message ?? "We couldn't upload this photo.");
                    return undefined;
                  }
                  setUploadProgressStage("processing");
                  const metadata = await imageAssets.getImageAsset({
                    assetId: uploaded.data.assetId,
                    workspaceId,
                    sessionToken,
                  });
                  if (!metadata.ok || !metadata.data) {
                    setStatusMessage(metadata.error?.message ?? "Photo uploaded, but metadata could not be loaded.");
                    return undefined;
                  }

                  return studioShell.ingestReferenceImageUpload({
                    studioId: context.studioId,
                    draftId: draft.draftId,
                    fileName: metadata.data.asset.originalFilename,
                    mimeType: metadata.data.asset.mediaType,
                    payloadBase64,
                    sourceImageAssetId: metadata.data.asset.assetId,
                  });
                })
                .then((response) => {
                  if (!response) {
                    return undefined;
                  }
                  if (!response.ok || !response.data) {
                    setStatusMessage("We couldn't upload this photo.");
                    return undefined;
                  }
                  setDatasetInstanceId(response.data.datasetInstanceId);
                  setSelection((current) => setRoleSelection(current, {
                    role: "source",
                    recordId: response.data.recordId,
                    syncPreviewRole: true,
                  }));
                  setStatusMessage("Photo ready.");
                  return response.data.recordId;
                })
                .then((preferredSourceRecordId) => Promise.all([
                  loadCollections({ preferredSourceRecordId }),
                  loadRecentAssets(),
                  loadImageLibrary({
                    search: appliedImageLibrarySearch,
                    offset: 0,
                  }),
                ]))
                .finally(() => {
                  setIsUploading(false);
                  setUploadProgressStage("idle");
                });
            }}
          />
          {uploadProgressStage !== "idle" ? (
            <ImageStatusNotice
              title={uploadProgressStage === "uploading" ? "Uploading photo" : "Preparing photo"}
              message={uploadProgressStage === "uploading"
                ? "Uploading your photo to your image library."
                : "Finalizing metadata and linking the photo to this editing session."}
            />
          ) : null}
          <ComfyImageManipulationPropertyEditor
            value={config}
            presetId={presetId}
            issues={validationIssues}
            disabled={context.isBusy || isRunInProgress}
            onChange={(next) => {
              try {
                setConfig(resolveComfyImageManipulationConfig(next, { presetId }));
              } catch {
                setConfig(next);
              }
            }}
            onPresetIdChange={(nextPresetId) => {
              setPresetId(nextPresetId);
              setConfig(createComfyImageManipulationDefaultConfig({ presetId: nextPresetId }));
            }}
          />
          {validationIssues.length > 0 ? (
            <section className="ui-stack ui-stack--2xs">
              <ImageStatusNotice
                title="Update settings to continue"
                message={validationSummaryMessage}
                tone="warning"
              />
              <ul className="ui-text-small ui-text-secondary">
                {validationSummaryDetails.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </section>
          ) : (
            <ImageStatusNotice
              title="Settings ready"
              message={validationSummaryMessage}
              tone="success"
            />
          )}
          <section className="ui-image-surface ui-stack ui-stack--xs">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Selected photos</h3>
            </header>
            {isLoadingSources ? (
              <ImageStatusNotice
                title="Loading source photos"
                message="Your uploaded photos will appear here."
              />
            ) : null}
            {!isLoadingSources && sourceItems.length < 1 ? (
              <ImageStatusNotice
                title="No source photo yet"
                message="Choose a photo to start creating edits."
              />
            ) : null}
            {sourceLoadError ? (
              <ImageStatusNotice
                title="Source photos unavailable"
                message={sourceLoadError}
                tone="danger"
              />
            ) : null}
            <label className="ui-form-field">
              <span className="ui-form-field__label">Source photo</span>
              <select
                className="ui-input"
                value={selection.sourceRecordId ?? ""}
                disabled={sourceItems.length < 1 || isLoadingSources}
                onChange={(event) => {
                  const next = event.currentTarget.value || undefined;
                  setSelection((current) => setRoleSelection(current, {
                    role: "source",
                    recordId: next,
                    syncPreviewRole: true,
                  }));
                }}
              >
                {sourceItems.length < 1 ? <option value="">No source photo yet</option> : null}
                {sourceItems.map((item, index) => (
                  <option key={item.image.recordId} value={item.image.recordId}>
                    Source {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-form-field">
              <span className="ui-form-field__label">Face reference photo</span>
              <select
                className="ui-input"
                value={selection.referenceRecordId ?? ""}
                disabled={referenceItems.length < 1 || isLoadingReferences}
                onChange={(event) => {
                  const nextReferenceRecordId = event.currentTarget.value || undefined;
                  setSelection((current) => setRoleSelection(current, {
                    role: "reference",
                    recordId: nextReferenceRecordId,
                    syncPreviewRole: true,
                  }));
                }}
              >
                <option value="">None</option>
                {referenceItems.map((item, index) => (
                  <option key={item.image.recordId} value={item.image.recordId}>
                    Reference {index + 1}
                  </option>
                ))}
              </select>
            </label>
            {referenceLoadError ? (
              <ImageStatusNotice
                title="Face reference photos unavailable"
                message={referenceLoadError}
                tone="danger"
              />
            ) : null}
            {selectionConfirmationMessage ? (
              <ImageStatusNotice
                title="Selection confirmed"
                message={selectionConfirmationMessage}
                tone="success"
              />
            ) : null}
            {sessionToken ? (
              <section className="ui-stack ui-stack--2xs">
                <p className="ui-text-small ui-text-secondary">Recently used images</p>
                {isLoadingRecentImageAssets ? (
                  <ImageStatusNotice
                    title="Loading recently used images"
                    message="Your latest uploaded images will appear here."
                  />
                ) : null}
                {!isLoadingRecentImageAssets && recentImageAssetsError ? (
                  <ImageStatusNotice
                    title="Recently used images unavailable"
                    message={recentImageAssetsError}
                    tone="warning"
                  />
                ) : null}
                {!isLoadingRecentImageAssets && !recentImageAssetsError && recentImageAssets.length < 1 ? (
                  <ImageStatusNotice
                    title="No recent images yet"
                    message="Upload a photo to start your image library."
                  />
                ) : null}
                {!isLoadingRecentImageAssets && !recentImageAssetsError && recentImageAssetGroups.length > 0 ? (
                  <div className="ui-stack ui-stack--xs">
                    {recentImageAssetGroups.map((group) => (
                      <section key={group.key} className="ui-stack ui-stack--2xs">
                        <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>{group.label}</p>
                        <ul className="ui-text-small ui-text-secondary ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
                          {group.assets.map((asset) => (
                            <li key={asset.assetId}>
                              <div className="ui-stack ui-stack--2xs">
                                <span>{asset.originalFilename}</span>
                                <span className="ui-text-secondary">{toFriendlyTimestamp(asset.updatedAt) ?? "Recently updated"}</span>
                                <div className="ui-row ui-row--xs">
                                  <button
                                    type="button"
                                    className="ui-button ui-button--ghost ui-button--sm"
                                    disabled={Boolean(isReusingRecentImageAssetId)}
                                    onClick={() => {
                                      void reuseRecentImageAsset({
                                        asset,
                                        targetDatasetBindingId: "input-image-dataset",
                                      });
                                    }}
                                  >
                                    {isReusingRecentImageAssetId === asset.assetId ? "Preparing..." : "Use as source"}
                                  </button>
                                  {roleBindings.referenceBindingId ? (
                                    <button
                                      type="button"
                                      className="ui-button ui-button--ghost ui-button--sm"
                                      disabled={Boolean(isReusingRecentImageAssetId)}
                                      onClick={() => {
                                        void reuseRecentImageAsset({
                                          asset,
                                          targetDatasetBindingId: "reference-image-dataset",
                                        });
                                      }}
                                    >
                                      {isReusingRecentImageAssetId === asset.assetId ? "Preparing..." : "Use as face reference"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
            {sessionToken ? (
              <section className="ui-stack ui-stack--2xs" data-testid="image-recent-work-panel">
                <p className="ui-text-small ui-text-secondary">Recent work</p>
                {isLoadingRecentSystems ? (
                  <ImageStatusNotice
                    title="Loading recent systems"
                    message="Saved setups will appear here for quick continuation."
                  />
                ) : null}
                {!isLoadingRecentSystems && recentSystemsError ? (
                  <ImageStatusNotice
                    title="Recent systems unavailable"
                    message={recentSystemsError}
                    tone="warning"
                  />
                ) : null}
                {!isLoadingRecentSystems && !recentSystemsError && recentSystems.length < 1 ? (
                  <ImageStatusNotice
                    title="No saved systems yet"
                    message="Save this setup to reopen it later from recent work."
                  />
                ) : null}
                {!isLoadingRecentSystems && !recentSystemsError && recentSystems.length > 0 ? (
                  <ul className="ui-text-small ui-text-secondary ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
                    {recentSystems.map((system) => (
                      <li key={system.systemId}>
                        <div className="ui-stack ui-stack--2xs">
                          <span>{system.title}</span>
                          <span className="ui-text-secondary">
                            {system.readinessSummary} - {toFriendlyTimestamp(system.updatedAt) ?? system.updatedAt}
                          </span>
                          <div className="ui-row ui-row--xs">
                            <button
                              type="button"
                              className="ui-button ui-button--ghost ui-button--sm"
                              disabled={Boolean(isReopeningRecentSystemId)}
                              onClick={() => {
                                void reopenRecentSystem(system.systemId);
                              }}
                            >
                              {isReopeningRecentSystemId === system.systemId ? "Reopening..." : "Reopen setup"}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
            {sessionToken ? (
              <section className="ui-stack ui-stack--2xs">
                <p className="ui-text-small ui-text-secondary">Image library</p>
                <div className="ui-row ui-row--xs">
                  <input
                    type="search"
                    className="ui-input"
                    value={imageLibrarySearch}
                    placeholder="Search images by filename"
                    onChange={(event) => setImageLibrarySearch(event.currentTarget.value)}
                    disabled={isLoadingImageLibrary || isLoadingMoreImageLibrary}
                  />
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => {
                      setAppliedImageLibrarySearch(imageLibrarySearch.trim());
                    }}
                    disabled={isLoadingImageLibrary || isLoadingMoreImageLibrary}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => {
                      setImageLibrarySearch("");
                      setAppliedImageLibrarySearch("");
                    }}
                    disabled={isLoadingImageLibrary || isLoadingMoreImageLibrary}
                  >
                    Clear
                  </button>
                </div>
                {isLoadingImageLibrary ? (
                  <ImageStatusNotice
                    title="Loading image library"
                    message="Fetching your uploaded image assets."
                  />
                ) : null}
                {!isLoadingImageLibrary && imageLibraryError ? (
                  <ImageStatusNotice
                    title="Image library unavailable"
                    message={imageLibraryError}
                    tone="warning"
                  />
                ) : null}
                {!isLoadingImageLibrary && !imageLibraryError && imageLibraryAssets.length < 1 ? (
                  <ImageStatusNotice
                    title="No library images found"
                    message={appliedImageLibrarySearch
                      ? "Try a different search or upload a new photo."
                      : "Upload a photo to build your image library."}
                  />
                ) : null}
                {!isLoadingImageLibrary && !imageLibraryError && imageLibraryAssets.length > 0 ? (
                  <ul className="ui-text-small ui-text-secondary ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
                    {imageLibraryAssets.map((asset) => (
                      <li key={asset.assetId}>
                        <div className="ui-stack ui-stack--2xs">
                          <span>{asset.originalFilename}</span>
                          <span className="ui-text-secondary">
                            {formatAssetFileSize(asset.sizeBytes)} - {toFriendlyTimestamp(asset.updatedAt) ?? "Recently updated"}
                          </span>
                          <div className="ui-row ui-row--xs">
                            <button
                              type="button"
                              className="ui-button ui-button--ghost ui-button--sm"
                              disabled={Boolean(isReusingRecentImageAssetId)}
                              onClick={() => {
                                void reuseRecentImageAsset({
                                  asset,
                                  targetDatasetBindingId: "input-image-dataset",
                                });
                              }}
                            >
                              {isReusingRecentImageAssetId === asset.assetId ? "Preparing..." : "Use as source"}
                            </button>
                            {roleBindings.referenceBindingId ? (
                              <button
                                type="button"
                                className="ui-button ui-button--ghost ui-button--sm"
                                disabled={Boolean(isReusingRecentImageAssetId)}
                                onClick={() => {
                                  void reuseRecentImageAsset({
                                    asset,
                                    targetDatasetBindingId: "reference-image-dataset",
                                  });
                                }}
                              >
                                {isReusingRecentImageAssetId === asset.assetId ? "Preparing..." : "Use as face reference"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {imageLibraryHasMore ? (
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={isLoadingImageLibrary || isLoadingMoreImageLibrary}
                    onClick={() => {
                      void loadImageLibrary({
                        append: true,
                        search: appliedImageLibrarySearch,
                        offset: imageLibraryOffset,
                      });
                    }}
                  >
                    {isLoadingMoreImageLibrary ? "Loading..." : "Load more"}
                  </button>
                ) : null}
              </section>
            ) : null}
            <p className="ui-text-small ui-text-secondary">
              These selections stay linked to system-managed image collections.
            </p>
          </section>
          <section className="ui-image-surface ui-stack ui-stack--sm">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Create image</h3>
            </header>
            <section className="ui-stack ui-stack--2xs">
              <ImageStatusNotice
                title="Launch precheck: setup"
                message={launchPrecheck.setupBlockingIssues.length > 0
                  ? `${launchPrecheck.setupBlockingIssues.length} blocking setup issue(s) must be fixed.`
                  : "Setup is ready for launch."}
                tone={launchPrecheck.setupBlockingIssues.length > 0 ? "warning" : "success"}
              />
              {launchPrecheck.setupBlockingIssues.length > 0 ? (
                <ul className="ui-text-small ui-text-secondary">
                  {launchPrecheck.setupBlockingIssues.map((issue, index) => (
                    <li key={`setup-blocking-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
              <ImageStatusNotice
                title="Launch precheck: execution environment"
                message={isCheckingExecutionReadiness
                  ? "Checking backend and node availability."
                  : executionReadiness
                    ? `Backend is ${executionReadiness.readiness}.`
                    : executionReadinessError ?? "Execution environment readiness has not been confirmed."}
                tone={isCheckingExecutionReadiness
                  ? "neutral"
                  : launchPrecheck.backendBlockingIssues.length > 0
                    ? "warning"
                    : launchPrecheck.backendAdvisories.length > 0
                      ? "warning"
                      : "success"}
              />
              {!isCheckingExecutionReadiness && launchPrecheck.backendBlockingIssues.length > 0 ? (
                <ul className="ui-text-small ui-text-secondary">
                  {launchPrecheck.backendBlockingIssues.map((issue, index) => (
                    <li key={`backend-blocking-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
              {!isCheckingExecutionReadiness && launchPrecheck.backendAdvisories.length > 0 ? (
                <ul className="ui-text-small ui-text-secondary">
                  {launchPrecheck.backendAdvisories.map((issue, index) => (
                    <li key={`backend-advisory-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
              <div className="ui-row ui-row--xs">
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  onClick={() => {
                    void refreshExecutionReadiness();
                  }}
                  disabled={isCheckingExecutionReadiness}
                >
                  {isCheckingExecutionReadiness ? "Checking..." : "Refresh precheck"}
                </button>
                {executionReadiness?.checkedAt ? (
                  <span className="ui-text-small ui-text-secondary">
                    Checked {toFriendlyTimestamp(executionReadiness.checkedAt) ?? executionReadiness.checkedAt}
                  </span>
                ) : null}
              </div>
            </section>
            <button
              type="button"
              className="ui-button ui-button--primary"
              disabled={runDisabled}
              onClick={() => {
                setRunLifecycle(Object.freeze({ state: "validating", message: "Checking your setup" }));
                setActiveRunId(undefined);
                setActiveRunStatus(undefined);
                setIntegrityIssues([]);
                setFlowSteps([]);
                setFlowIssues([]);
                const mapped = mapImageManipulationRuntimeStateToExecutionRequest({
                  studioId: context.studioId,
                  draftId: draft.draftId,
                  runtimeSessionId: context.snapshot?.activeSessionId,
                  systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                  workflowAssetId: runtimeWorkflowAssetId,
                  workflowAssetVersionId: runtimeWorkflowAssetVersionId,
                  presetId,
                  config,
                  roleBindings,
                  datasetBindingsById,
                  selectedSource: selectedSourceItem,
                  selectedOutput: selectedOutputItem,
                  selectedReference: selectedReferenceItem,
                  selectionSnapshot,
                });
                if (!mapped.ok) {
                  setRunLifecycle(Object.freeze({
                    state: "failed",
                    message: mapped.userMessage,
                  }));
                  setFlowIssues(Object.freeze([Object.freeze({
                    stepId: "trigger",
                    code: mapped.code,
                    userMessage: mapped.userMessage,
                    technicalMessage: mapped.technicalMessage,
                  })]));
                  return;
                }
                const integrity = validateReferenceImageCrossStudioContext(mapped.runtimeContext);
                if (!integrity.valid) {
                  setRunLifecycle(Object.freeze({
                    state: "failed",
                    message: "Please check your image and settings.",
                  }));
                  setIntegrityIssues(integrity.blockingIssues);
                  return;
                }

                setFlowSteps(Object.freeze([
                  Object.freeze({
                    stepId: "trigger",
                    status: "running",
                    userLabel: "Submitting",
                  }),
                ]));

                void (async () => {
                  const startResponse = await runtimeOperations.startRun({
                    systemId: runtimeWorkflowAssetId,
                    versionId: runtimeWorkflowAssetVersionId,
                    async: true,
                    trigger: "manual",
                    inputPayload: mapped.startRequest.context,
                    metadata: Object.freeze({
                      studioId: context.studioId,
                      draftId: draft.draftId,
                      systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                    }),
                  });
                  if (!startResponse.ok || !startResponse.data) {
                    setRunLifecycle(Object.freeze({
                      state: "failed",
                      message: startResponse.error?.message ?? "Could not submit run.",
                    }));
                    setFlowIssues(Object.freeze([Object.freeze({
                      stepId: "trigger",
                      code: startResponse.error?.code ?? "run-submit-failed",
                      userMessage: startResponse.error?.message ?? "Could not submit run.",
                    })]));
                    return;
                  }

                  const runId = startResponse.data.executionId;
                  setActiveRunId(runId);
                  setFlowSteps(Object.freeze([
                    Object.freeze({
                      stepId: "trigger",
                      status: "completed",
                      userLabel: "Submitted",
                      details: runId,
                    }),
                    Object.freeze({
                      stepId: "execution",
                      status: startResponse.data.status === "pending" ? "started" : "running",
                      userLabel: "Monitoring",
                    }),
                  ]));
                  setRunLifecycle(mapRuntimeStatusToRunLifecycleState(startResponse.data.status));

                  const monitored = await monitorRunUntilTerminal(runId);
                  if (!monitored.ok) {
                    setRunLifecycle(Object.freeze({
                      state: "failed",
                      message: monitored.message,
                    }));
                    setFlowIssues(Object.freeze([Object.freeze({
                      stepId: "execution",
                      code: "run-monitor-failed",
                      userMessage: monitored.message,
                    })]));
                    return;
                  }
                  if (monitored.status === "cancelled") {
                    setRunLifecycle(Object.freeze({
                      state: "cancelled",
                      message: "This run was cancelled.",
                    }));
                    return;
                  }

                  const resultResponse = await runtimeOperations.getRunResult({
                    executionId: runId,
                    diagnosticsLimit: 50,
                    nodeResultLimit: 20,
                  });
                  if (!resultResponse.ok || !resultResponse.data) {
                    setRunLifecycle(Object.freeze({
                      state: "failed",
                      message: resultResponse.error?.message ?? "Could not read run results.",
                    }));
                    setFlowIssues(Object.freeze([Object.freeze({
                      stepId: "execution",
                      code: resultResponse.error?.code ?? "run-result-read-failed",
                      userMessage: resultResponse.error?.message ?? "Could not read run results.",
                    })]));
                    return;
                  }

                  setFlowSteps((current) => Object.freeze([
                    ...current.filter((step) => step.stepId !== "persistence"),
                    Object.freeze({
                      stepId: "persistence",
                      status: "running",
                      userLabel: "Saving",
                    }),
                  ]));

                  const persistenceResponse = await studioShell.persistReferenceImageOutputs(
                    createReferenceImageOutputPersistenceRequest({
                      studioId: context.studioId,
                      draftId: draft.draftId,
                      executionId: runId,
                      sourceRecordId: mapped.sourceRecordId,
                      sourceAssetId: mapped.sourceAssetId,
                      parameterSnapshot: Object.freeze({
                        presetId,
                        imageConfig: mapped.resolvedConfig,
                        selectedReferenceRecordId: selectedReferenceItem?.image.recordId,
                        selectionSnapshot,
                      }),
                      runtimeContext: mapped.runtimeContext,
                      workflowAssetId: runtimeWorkflowAssetId,
                      workflowAssetVersionId: runtimeWorkflowAssetVersionId,
                      systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                      runtimeResult: mapRuntimeSdkResultToPersistenceResult(resultResponse.data),
                    }),
                  );

                  if (!persistenceResponse.ok || !persistenceResponse.data) {
                    setRunLifecycle(Object.freeze({
                      state: "failed",
                      message: persistenceResponse.error?.message ?? "Could not save run results.",
                    }));
                    setFlowIssues(Object.freeze([Object.freeze({
                      stepId: "persistence",
                      code: persistenceResponse.error?.code ?? "persistence-failed",
                      userMessage: persistenceResponse.error?.message ?? "Could not save run results.",
                    })]));
                    return;
                  }

                  if (
                    persistenceResponse.data.executionOutcome === "non-recoverable-failure"
                    || persistenceResponse.data.executionOutcome === "recoverable-failure"
                    || persistenceResponse.data.status === "failed"
                  ) {
                    setRunLifecycle(Object.freeze({
                      state: "failed",
                      message: persistenceResponse.data.userMessage || "Something went wrong while creating this image.",
                    }));
                    setFlowIssues(Object.freeze([
                      ...persistenceResponse.data.failureMessages.map((message, index) => Object.freeze({
                        stepId: "persistence",
                        code: `persistence-failure-${index + 1}`,
                        userMessage: persistenceResponse.data.userMessage || "Something went wrong while creating this image.",
                        technicalMessage: message,
                      })),
                    ]));
                    return;
                  }

                  setFlowSteps((current) => Object.freeze([
                    ...current.filter((step) => step.stepId !== "persistence" && step.stepId !== "refresh"),
                    Object.freeze({
                      stepId: "persistence",
                      status: persistenceResponse.data.executionOutcome === "partial-failure" || persistenceResponse.data.status === "partial"
                        ? "partially-completed"
                        : "completed",
                      userLabel: "Saving",
                      details: `Saved ${persistenceResponse.data.persistedRecordIds.length} image(s).`,
                    }),
                    Object.freeze({
                      stepId: "refresh",
                      status: "running",
                      userLabel: "Refreshing",
                    }),
                  ]));
                  await Promise.all([
                    loadCollections({ preferLatestOutput: true }),
                    loadRunHistory(),
                  ]);
                  setSelection((current) => setActivePreviewRole(current, "output"));
                  setFlowSteps((current) => Object.freeze(current.map((step) => (
                    step.stepId === "refresh"
                      ? Object.freeze({ ...step, status: "completed" as const })
                      : step
                  ))));
                  setRunLifecycle(Object.freeze({
                    state: "completed",
                    message: "Done. Your result is ready.",
                  }));
                })().catch(() => {
                  setRunLifecycle(Object.freeze({
                    state: "failed",
                    message: "Run failed. Check advanced details.",
                  }));
                });
              }}
            >
              {isRunInProgress ? "Creating..." : "Create image"}
            </button>
            {isRunInProgress && activeRunId ? (
              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={() => {
                  void runtimeOperations.cancelRun({
                    executionId: activeRunId,
                    reason: "Cancelled from image editor.",
                  }).then((response) => {
                    if (!response.ok) {
                      setFlowIssues(Object.freeze([Object.freeze({
                        stepId: "execution",
                        code: response.error?.code ?? "run-cancel-failed",
                        userMessage: response.error?.message ?? "Couldn't request cancellation.",
                      })]));
                      return;
                    }
                    setStatusMessage("Cancellation requested.");
                    setRunLifecycle(Object.freeze({
                      state: "running",
                      message: "Cancellation requested. Waiting for run status confirmation.",
                    }));
                  });
                }}
              >
                Cancel run
              </button>
            ) : null}
            {!selectedSourceRecordId && !isLoadingSources ? (
              <ImageStatusNotice
                title="Choose a source photo first"
                message="Add or select a source photo before creating an image."
                tone="warning"
              />
            ) : null}
            <ImageStatusNotice
              title={`Status: ${runStateLabels[runLifecycle.state]}`}
              message={runStatusMessage}
              tone={resolveRunStatusTone(runLifecycle.state)}
            />
            {(runLifecycle.state === "degraded" || launchPrecheck.backendAdvisories.length > 0) ? (
              <ImageStatusNotice
                title="Execution warnings"
                message={launchPrecheck.backendAdvisories[0]?.message
                  ?? runLifecycle.message
                  ?? "Execution environment is available with warnings."}
                tone="warning"
              />
            ) : null}
            <section className="ui-stack ui-stack--2xs" aria-live="polite">
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>Run progress</p>
              <div
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: "0.5rem",
                  borderRadius: "999px",
                  background: "var(--ui-color-surface-muted, #e8ebf1)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${runProgress.percentComplete}%`,
                    height: "100%",
                    background: runLifecycle.state === "failed"
                      ? "var(--ui-color-danger-500, #c53b3b)"
                      : runLifecycle.state === "completed"
                        ? "var(--ui-color-success-500, #24804a)"
                        : "var(--ui-color-primary-500, #2b6cb0)",
                    transition: "width 150ms ease-out",
                  }}
                />
              </div>
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                {runProgress.available ? `${runProgress.percentComplete}% · ${runProgress.summary}` : runProgress.summary}
              </p>
              {activeRunStatus ? (
                <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                  Last update {toFriendlyTimestamp(activeRunStatus.updatedAt) ?? activeRunStatus.updatedAt}
                </p>
              ) : null}
            </section>
            {flowIssues.length > 0 && runLifecycle.state === "failed" ? (
              <ImageStatusNotice
                title="Failure details"
                message={flowIssues[0]?.userMessage ?? "The run failed before completion."}
                tone="danger"
              />
            ) : null}
            <details
              open={isRunAdvancedDetailsOpen}
              onToggle={(event) => {
                setIsRunAdvancedDetailsOpen(event.currentTarget.open);
              }}
            >
              <summary className="ui-text-small ui-text-secondary">Advanced details</summary>
              {activeRunId ? (
                <p className="ui-text-small ui-text-secondary">Run ID: {activeRunId}</p>
              ) : null}
              {activeRunStatus ? (
                <p className="ui-text-small ui-text-secondary">
                  Authoritative status: {activeRunStatus.status} ({activeRunStatus.progress.completedNodeCount}/{activeRunStatus.progress.totalNodeCount})
                </p>
              ) : null}
              {flowSteps.map((step) => (
                <p key={step.stepId} className="ui-text-small ui-text-secondary">
                  {step.userLabel}: {step.status}
                </p>
              ))}
              {(integrityIssues.length > 0 || flowIssues.length > 0) ? (
                <ul className="ui-text-small ui-text-secondary">
                  {integrityIssues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>{issue.technicalMessage}</li>
                  ))}
                  {flowIssues.map((issue, index) => (
                    <li key={`${issue.stepId}-${issue.code}-${index}`}>{issue.technicalMessage ?? issue.userMessage}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          </section>
        </aside>
        <div className="ui-image-editor-page__right-column ui-stack ui-stack--sm">
          <ImagePreviewPanel
            className="ui-image-editor-page__preview-panel"
            title="Image preview"
            subtitle={previewContextLabels[selection.activePreviewRole]}
            image={selectedPreviewViewModel}
            loading={previewLoading}
            errorMessage={previewErrorMessage}
            emptyMessage="Select a source, result, or face reference image to preview it here."
            unavailableMessage="This image is currently unavailable."
          />
          <section className="ui-image-surface ui-image-editor-page__result-review-panel" data-testid="image-result-review-panel">
            <header className="ui-image-surface__header ui-image-editor-page__result-review-header">
              <div className="ui-stack ui-stack--2xs">
                <h3 className="ui-image-surface__title">Result review</h3>
                <span className="ui-text-small ui-text-secondary">Before and after</span>
              </div>
              <div className="ui-row ui-row--xs ui-image-editor-page__result-review-badges">
                <span className={`ui-badge ${selectedOutputItem ? "ui-badge--success" : "ui-badge--neutral"}`}>
                  {selectedOutputItem ? "Result selected" : "No result yet"}
                </span>
                <span className={runStatusBadgeClassName}>
                  {linkedRun?.status ?? "run link unavailable"}
                </span>
              </div>
            </header>
            {!selectedOutputItem ? (
              <ImageStatusNotice
                title="No result selected"
                message="Create an image to review it here with before/after context."
              />
            ) : (
              <div className="ui-stack ui-stack--xs">
                <div className="ui-image-editor-page__before-after-grid">
                  <article className="ui-stack ui-stack--2xs">
                    <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>Before (source)</p>
                    {selectedSourceViewModel ? (
                      <ImageRenderFrame
                        image={selectedSourceViewModel}
                        renderOptions={Object.freeze({
                          fitMode: "cover",
                          zoomCapability: "disabled",
                          placeholderBehavior: "show-placeholder",
                          lazyLoad: true,
                          allowSelectionHighlight: true,
                        })}
                        className="ui-image-editor-page__before-after-frame"
                        fallbackLabel="Source preview unavailable."
                      />
                    ) : (
                      <ImageStatusNotice
                        title="Source unavailable"
                        message="Choose a source photo to compare against this result."
                        tone="warning"
                      />
                    )}
                  </article>
                  <article className="ui-stack ui-stack--2xs">
                    <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>After (result)</p>
                    {selectedOutputViewModel ? (
                      <ImageRenderFrame
                        image={selectedOutputViewModel}
                        renderOptions={Object.freeze({
                          fitMode: "cover",
                          zoomCapability: "disabled",
                          placeholderBehavior: "show-placeholder",
                          lazyLoad: true,
                          allowSelectionHighlight: true,
                        })}
                        className="ui-image-editor-page__before-after-frame"
                        fallbackLabel="Result preview unavailable."
                      />
                    ) : null}
                  </article>
                </div>
                <div className="ui-row ui-row--xs">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={quickActionDisabled}
                    onClick={() => {
                      void chainOutputForReuse("input-image-dataset");
                    }}
                  >
                    {isResultQuickActionPending === "source" ? "Preparing..." : "Use result as source"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={quickActionDisabled || !roleBindings.referenceBindingId}
                    onClick={() => {
                      void chainOutputForReuse("reference-image-dataset");
                    }}
                  >
                    {isResultQuickActionPending === "reference" ? "Preparing..." : "Use result as face reference"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={!selectedOutputItem}
                    onClick={() => {
                      setSelection((current) => setActivePreviewRole(current, "source"));
                      setStatusMessage("Adjust settings, then select Create image to run again.");
                    }}
                  >
                    Rerun with changes
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={isLoadingOutputs || isLoadingRunHistory}
                    onClick={() => {
                      void Promise.all([
                        loadCollections(),
                        loadRunHistory(),
                      ]);
                    }}
                  >
                    Refresh review
                  </button>
                </div>
                <details>
                  <summary className="ui-text-small ui-text-secondary">Lineage and settings</summary>
                  <div className="ui-stack ui-stack--2xs" style={{ marginTop: "0.5rem" }}>
                    <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                      Run ID: {selectedOutputItem.workflow?.workflowRunId ?? activeRunId ?? "Unavailable"}
                    </p>
                    <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                      Source: {selectedOutputItem.sourceImage?.stableId ?? selectedOutputItem.sourceImage?.assetId ?? "Unavailable"}
                    </p>
                    <pre className="ui-code-block">{JSON.stringify(selectedOutputItem.generationParametersSummary, null, 2)}</pre>
                  </div>
                </details>
              </div>
            )}
            <section className="ui-stack ui-stack--2xs" data-testid="image-run-history-panel">
              <div className="ui-image-surface__header">
                <h4 className="ui-image-surface__title">Run history</h4>
                <span className="ui-text-small ui-text-secondary">{runHistory.length} runs</span>
              </div>
              {isLoadingRunHistory ? (
                <ImageStatusNotice
                  title="Loading run history"
                  message="Fetching authoritative run records for this setup."
                />
              ) : null}
              {!isLoadingRunHistory && runHistory.length < 1 ? (
                <ImageStatusNotice
                  title="No run history yet"
                  message="Create an image to build continuation history."
                />
              ) : null}
              {!isLoadingRunHistory && runHistory.length > 0 ? (
                <ul className="ui-text-small ui-text-secondary ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
                  {runHistory.map((run) => {
                    const outputRecordId = resolveRunOutputRecordId(run);
                    const canUseRunOutput = Boolean(outputRecordId);
                    const runStatusTone = resolveHistoryRunBadgeTone(run.status);
                    const runBadgeClassName = runStatusTone === "success"
                      ? "ui-badge ui-badge--success"
                      : runStatusTone === "warning"
                        ? "ui-badge ui-badge--warning"
                        : runStatusTone === "danger"
                          ? "ui-badge ui-badge--danger"
                          : "ui-badge ui-badge--neutral";
                    return (
                      <li key={run.runId}>
                        <div className="ui-stack ui-stack--2xs">
                          <div className="ui-row ui-row--xs ui-row--middle">
                            <strong>{run.runId}</strong>
                            <span className={runBadgeClassName}>{run.status}</span>
                          </div>
                          <span className="ui-text-secondary">
                            {toFriendlyTimestamp(run.timestamps.updatedAt) ?? run.timestamps.updatedAt}
                            {" - "}
                            {resolveRunOutputCount(run)} output{resolveRunOutputCount(run) === 1 ? "" : "s"}
                          </span>
                          <span className="ui-text-secondary">{resolveRunHistorySummary(run)}</span>
                          <div className="ui-row ui-row--xs">
                            <button
                              type="button"
                              className={`ui-button ui-button--sm ${selectedHistoryRunId === run.runId ? "ui-button--primary" : "ui-button--ghost"}`}
                              disabled={Boolean(isContinuingFromRunId)}
                              onClick={() => {
                                void continueFromRunHistory(run);
                              }}
                            >
                              {isContinuingFromRunId === run.runId
                                ? "Loading..."
                                : selectedHistoryRunId === run.runId
                                  ? "Loaded"
                                  : "Open context"}
                            </button>
                            <button
                              type="button"
                              className="ui-button ui-button--ghost ui-button--sm"
                              disabled={!canUseRunOutput || Boolean(isContinuingFromRunId)}
                              onClick={() => {
                                if (!outputRecordId) {
                                  return;
                                }
                                setSelectedHistoryRunId(run.runId);
                                void chainRecordForReuse({
                                  sourceRecordId: outputRecordId,
                                  targetDatasetBindingId: "input-image-dataset",
                                });
                              }}
                            >
                              Continue from output
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
            {runHistoryError ? (
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>{runHistoryError}</p>
            ) : null}
          </section>
          <section className="ui-image-surface ui-image-editor-page__gallery-panel">
            <header className="ui-image-surface__header ui-image-editor-page__gallery-header">
              <h3 className="ui-image-surface__title">Image browser</h3>
            </header>
            <div className="ui-image-editor-page__gallery-contexts" role="tablist" aria-label="Image collections">
              <button
                type="button"
                role="tab"
                aria-selected={selection.activePreviewRole === "output"}
                className={`ui-button ui-button--sm ${selection.activePreviewRole === "output" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setSelection((current) => setActivePreviewRole(current, "output"))}
              >
                Results ({outputItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selection.activePreviewRole === "source"}
                className={`ui-button ui-button--sm ${selection.activePreviewRole === "source" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setSelection((current) => setActivePreviewRole(current, "source"))}
              >
                Source ({sourceItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selection.activePreviewRole === "reference"}
                className={`ui-button ui-button--sm ${selection.activePreviewRole === "reference" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setSelection((current) => setActivePreviewRole(current, "reference"))}
              >
                Face reference ({referenceItems.length})
              </button>
            </div>
            <ImageGallerySlider
              className="ui-image-editor-page__gallery-slider-panel"
              title={activeGallery.title}
              subtitle={activeGallery.subtitle}
              items={activeGallery.items}
              selectedImageId={activeGallery.selectedId}
              loading={activeGallery.loading}
              errorMessage={activeGallery.errorMessage}
              emptyMessage={activeGallery.emptyMessage}
              onImageSelected={(imageId) => {
                setSelection((current) => setRoleSelection(current, {
                  role: current.activePreviewRole,
                  recordId: imageId,
                  syncPreviewRole: true,
                }));
              }}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

export default ImageManipulationRuntimeEditorPanel;

