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

      return Object.freeze({
        ok: true,
        data: cancelled.mutation,
      });
    } catch (error) {
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

      return Object.freeze({
        ok: true,
        data: retried.mutation,
      });
    } catch (error) {
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
}
