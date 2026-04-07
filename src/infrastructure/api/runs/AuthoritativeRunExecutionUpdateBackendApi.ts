import type {
  SharedApiResponseEnvelope,
} from "@shared/contracts/api/SharedApiContractPrimitives";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  RunLifecycleUpdateRequest,
  RunMutationResponse,
  RunStatusEnvelope,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  IngestRunExecutionUpdateUseCase,
  RunExecutionUpdateConflictError,
  RunExecutionUpdateForbiddenError,
  RunExecutionUpdateNotFoundError,
  RunExecutionUpdateValidationError,
} from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import type { RuntimeRealtimeRunStatusPayload } from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import {
  buildQueueMovementPayload,
  buildRunStatusPayload,
  publishRunOrchestrationRealtimeEventsBestEffort,
  type RunOrchestrationRealtimePublisher,
} from "./RunOrchestrationRealtimePublisher";
import { RunOrchestrationObservability } from "./RunOrchestrationObservability";

export interface AuthoritativeRunExecutionUpdateRequest {
  readonly runId: string;
  readonly senderNodeId: string;
  readonly update: RunLifecycleUpdateRequest;
}

export interface AuthoritativeRunExecutionUpdateResponse {
  readonly mutation: RunMutationResponse;
  readonly status: RunStatusEnvelope;
}

export interface AuthoritativeRunExecutionUpdateBackendApiDependencies {
  readonly ingestRunExecutionUpdateUseCase: IngestRunExecutionUpdateUseCase;
  readonly realtimePublisher?: RunOrchestrationRealtimePublisher;
  readonly observability?: RunOrchestrationObservability;
}

export class AuthoritativeRunExecutionUpdateBackendApi {
  public constructor(private readonly dependencies: AuthoritativeRunExecutionUpdateBackendApiDependencies) {}

  public async ingestExecutionUpdate(
    request: AuthoritativeRunExecutionUpdateRequest,
  ): Promise<SharedApiResponseEnvelope<AuthoritativeRunExecutionUpdateResponse>> {
    try {
      const ingested = await this.dependencies.ingestRunExecutionUpdateUseCase.execute({
        runId: request.runId,
        senderNodeId: request.senderNodeId,
        update: request.update,
      });
      await publishRunOrchestrationRealtimeEventsBestEffort(async () => {
        this.dependencies.realtimePublisher?.publishRunStatus({
          actorUserIdentityId: request.senderNodeId,
          workspaceId: ingested.mutation.run.workspaceId,
          payload: buildRunStatusPayload({
            run: ingested.mutation.run,
            eventKind: resolveRunStatusEventKind(ingested.mutation.run.state, Boolean(request.update.progress)),
            changedAt: ingested.mutation.mutation.occurredAt,
          }),
        });
        this.dependencies.realtimePublisher?.publishQueueMovement({
          actorUserIdentityId: request.senderNodeId,
          workspaceId: ingested.mutation.run.workspaceId,
          payload: buildQueueMovementPayload({
            run: ingested.mutation.run,
            eventKind: "queue-updated",
            changedAt: ingested.mutation.mutation.occurredAt,
          }),
        });
      });
      const dispatchFailureMarker = ingested.mutation.run.execution.errorCode?.trim() === "dispatch-failed-to-start";
      await this.recordObservability({
        event: "run.orchestration.execution-update.completed",
        operation: "execution-update",
        outcome: "success",
        severity: "info",
        runId: ingested.mutation.run.runId,
        workspaceId: ingested.mutation.run.workspaceId,
        nodeId: request.senderNodeId,
        correlationId: ingested.mutation.run.submission.correlationId,
        lifecycleState: ingested.mutation.run.state,
        markers: Object.freeze([
          request.update.progress ? "progress-updated" : "state-updated",
          dispatchFailureMarker ? "dispatch-failure-marker" : "no-dispatch-failure-marker",
        ]),
        counters: Object.freeze({
          has_progress_update: request.update.progress ? 1 : 0,
          has_internal_diagnostics: request.update.internalDiagnostics ? 1 : 0,
        }),
        details: Object.freeze({
          mutationAction: ingested.mutation.action,
          executionOutcome: ingested.mutation.run.execution.outcome,
          executionErrorCode: ingested.mutation.run.execution.errorCode,
          update: Object.freeze({
            toState: request.update.toState,
            actorId: request.update.actorId,
            senderBackendKind: request.update.senderBackendKind,
            senderBackendRunId: request.update.senderBackendRunId,
            heartbeatAt: request.update.heartbeatAt,
            resultMetricsCount: request.update.result?.metrics
              ? Object.keys(request.update.result.metrics).length
              : 0,
            resultOutputCount: request.update.result?.outputs?.length ?? 0,
          }),
        }),
      });

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          mutation: ingested.mutation,
          status: ingested.status,
        }),
      });
    } catch (error) {
      await this.recordObservability({
        event: "run.orchestration.execution-update.completed",
        operation: "execution-update",
        outcome: "failure",
        severity: error instanceof RunExecutionUpdateValidationError
          || error instanceof RunExecutionUpdateNotFoundError
          || error instanceof RunExecutionUpdateForbiddenError
          || error instanceof RunExecutionUpdateConflictError
          ? "warn"
          : "error",
        runId: request.runId,
        nodeId: request.senderNodeId,
        correlationId: request.update.idempotencyKey,
        markers: Object.freeze([
          error instanceof RunExecutionUpdateValidationError
            ? "invalid-request"
            : error instanceof RunExecutionUpdateNotFoundError
              ? "not-found"
              : error instanceof RunExecutionUpdateForbiddenError
                ? "forbidden"
                : error instanceof RunExecutionUpdateConflictError
                  ? "conflict"
                  : "internal-error",
        ]),
        details: Object.freeze({
          error,
          update: Object.freeze({
            toState: request.update.toState,
            senderBackendKind: request.update.senderBackendKind,
            senderBackendRunId: request.update.senderBackendRunId,
            hasProgress: Boolean(request.update.progress),
          }),
        }),
      });
      return toExecutionUpdateErrorEnvelope(error);
    }
  }

  private async recordObservability(
    event: Parameters<RunOrchestrationObservability["record"]>[0],
  ): Promise<void> {
    if (!this.dependencies.observability) {
      return;
    }
    try {
      await this.dependencies.observability.record(event);
    } catch {
      // Observability failures are intentionally non-blocking.
    }
  }
}

function resolveRunStatusEventKind(
  state: string,
  hasProgressUpdate: boolean,
): RuntimeRealtimeRunStatusPayload["eventKind"] {
  if (hasProgressUpdate) {
    return "progress-updated";
  }
  switch (state) {
    case "assignment-pending":
    case "assigned":
    case "dispatching":
      return "assignment-updated";
    case "running":
      return "state-changed";
    case "cancelling":
      return "cancellation-requested";
    case "retry-pending":
      return "retry-queued";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "state-changed";
  }
}

function toExecutionUpdateErrorEnvelope(
  error: unknown,
): SharedApiResponseEnvelope<never> {
  if (error instanceof RunExecutionUpdateValidationError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.invalidRequest,
        message: error.message,
      }),
    });
  }
  if (error instanceof RunExecutionUpdateNotFoundError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.notFound,
        message: error.message,
      }),
    });
  }
  if (error instanceof RunExecutionUpdateForbiddenError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.forbidden,
        message: error.message,
      }),
    });
  }
  if (error instanceof RunExecutionUpdateConflictError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.conflict,
        message: error.message,
      }),
    });
  }

  const message = error instanceof Error ? error.message : "Run execution update failed.";
  if (message.includes("cannot transition")) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.conflict,
        message,
      }),
    });
  }
  if (
    message.includes("requires")
    || message.includes("must be")
    || message.includes("cannot be")
  ) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.invalidRequest,
        message,
      }),
    });
  }

  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: SharedApiErrorCodes.internal,
      message: "Run execution update failed due to an internal server error.",
    }),
  });
}
