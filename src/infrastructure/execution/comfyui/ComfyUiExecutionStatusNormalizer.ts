import {
  ImageManipulationExecutionErrorCategories,
  ImageManipulationExecutionStates,
  normalizeImageManipulationBackendJobState,
  normalizeImageManipulationProgressPercent,
  type ImageManipulationBackendDiagnostics,
  type ImageManipulationBackendJobSnapshot,
  type ImageManipulationExecutionFailure,
  type ImageManipulationExecutionProgressSnapshot,
  type ImageManipulationExecutionStateSnapshot,
  type ImageManipulationExecutionWarning,
} from "@application/image-workflows/ports";

export interface ComfyUiExecutionStateNormalizationInput {
  readonly executionJobId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly backendExecutionId?: string;
  readonly backendFamily?: string;
  readonly backendSnapshot?: Readonly<{
    readonly state?: string;
    readonly checkedAt?: string;
    readonly queuePosition?: number;
    readonly completed?: boolean;
    readonly statusMessage?: string;
  }>;
  readonly progress?: Readonly<{
    readonly percent?: number;
    readonly stageCode?: string;
    readonly stageLabel?: string;
    readonly message?: string;
    readonly partialOutputCount?: number;
    readonly updatedAt?: string;
  }>;
  readonly outputCount?: number;
  readonly backendStatusCode?: string;
  readonly backendDetails?: Readonly<Record<string, unknown>>;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

const defaultBackendFamily = "adapter.comfyui.image-manipulation";
const degradedStateTokens = new Set<string>([
  "degraded",
  "partial",
  "limited",
  "unstable",
]);
const knownStateTokens = new Set<string>([
  "queued",
  "pending",
  "waiting",
  "accepted",
  "enqueued",
  "preparing",
  "dispatching",
  "starting",
  "initializing",
  "bootstrapping",
  "running",
  "inprogress",
  "processing",
  "executing",
  "finishing",
  "completing",
  "completed",
  "succeeded",
  "success",
  "done",
  "finished",
  "failed",
  "failure",
  "errored",
  "error",
  "cancelled",
  "canceled",
  "abort",
  "aborted",
  "interrupted",
]);

export function normalizeComfyUiExecutionState(
  input: ComfyUiExecutionStateNormalizationInput,
): ImageManipulationExecutionStateSnapshot {
  const updatedAt = toIsoString(input.progress?.updatedAt)
    ?? toIsoString(input.backendSnapshot?.checkedAt)
    ?? new Date().toISOString();

  const rawBackendState = normalizeOptional(input.backendSnapshot?.state);
  const rawStatusMessage = normalizeOptional(input.backendSnapshot?.statusMessage);
  const rawState = rawBackendState ?? rawStatusMessage;
  const normalizedPercent = normalizeImageManipulationProgressPercent(input.progress?.percent);
  const queuePosition = normalizeQueuePosition(input.backendSnapshot?.queuePosition);
  const quality = classifyStateQuality({
    state: rawBackendState,
    statusMessage: rawStatusMessage,
  });
  const state = normalizeImageManipulationBackendJobState({
    rawState,
    completed: Boolean(input.backendSnapshot?.completed) || normalizeToken(input.backendSnapshot?.state) === "completed",
    failed: normalizeToken(input.backendSnapshot?.state) === "failed",
    cancelled: normalizeToken(input.backendSnapshot?.state) === "cancelled",
    queuePosition,
    progressPercent: normalizedPercent,
  });

  const warnings = buildWarnings({
    quality,
    updatedAt,
    rawState: rawStatusMessage ?? rawState,
    backendStatusCode: input.backendStatusCode,
    backendDetails: input.backendDetails,
  });

  const userMessage = buildUserMessage({
    state,
    queuePosition,
    percent: normalizedPercent,
    stageLabel: input.progress?.stageLabel,
    quality,
  });

  const progress = buildProgress({
    state,
    updatedAt,
    queuePosition,
    percent: normalizedPercent,
    stageCode: input.progress?.stageCode,
    stageLabel: input.progress?.stageLabel,
    message: userMessage,
    partialOutputCount: input.progress?.partialOutputCount,
  });

  const completion = state === ImageManipulationExecutionStates.completed
    ? Object.freeze({
      completedAt: input.finishedAt ?? updatedAt,
      outputCount: Math.max(0, Math.floor(input.outputCount ?? 0)),
      partialOutputCount: clampNonNegativeInteger(input.progress?.partialOutputCount),
      hadPartialOutputs: (input.progress?.partialOutputCount ?? 0) > 0,
      warningsCount: warnings.length,
      summary: "Execution completed.",
    })
    : undefined;

  const failure = state === ImageManipulationExecutionStates.failed || state === ImageManipulationExecutionStates.cancelled
    ? buildFailure({
      state,
      failedAt: input.finishedAt ?? updatedAt,
      statusCode: input.backendStatusCode,
      rawMessage: input.backendSnapshot?.statusMessage,
      progressPercent: normalizedPercent,
      partialOutputCount: clampNonNegativeInteger(input.progress?.partialOutputCount) ?? 0,
      backendDetails: input.backendDetails,
    })
    : undefined;

  const backendDiagnostics: ImageManipulationBackendDiagnostics = Object.freeze({
    backendFamily: input.backendFamily?.trim() || defaultBackendFamily,
    backendJobId: normalizeOptional(input.backendExecutionId),
    rawState: normalizeOptional(rawState),
    rawStatusCode: normalizeOptional(input.backendStatusCode),
    rawMessage: normalizeOptional(input.backendSnapshot?.statusMessage),
    details: Object.freeze({
      interpretation: quality,
      ...(input.backendDetails ?? {}),
    }),
  });

  const normalizedJob: ImageManipulationBackendJobSnapshot = Object.freeze({
    executionJobId: input.executionJobId,
    runId: input.runId,
    workspaceId: input.workspaceId,
    state,
    updatedAt,
    progress,
    warnings,
    completion,
    failure,
    backendDiagnostics,
  });

  return Object.freeze({
    executionJobId: input.executionJobId,
    runId: input.runId,
    workspaceId: input.workspaceId,
    state,
    backendFamily: backendDiagnostics.backendFamily,
    backendExecutionId: normalizeOptional(input.backendExecutionId),
    startedAt: normalizeOptional(input.startedAt),
    updatedAt,
    finishedAt: normalizeOptional(input.finishedAt) ?? completion?.completedAt ?? failure?.failedAt,
    progressPercent: progress?.percent,
    stage: progress?.stageCode,
    message: progress?.message,
    progress,
    warnings,
    completion,
    terminalState: state === ImageManipulationExecutionStates.completed
      || state === ImageManipulationExecutionStates.failed
      || state === ImageManipulationExecutionStates.cancelled
      ? state
      : undefined,
    error: failure
      ? Object.freeze({
        code: failure.code,
        category: failure.category,
        message: failure.summary,
        userMessage: failure.userMessage,
        retryable: failure.retryable,
        summary: failure.summary,
        stageCode: failure.stageCode,
        partialProgressObserved: failure.partialProgressObserved,
        partialOutputCount: failure.partialOutputCount,
        diagnostics: failure.diagnostics,
      })
      : undefined,
    backendDiagnostics,
    normalizedJob,
  });
}

function buildProgress(input: {
  readonly state: ImageManipulationExecutionStateSnapshot["state"];
  readonly updatedAt: string;
  readonly queuePosition: number | undefined;
  readonly percent: number | undefined;
  readonly stageCode?: string;
  readonly stageLabel?: string;
  readonly message: string;
  readonly partialOutputCount?: number;
}): ImageManipulationExecutionProgressSnapshot | undefined {
  if (
    input.state === ImageManipulationExecutionStates.completed
    || input.state === ImageManipulationExecutionStates.failed
    || input.state === ImageManipulationExecutionStates.cancelled
  ) {
    return undefined;
  }

  const defaultPercent = input.state === ImageManipulationExecutionStates.queued
    ? 0
    : input.state === ImageManipulationExecutionStates.preparing
      ? 3
      : 15;

  return Object.freeze({
    state: input.state,
    updatedAt: input.updatedAt,
    percent: input.percent ?? defaultPercent,
    stageCode: normalizeOptional(input.stageCode),
    stageLabel: normalizeOptional(input.stageLabel),
    message: input.message,
    queuePosition: input.queuePosition,
    partialOutputCount: clampNonNegativeInteger(input.partialOutputCount),
  });
}

function buildFailure(input: {
  readonly state: ImageManipulationExecutionStateSnapshot["state"];
  readonly failedAt: string;
  readonly statusCode?: string;
  readonly rawMessage?: string;
  readonly progressPercent?: number;
  readonly partialOutputCount: number;
  readonly backendDetails?: Readonly<Record<string, unknown>>;
}): ImageManipulationExecutionFailure {
  if (input.state === ImageManipulationExecutionStates.cancelled) {
    return Object.freeze({
      code: "execution-cancelled",
      category: ImageManipulationExecutionErrorCategories.cancellation,
      summary: "Execution was cancelled.",
      userMessage: "The run was cancelled before it finished.",
      retryable: false,
      failedAt: input.failedAt,
      stageCode: "cancelled",
      partialProgressObserved: Boolean(input.progressPercent && input.progressPercent > 0),
      partialOutputCount: input.partialOutputCount,
      diagnostics: buildFailureDiagnostics(input.statusCode, input.rawMessage, input.backendDetails),
    });
  }

  const category = classifyFailureCategory(input.statusCode, input.rawMessage);
  const retryable = category === ImageManipulationExecutionErrorCategories.timeout
    || category === ImageManipulationExecutionErrorCategories.connectivity
    || category === ImageManipulationExecutionErrorCategories.capacity;

  return Object.freeze({
    code: toFailureCode(category),
    category,
    summary: "Execution failed.",
    userMessage: retryable
      ? "The run stopped before finishing. Try again."
      : "The run stopped before finishing.",
    retryable,
    failedAt: input.failedAt,
    stageCode: "execution",
    partialProgressObserved: Boolean(input.progressPercent && input.progressPercent > 0),
    partialOutputCount: input.partialOutputCount,
    diagnostics: buildFailureDiagnostics(input.statusCode, input.rawMessage, input.backendDetails),
  });
}

function buildFailureDiagnostics(
  statusCode: string | undefined,
  rawMessage: string | undefined,
  backendDetails: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    backendStatusCode: normalizeOptional(statusCode),
    rawMessage: normalizeOptional(rawMessage),
    ...(backendDetails ?? {}),
  });
}

function buildWarnings(input: {
  readonly quality: "ok" | "degraded" | "unknown";
  readonly updatedAt: string;
  readonly rawState: string | undefined;
  readonly backendStatusCode?: string;
  readonly backendDetails?: Readonly<Record<string, unknown>>;
}): ReadonlyArray<ImageManipulationExecutionWarning> {
  if (input.quality === "ok") {
    return Object.freeze([]);
  }

  if (input.quality === "degraded") {
    return Object.freeze([
      Object.freeze({
        code: "backend-state-degraded",
        severity: "warning",
        summary: "Execution status is degraded but still updating.",
        userMessage: "Progress information may be delayed.",
        occurredAt: input.updatedAt,
        diagnostics: Object.freeze({
          rawState: normalizeOptional(input.rawState),
          backendStatusCode: normalizeOptional(input.backendStatusCode),
          ...(input.backendDetails ?? {}),
        }),
      }),
    ]);
  }

  return Object.freeze([
    Object.freeze({
      code: "backend-state-unknown",
      severity: "warning",
      summary: "Execution status could not be interpreted exactly.",
      userMessage: "Preparing execution while backend status is synchronized.",
      occurredAt: input.updatedAt,
      diagnostics: Object.freeze({
        rawState: normalizeOptional(input.rawState),
        backendStatusCode: normalizeOptional(input.backendStatusCode),
        ...(input.backendDetails ?? {}),
      }),
    }),
  ]);
}

function buildUserMessage(input: {
  readonly state: ImageManipulationExecutionStateSnapshot["state"];
  readonly queuePosition: number | undefined;
  readonly percent: number | undefined;
  readonly stageLabel: string | undefined;
  readonly quality: "ok" | "degraded" | "unknown";
}): string {
  if (input.quality === "degraded") {
    return "Progress updates are delayed, but execution is still active.";
  }
  if (input.quality === "unknown") {
    return "Preparing execution while status information is synchronized.";
  }

  if (input.state === ImageManipulationExecutionStates.queued) {
    if (typeof input.queuePosition === "number" && input.queuePosition >= 0) {
      return `Waiting in queue (position ${input.queuePosition + 1}).`;
    }
    return "Waiting in queue.";
  }
  if (input.state === ImageManipulationExecutionStates.preparing) {
    return "Preparing execution.";
  }
  if (input.state === ImageManipulationExecutionStates.running) {
    if (input.stageLabel && typeof input.percent === "number") {
      return `${input.stageLabel} (${input.percent}%).`;
    }
    if (typeof input.percent === "number") {
      return `Execution in progress (${input.percent}%).`;
    }
    return "Execution in progress.";
  }
  if (input.state === ImageManipulationExecutionStates.completed) {
    return "Execution completed.";
  }
  if (input.state === ImageManipulationExecutionStates.cancelled) {
    return "Execution cancelled.";
  }
  return "Execution failed.";
}

function classifyFailureCategory(
  statusCode: string | undefined,
  rawMessage: string | undefined,
): ImageManipulationExecutionFailure["category"] {
  const normalized = `${statusCode ?? ""} ${rawMessage ?? ""}`.toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return ImageManipulationExecutionErrorCategories.timeout;
  }
  if (
    normalized.includes("network")
    || normalized.includes("econn")
    || normalized.includes("connection")
    || normalized.includes("unreachable")
  ) {
    return ImageManipulationExecutionErrorCategories.connectivity;
  }
  if (normalized.includes("capacity") || normalized.includes("queue full") || normalized.includes("overload")) {
    return ImageManipulationExecutionErrorCategories.capacity;
  }
  if (normalized.includes("validation") || normalized.includes("invalid")) {
    return ImageManipulationExecutionErrorCategories.validation;
  }
  return ImageManipulationExecutionErrorCategories.execution;
}

function toFailureCode(category: ImageManipulationExecutionFailure["category"]): string {
  if (category === ImageManipulationExecutionErrorCategories.timeout) {
    return "execution-timeout";
  }
  if (category === ImageManipulationExecutionErrorCategories.connectivity) {
    return "execution-connectivity-failed";
  }
  if (category === ImageManipulationExecutionErrorCategories.capacity) {
    return "execution-capacity-exhausted";
  }
  if (category === ImageManipulationExecutionErrorCategories.validation) {
    return "execution-invalid-request";
  }
  return "execution-failed";
}

function classifyStateQuality(input: {
  readonly state: string | undefined;
  readonly statusMessage: string | undefined;
}): "ok" | "degraded" | "unknown" {
  const statusMessageToken = normalizeToken(input.statusMessage);
  if (statusMessageToken && degradedStateTokens.has(statusMessageToken)) {
    return "degraded";
  }

  const token = normalizeToken(input.state ?? input.statusMessage);
  if (!token) {
    return "unknown";
  }
  if (!knownStateTokens.has(token)) {
    return "unknown";
  }
  return "ok";
}

function normalizeToken(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return normalized.replace(/[\s_-]+/g, "");
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeQueuePosition(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function clampNonNegativeInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  if (value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function toIsoString(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}
