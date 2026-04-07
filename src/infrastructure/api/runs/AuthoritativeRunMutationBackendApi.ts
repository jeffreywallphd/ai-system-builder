import {
  AuthorizationPolicyEvaluationTargetKinds,
  type IAuthorizationPolicyDecisionEvaluator,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { deriveAuthorizationResponseAccessLevel } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import { AuthorizationResponseAccessLevels } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import type { SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  RunMutationResponse,
  RunRetryRequest,
  RunCancellationRequest,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationNotFoundError,
  RunCancellationValidationError,
} from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import {
  RequestAuthoritativeRunRetryUseCase,
  RunRetryIneligibleError,
  RunRetryNotFoundError,
  RunRetrySubmissionValidationError,
  RunRetryValidationError,
} from "@application/runs/use-cases/RequestAuthoritativeRunRetryUseCase";
import {
  buildQueueMovementPayload,
  buildRunStatusPayload,
  publishRunOrchestrationRealtimeEventsBestEffort,
  type RunOrchestrationRealtimePublisher,
} from "./RunOrchestrationRealtimePublisher";
import { RunOrchestrationObservability } from "./RunOrchestrationObservability";

const AuthoritativeRunResourceType = "authoritative-run";

type RunMutationPermission = "run.cancel" | "run.retry";

export interface AuthoritativeRunMutationAuthorizationContext {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId: string;
  readonly authenticatedAt?: string;
}

export interface AuthoritativeRunCancelRequest {
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunMutationAuthorizationContext;
  readonly cancellation: RunCancellationRequest;
}

export interface AuthoritativeRunRetryMutationRequest {
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunMutationAuthorizationContext;
  readonly retry: RunRetryRequest;
}

export interface AuthoritativeRunMutationBackendApiDependencies {
  readonly requestAuthoritativeRunCancellationUseCase: RequestAuthoritativeRunCancellationUseCase;
  readonly requestAuthoritativeRunRetryUseCase: RequestAuthoritativeRunRetryUseCase;
  readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly realtimePublisher?: RunOrchestrationRealtimePublisher;
  readonly observability?: RunOrchestrationObservability;
  readonly now?: () => Date;
}

export class AuthoritativeRunMutationBackendApi {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: AuthoritativeRunMutationBackendApiDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async cancelRun(
    request: AuthoritativeRunCancelRequest,
  ): Promise<SharedApiResponseEnvelope<RunMutationResponse>> {
    const workspaceId = request.workspaceId.trim();
    const actorUserIdentityId = request.authorization.actorUserIdentityId.trim();
    const runId = request.cancellation.runId.trim();
    if (!workspaceId || !actorUserIdentityId || !runId) {
      await this.recordObservability({
        event: "run.orchestration.mutation.cancel.completed",
        operation: "mutation.cancel",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
      return this.invalidRequest("workspaceId, actorUserIdentityId, and runId are required.");
    }

    const allowed = await this.isRunMutationAllowed({
      actorUserIdentityId,
      activeWorkspaceId: request.authorization.activeWorkspaceId,
      authenticatedAt: request.authorization.authenticatedAt,
      runId,
      requiredPermissionKey: "run.cancel",
    });
    if (!allowed) {
      await this.recordObservability({
        event: "run.orchestration.mutation.cancel.completed",
        operation: "mutation.cancel",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["authorization-denied"]),
      });
      return this.forbidden("Run cancellation is not authorized for this actor.");
    }

    try {
      const cancelled = await this.dependencies.requestAuthoritativeRunCancellationUseCase.execute({
        workspaceId,
        actorUserIdentityId,
        request: Object.freeze({
          ...request.cancellation,
          runId,
          requestedByActorId: request.cancellation.requestedByActorId?.trim() || actorUserIdentityId,
        }),
      });
      await publishRunOrchestrationRealtimeEventsBestEffort(async () => {
        this.dependencies.realtimePublisher?.publishRunStatus({
          actorUserIdentityId,
          workspaceId,
          payload: buildRunStatusPayload({
            run: cancelled.mutation.run,
            eventKind: cancelled.mutation.run.state === "cancelling"
              ? "cancellation-requested"
              : "cancelled",
            changedAt: cancelled.mutation.mutation.occurredAt,
          }),
        });
        this.dependencies.realtimePublisher?.publishQueueMovement({
          actorUserIdentityId,
          workspaceId,
          payload: buildQueueMovementPayload({
            run: cancelled.mutation.run,
            eventKind: "queue-updated",
            changedAt: cancelled.mutation.mutation.occurredAt,
          }),
        });
      });
      await this.recordObservability({
        event: "run.orchestration.mutation.cancel.completed",
        operation: "mutation.cancel",
        outcome: "success",
        severity: "info",
        runId: cancelled.mutation.run.runId,
        workspaceId,
        correlationId: cancelled.mutation.run.submission.correlationId,
        lifecycleState: cancelled.mutation.run.state,
        markers: Object.freeze([
          cancelled.outcome === "cancellation-requested" ? "cancellation-requested" : "cancelled",
          "queue-updated",
        ]),
      });

      return Object.freeze({
        ok: true,
        data: cancelled.mutation,
      });
    } catch (error) {
      await this.recordObservability({
        event: "run.orchestration.mutation.cancel.completed",
        operation: "mutation.cancel",
        outcome: "failure",
        severity: error instanceof RunCancellationValidationError || error instanceof RunCancellationNotFoundError
          ? "warn"
          : "error",
        runId,
        workspaceId,
        markers: Object.freeze([
          error instanceof RunCancellationValidationError
            ? "invalid-request"
            : error instanceof RunCancellationNotFoundError
              ? "not-found"
              : "internal-error",
        ]),
        details: Object.freeze({
          error,
        }),
      });
      if (error instanceof RunCancellationValidationError) {
        return this.invalidRequest(error.message);
      }
      if (error instanceof RunCancellationNotFoundError) {
        return this.notFound(error.message);
      }

      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.internal,
          message: "Run cancellation failed due to an internal server error.",
        }),
      });
    }
  }

  public async retryRun(
    request: AuthoritativeRunRetryMutationRequest,
  ): Promise<SharedApiResponseEnvelope<RunMutationResponse>> {
    const workspaceId = request.workspaceId.trim();
    const actorUserIdentityId = request.authorization.actorUserIdentityId.trim();
    const runId = request.retry.runId.trim();
    if (!workspaceId || !actorUserIdentityId || !runId) {
      await this.recordObservability({
        event: "run.orchestration.mutation.retry.completed",
        operation: "mutation.retry",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
      return this.invalidRequest("workspaceId, actorUserIdentityId, and runId are required.");
    }

    const allowed = await this.isRunMutationAllowed({
      actorUserIdentityId,
      activeWorkspaceId: request.authorization.activeWorkspaceId,
      authenticatedAt: request.authorization.authenticatedAt,
      runId,
      requiredPermissionKey: "run.retry",
    });
    if (!allowed) {
      await this.recordObservability({
        event: "run.orchestration.mutation.retry.completed",
        operation: "mutation.retry",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["authorization-denied"]),
      });
      return this.forbidden("Run retry is not authorized for this actor.");
    }

    try {
      const retried = await this.dependencies.requestAuthoritativeRunRetryUseCase.execute({
        workspaceId,
        actorUserIdentityId,
        request: Object.freeze({
          ...request.retry,
          runId,
          requestedByActorId: request.retry.requestedByActorId?.trim() || actorUserIdentityId,
        }),
      });
      await publishRunOrchestrationRealtimeEventsBestEffort(async () => {
        this.dependencies.realtimePublisher?.publishRunStatus({
          actorUserIdentityId,
          workspaceId,
          payload: buildRunStatusPayload({
            run: retried.mutation.run,
            eventKind: "retry-queued",
            changedAt: retried.mutation.mutation.occurredAt,
          }),
        });
        this.dependencies.realtimePublisher?.publishQueueMovement({
          actorUserIdentityId,
          workspaceId,
          payload: buildQueueMovementPayload({
            run: retried.mutation.run,
            eventKind: "queue-enqueued",
            changedAt: retried.mutation.mutation.occurredAt,
          }),
        });
      });
      await this.recordObservability({
        event: "run.orchestration.mutation.retry.completed",
        operation: "mutation.retry",
        outcome: "success",
        severity: "info",
        runId: retried.mutation.run.runId,
        workspaceId,
        correlationId: retried.mutation.run.submission.correlationId,
        lifecycleState: retried.mutation.run.state,
        markers: Object.freeze(["retry-queued", "queue-enqueued"]),
      });

      return Object.freeze({
        ok: true,
        data: retried.mutation,
      });
    } catch (error) {
      await this.recordObservability({
        event: "run.orchestration.mutation.retry.completed",
        operation: "mutation.retry",
        outcome: "failure",
        severity: error instanceof RunRetryValidationError
          || error instanceof RunRetrySubmissionValidationError
          || error instanceof RunRetryIneligibleError
          || error instanceof RunRetryNotFoundError
          ? "warn"
          : "error",
        runId,
        workspaceId,
        markers: Object.freeze([
          error instanceof RunRetryValidationError || error instanceof RunRetrySubmissionValidationError
            ? "invalid-request"
            : error instanceof RunRetryIneligibleError
              ? "retry-ineligible"
              : error instanceof RunRetryNotFoundError
                ? "not-found"
                : "internal-error",
        ]),
        details: Object.freeze({
          error,
        }),
      });
      if (error instanceof RunRetryValidationError) {
        return this.invalidRequest(error.message);
      }
      if (error instanceof RunRetrySubmissionValidationError) {
        return this.invalidRequest(error.message);
      }
      if (error instanceof RunRetryIneligibleError) {
        return this.invalidRequest(error.message);
      }
      if (error instanceof RunRetryNotFoundError) {
        return this.notFound(error.message);
      }

      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.internal,
          message: "Run retry failed due to an internal server error.",
        }),
      });
    }
  }

  private async isRunMutationAllowed(input: {
    readonly actorUserIdentityId: string;
    readonly activeWorkspaceId: string;
    readonly authenticatedAt?: string;
    readonly runId: string;
    readonly requiredPermissionKey: RunMutationPermission;
  }): Promise<boolean> {
    if (!this.dependencies.authorizationDecisionEvaluator) {
      return true;
    }

    const decision = await this.dependencies.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId: input.actorUserIdentityId,
        activeWorkspaceId: input.activeWorkspaceId.trim() || undefined,
        authenticatedAt: input.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: input.requiredPermissionKey,
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: AuthoritativeRunResourceType,
          resourceId: input.runId,
        }),
      }),
      asOf: this.now().toISOString(),
    });

    return deriveAuthorizationResponseAccessLevel(decision.decision) !== AuthorizationResponseAccessLevels.deny;
  }

  private invalidRequest(message: string): SharedApiResponseEnvelope<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.invalidRequest,
        message,
      }),
    });
  }

  private forbidden(message: string): SharedApiResponseEnvelope<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.forbidden,
        message,
      }),
    });
  }

  private notFound(message: string): SharedApiResponseEnvelope<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.notFound,
        message,
      }),
    });
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
