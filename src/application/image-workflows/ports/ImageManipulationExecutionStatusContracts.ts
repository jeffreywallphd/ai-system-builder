import type {
  ImageManipulationFailureSummaryCategory,
  ImageManipulationIssueClassification,
} from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";
import { ImageManipulationFailureSummaryCategories } from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";
import type { ImageManipulationRetryRecoveryContract } from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";

export const ImageManipulationBackendJobStates = Object.freeze({
  queued: "queued",
  preparing: "preparing",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type ImageManipulationBackendJobState =
  typeof ImageManipulationBackendJobStates[keyof typeof ImageManipulationBackendJobStates];

export const ImageManipulationBackendTerminalStates = Object.freeze({
  completed: ImageManipulationBackendJobStates.completed,
  failed: ImageManipulationBackendJobStates.failed,
  cancelled: ImageManipulationBackendJobStates.cancelled,
});

export type ImageManipulationBackendTerminalState =
  typeof ImageManipulationBackendTerminalStates[keyof typeof ImageManipulationBackendTerminalStates];

export const ImageManipulationExecutionWarningSeverities = Object.freeze({
  info: "info",
  warning: "warning",
});

export type ImageManipulationExecutionWarningSeverity =
  typeof ImageManipulationExecutionWarningSeverities[keyof typeof ImageManipulationExecutionWarningSeverities];

export const ImageManipulationExecutionFailureCategories = Object.freeze({
  validation: ImageManipulationFailureSummaryCategories.validation,
  translation: ImageManipulationFailureSummaryCategories.translation,
  dependency: ImageManipulationFailureSummaryCategories.dependency,
  capacity: ImageManipulationFailureSummaryCategories.capacity,
  timeout: ImageManipulationFailureSummaryCategories.timeout,
  cancellation: ImageManipulationFailureSummaryCategories.cancellation,
  execution: ImageManipulationFailureSummaryCategories.execution,
  output: ImageManipulationFailureSummaryCategories.output,
  connectivity: ImageManipulationFailureSummaryCategories.connectivity,
  internal: ImageManipulationFailureSummaryCategories.internal,
  unknown: ImageManipulationFailureSummaryCategories.unknown,
});

export type ImageManipulationExecutionFailureCategory =
  ImageManipulationFailureSummaryCategory;

export interface ImageManipulationBackendStateNormalizationInput {
  readonly rawState?: string;
  readonly completed?: boolean;
  readonly failed?: boolean;
  readonly cancelled?: boolean;
  readonly queuePosition?: number;
  readonly progressPercent?: number;
}

export interface ImageManipulationExecutionWarning {
  readonly code: string;
  readonly severity: ImageManipulationExecutionWarningSeverity;
  readonly summary: string;
  readonly userMessage?: string;
  readonly occurredAt?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationBackendDiagnostics {
  readonly backendFamily: string;
  readonly backendJobId?: string;
  readonly rawState?: string;
  readonly rawStatusCode?: string;
  readonly rawMessage?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationExecutionProgressSnapshot {
  readonly state: Exclude<ImageManipulationBackendJobState, ImageManipulationBackendTerminalState>;
  readonly updatedAt: string;
  readonly percent?: number;
  readonly stageCode?: string;
  readonly stageLabel?: string;
  readonly message?: string;
  readonly queuePosition?: number;
  readonly etaSeconds?: number;
  readonly completedUnitCount?: number;
  readonly totalUnitCount?: number;
  readonly partialOutputCount?: number;
}

export interface ImageManipulationExecutionCompletionSummary {
  readonly completedAt: string;
  readonly durationMs?: number;
  readonly outputCount: number;
  readonly partialOutputCount?: number;
  readonly hadPartialOutputs: boolean;
  readonly warningsCount: number;
  readonly summary?: string;
}

export interface ImageManipulationExecutionFailure {
  readonly code: string;
  readonly category: ImageManipulationExecutionFailureCategory;
  readonly summary: string;
  readonly userMessage?: string;
  readonly retryable: boolean;
  readonly recovery?: ImageManipulationRetryRecoveryContract;
  readonly failedAt: string;
  readonly stageCode?: string;
  readonly partialProgressObserved: boolean;
  readonly partialOutputCount: number;
  readonly classification?: ImageManipulationIssueClassification;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationBackendJobSnapshot {
  readonly executionJobId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly state: ImageManipulationBackendJobState;
  readonly updatedAt: string;
  readonly progress?: ImageManipulationExecutionProgressSnapshot;
  readonly warnings: ReadonlyArray<ImageManipulationExecutionWarning>;
  readonly completion?: ImageManipulationExecutionCompletionSummary;
  readonly failure?: ImageManipulationExecutionFailure;
  readonly backendDiagnostics?: ImageManipulationBackendDiagnostics;
}

const stateLookup: Readonly<Record<string, ImageManipulationBackendJobState>> = Object.freeze({
  queued: ImageManipulationBackendJobStates.queued,
  pending: ImageManipulationBackendJobStates.queued,
  waiting: ImageManipulationBackendJobStates.queued,
  accepted: ImageManipulationBackendJobStates.queued,
  enqueued: ImageManipulationBackendJobStates.queued,
  preparing: ImageManipulationBackendJobStates.preparing,
  dispatching: ImageManipulationBackendJobStates.preparing,
  starting: ImageManipulationBackendJobStates.preparing,
  initializing: ImageManipulationBackendJobStates.preparing,
  bootstrapping: ImageManipulationBackendJobStates.preparing,
  running: ImageManipulationBackendJobStates.running,
  inprogress: ImageManipulationBackendJobStates.running,
  processing: ImageManipulationBackendJobStates.running,
  executing: ImageManipulationBackendJobStates.running,
  finishing: ImageManipulationBackendJobStates.running,
  completing: ImageManipulationBackendJobStates.running,
  completed: ImageManipulationBackendJobStates.completed,
  succeeded: ImageManipulationBackendJobStates.completed,
  success: ImageManipulationBackendJobStates.completed,
  done: ImageManipulationBackendJobStates.completed,
  finished: ImageManipulationBackendJobStates.completed,
  failed: ImageManipulationBackendJobStates.failed,
  failure: ImageManipulationBackendJobStates.failed,
  errored: ImageManipulationBackendJobStates.failed,
  error: ImageManipulationBackendJobStates.failed,
  cancelled: ImageManipulationBackendJobStates.cancelled,
  canceled: ImageManipulationBackendJobStates.cancelled,
  abort: ImageManipulationBackendJobStates.cancelled,
  aborted: ImageManipulationBackendJobStates.cancelled,
  interrupted: ImageManipulationBackendJobStates.cancelled,
});

export function normalizeImageManipulationBackendJobState(
  input: ImageManipulationBackendStateNormalizationInput,
): ImageManipulationBackendJobState {
  if (input.cancelled) {
    return ImageManipulationBackendJobStates.cancelled;
  }
  if (input.failed) {
    return ImageManipulationBackendJobStates.failed;
  }
  if (input.completed) {
    return ImageManipulationBackendJobStates.completed;
  }

  const normalizedRaw = normalizeRawState(input.rawState);
  if (normalizedRaw && normalizedRaw in stateLookup) {
    return stateLookup[normalizedRaw];
  }

  if (typeof input.progressPercent === "number" && input.progressPercent > 0) {
    return ImageManipulationBackendJobStates.running;
  }
  if (typeof input.queuePosition === "number" && input.queuePosition >= 0) {
    return ImageManipulationBackendJobStates.queued;
  }

  return ImageManipulationBackendJobStates.preparing;
}

export function normalizeImageManipulationProgressPercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

export function isImageManipulationExecutionTerminalState(
  state: ImageManipulationBackendJobState,
): state is ImageManipulationBackendTerminalState {
  return state === ImageManipulationBackendJobStates.completed
    || state === ImageManipulationBackendJobStates.failed
    || state === ImageManipulationBackendJobStates.cancelled;
}

function normalizeRawState(rawState: string | undefined): string | undefined {
  const value = rawState?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  return value.replace(/[\s_-]+/g, "");
}
