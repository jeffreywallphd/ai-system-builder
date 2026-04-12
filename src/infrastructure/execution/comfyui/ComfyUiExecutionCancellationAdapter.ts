import {
  ImageManipulationExecutionCancellationStatuses,
  ImageManipulationFailureNormalizationSources,
  normalizeImageManipulationExecutionFailure,
  type IImageManipulationExecutionCancellationPort,
} from "@application/image-workflows/ports";
import {
  ComfyUiTransportCancellationStatuses,
  ComfyUiTransportClientError,
  type ComfyUiPromptCancellationResult,
} from "./ComfyUiTransportClient";
import {
  ComfyUiTemporaryReferenceCleanupStatuses,
  type ComfyUiTemporaryReferenceCleanupResult,
} from "./ComfyUiOutputDiscoveryCollector";
import { ComfyUiExecutionObservability } from "./ComfyUiExecutionObservability";

interface ComfyUiExecutionCancellationTransportClient {
  requestPromptCancellation(input: {
    readonly promptId: string;
  }): Promise<ComfyUiPromptCancellationResult>;
}

interface ComfyUiExecutionCancellationCleanupPort {
  releaseTemporaryReferences(input: {
    readonly executionJobId: string;
    readonly backendExecutionId?: string;
    readonly requestedAt?: string;
    readonly reason?: string;
  }): Promise<ComfyUiTemporaryReferenceCleanupResult>;
}

export interface ComfyUiExecutionCancellationAdapterDependencies {
  readonly transportClient: ComfyUiExecutionCancellationTransportClient;
  readonly resolveBackendExecutionId?: (input: {
    readonly executionJobId: string;
    readonly runId: string;
    readonly workspaceId: string;
  }) => Promise<string | undefined> | string | undefined;
  readonly cleanupPort?: ComfyUiExecutionCancellationCleanupPort;
  readonly supportsCancellation?: boolean;
  readonly now?: () => Date;
  readonly observability?: ComfyUiExecutionObservability;
}

export class ComfyUiExecutionCancellationAdapter implements IImageManipulationExecutionCancellationPort {
  private readonly now: () => Date;
  private readonly supportsCancellation: boolean;
  private readonly observability?: ComfyUiExecutionObservability;

  public constructor(private readonly dependencies: ComfyUiExecutionCancellationAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.supportsCancellation = dependencies.supportsCancellation ?? true;
    this.observability = dependencies.observability;
  }

  public async requestExecutionCancellation(input: {
    readonly executionJobId: string;
    readonly runId: string;
    readonly workspaceId: string;
    readonly requestedAt: string;
    readonly requestedByActorId?: string;
    readonly reason?: string;
  }): Promise<{
    readonly status: "accepted" | "already-terminal" | "not-supported" | "rejected" | "not-found" | "failed";
    readonly acknowledgedAt?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }> {
    const acknowledgedAt = this.resolveTimestamp(input.requestedAt);
    const executionJobId = input.executionJobId.trim();
    const requestedReason = normalizeOptional(input.reason);
    this.observability?.record({
      event: "cancellation.requested",
      severity: "info",
      runId: input.runId,
      executionJobId,
      workspaceId: input.workspaceId,
      correlationId: normalizeOptional(input.requestedByActorId),
      occurredAt: acknowledgedAt,
      details: Object.freeze({
        supportsCancellation: this.supportsCancellation,
        hasReason: Boolean(requestedReason),
      }),
    });

    if (!this.supportsCancellation) {
      const cleanup = await this.tryCleanup({
        executionJobId,
        requestedAt: acknowledgedAt,
        reason: "cancellation-not-supported",
      });
      return this.buildResult({
        status: ImageManipulationExecutionCancellationStatuses.notSupported,
        acknowledgedAt,
        message: "ComfyUI cancellation is unavailable in this runtime profile.",
        backendExecutionId: undefined,
        cleanup,
      });
    }

    const backendExecutionId = await this.resolveBackendExecutionId({
      executionJobId,
      runId: input.runId,
      workspaceId: input.workspaceId,
    });
    if (!backendExecutionId) {
      const cleanup = await this.tryCleanup({
        executionJobId,
        requestedAt: acknowledgedAt,
        reason: "backend-execution-id-not-found",
      });
      return this.buildResult({
        status: ImageManipulationExecutionCancellationStatuses.notFound,
        acknowledgedAt,
        message: "Execution cancellation target could not be resolved.",
        backendExecutionId,
        cleanup,
      });
    }

    let cleanup: ComfyUiTemporaryReferenceCleanupResult | undefined;
    try {
      const cancellation = await this.dependencies.transportClient.requestPromptCancellation({
        promptId: backendExecutionId,
      });
      const status = mapCancellationStatus(cancellation.status);

      cleanup = await this.tryCleanup({
        executionJobId,
        backendExecutionId,
        requestedAt: acknowledgedAt,
        reason: requestedReason ?? status,
      });

      return this.buildResult({
        status,
        acknowledgedAt: cancellation.acknowledgedAt,
        backendExecutionId,
        message: buildOutcomeMessage(status),
        cleanup,
      });
    } catch (error) {
      const mapped = mapCancellationError({
        error,
        failedAt: acknowledgedAt,
      });
      cleanup = await this.tryCleanup({
        executionJobId,
        backendExecutionId,
        requestedAt: acknowledgedAt,
        reason: `${mapped.status}:${mapped.failure.code}`,
      });
      return this.buildResult({
        status: mapped.status,
        acknowledgedAt,
        backendExecutionId,
        message: mapped.message,
        cleanup,
        failure: mapped.failure,
      });
    }
  }

  private async resolveBackendExecutionId(input: {
    readonly executionJobId: string;
    readonly runId: string;
    readonly workspaceId: string;
  }): Promise<string | undefined> {
    const resolved = this.dependencies.resolveBackendExecutionId
      ? await this.dependencies.resolveBackendExecutionId(input)
      : input.executionJobId;
    return normalizeOptional(resolved);
  }

  private async tryCleanup(input: {
    readonly executionJobId: string;
    readonly backendExecutionId?: string;
    readonly requestedAt: string;
    readonly reason: string;
  }): Promise<ComfyUiTemporaryReferenceCleanupResult | undefined> {
    if (!this.dependencies.cleanupPort) {
      return undefined;
    }
    try {
      return await this.dependencies.cleanupPort.releaseTemporaryReferences({
        executionJobId: input.executionJobId,
        backendExecutionId: input.backendExecutionId,
        requestedAt: input.requestedAt,
        reason: input.reason,
      });
    } catch (error) {
      return Object.freeze({
        status: ComfyUiTemporaryReferenceCleanupStatuses.degraded,
        releasedReferenceCount: 0,
        acknowledgedAt: input.requestedAt,
        message: "Cleanup of adapter-managed temporary references did not complete.",
        details: Object.freeze({
          guarantee: "best-effort-adapter-local-state-only",
          reason: input.reason,
          error: sanitizeError(error),
        }),
      });
    }
  }

  private buildResult(input: {
    readonly status: "accepted" | "already-terminal" | "not-supported" | "rejected" | "not-found" | "failed";
    readonly acknowledgedAt: string;
    readonly message: string;
    readonly backendExecutionId?: string;
    readonly cleanup?: ComfyUiTemporaryReferenceCleanupResult;
    readonly failure?: ReturnType<typeof normalizeImageManipulationExecutionFailure>;
  }): {
    readonly status: "accepted" | "already-terminal" | "not-supported" | "rejected" | "not-found" | "failed";
    readonly acknowledgedAt?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  } {
    const details: Record<string, unknown> = {
      backendExecutionId: normalizeOptional(input.backendExecutionId),
      cancellationGuarantee: "best-effort-comfyui-interrupt",
      cleanupGuarantee: "best-effort-adapter-local-state-only",
    };
    if (input.cleanup) {
      details.cleanup = input.cleanup;
    }
    if (input.failure) {
      details.failure = input.failure;
    }
    const result = Object.freeze({
      status: input.status,
      acknowledgedAt: input.acknowledgedAt,
      message: input.message,
      details: Object.freeze(details),
    });
    this.observability?.record({
      event: "cancellation.completed",
      severity: input.status === "failed" || input.status === "rejected" ? "warn" : "info",
      backendExecutionId: normalizeOptional(input.backendExecutionId),
      occurredAt: input.acknowledgedAt,
      details: Object.freeze({
        status: input.status,
        cleanupStatus: input.cleanup?.status,
        failureCode: input.failure?.code,
        failureCategory: input.failure?.category,
      }),
    });
    return result;
  }

  private resolveTimestamp(candidate: string | undefined): string {
    const normalized = normalizeOptional(candidate);
    if (!normalized) {
      return this.now().toISOString();
    }
    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) {
      return this.now().toISOString();
    }
    return new Date(parsed).toISOString();
  }
}

function mapCancellationStatus(status: ComfyUiPromptCancellationResult["status"]): "accepted" | "already-terminal" {
  if (status === ComfyUiTransportCancellationStatuses.accepted) {
    return ImageManipulationExecutionCancellationStatuses.accepted;
  }
  return ImageManipulationExecutionCancellationStatuses.alreadyTerminal;
}

function mapCancellationError(input: {
  readonly error: unknown;
  readonly failedAt: string;
}): {
  readonly status: "not-supported" | "rejected" | "not-found" | "failed";
  readonly message: string;
  readonly failure: ReturnType<typeof normalizeImageManipulationExecutionFailure>;
} {
  if (input.error instanceof ComfyUiTransportClientError) {
    const statusCode = input.error.diagnostics.statusCode;
    if (statusCode === 404) {
      return Object.freeze({
        status: ImageManipulationExecutionCancellationStatuses.notFound,
        message: "Backend execution could not be found for cancellation.",
        failure: normalizeCancellationFailure(input.error, input.failedAt),
      });
    }
    if (statusCode === 405 || statusCode === 501) {
      return Object.freeze({
        status: ImageManipulationExecutionCancellationStatuses.notSupported,
        message: "ComfyUI backend does not support prompt cancellation controls.",
        failure: normalizeCancellationFailure(input.error, input.failedAt),
      });
    }
    if (input.error.code === "invalid-request" || input.error.code === "prompt-rejected") {
      return Object.freeze({
        status: ImageManipulationExecutionCancellationStatuses.rejected,
        message: "Cancellation request was rejected by backend validation.",
        failure: normalizeCancellationFailure(input.error, input.failedAt),
      });
    }
    return Object.freeze({
      status: ImageManipulationExecutionCancellationStatuses.failed,
      message: "Cancellation request failed before backend acknowledgement.",
      failure: normalizeCancellationFailure(input.error, input.failedAt),
    });
  }

  return Object.freeze({
    status: ImageManipulationExecutionCancellationStatuses.failed,
    message: "Cancellation request failed unexpectedly.",
    failure: normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.progressPolling,
      failedAt: input.failedAt,
      backendErrorCode: "cancellation-error",
      rawMessage: input.error instanceof Error ? input.error.message : String(input.error),
      diagnostics: sanitizeError(input.error),
      stageCode: "cancelled",
      state: "failed",
      partialProgressObserved: false,
      partialOutputCount: 0,
    }),
  });
}

function normalizeCancellationFailure(
  error: ComfyUiTransportClientError,
  failedAt: string,
): ReturnType<typeof normalizeImageManipulationExecutionFailure> {
  return normalizeImageManipulationExecutionFailure({
    source: ImageManipulationFailureNormalizationSources.progressPolling,
    failedAt,
    backendStatusCode: error.diagnostics.statusCode !== undefined
      ? String(error.diagnostics.statusCode)
      : undefined,
    backendErrorCode: error.code,
    rawMessage: error.message,
    diagnostics: error.diagnostics.details,
    stageCode: "cancelled",
    state: "failed",
    partialProgressObserved: false,
    partialOutputCount: 0,
  });
}

function buildOutcomeMessage(
  status: "accepted" | "already-terminal",
): string {
  if (status === ImageManipulationExecutionCancellationStatuses.accepted) {
    return "Cancellation request acknowledged by ComfyUI backend.";
  }
  return "Execution is already terminal; no additional cancellation signal was required.";
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function sanitizeError(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    return Object.freeze({
      name: error.name,
      message: error.message,
    });
  }
  return Object.freeze({
    value: String(error),
  });
}
