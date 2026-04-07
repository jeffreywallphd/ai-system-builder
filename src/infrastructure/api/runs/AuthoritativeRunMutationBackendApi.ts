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
  RunCancellationRequest,
  RunMutationResponse,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationNotFoundError,
  RunCancellationValidationError,
} from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";

const AuthoritativeRunResourceType = "authoritative-run";

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

export interface AuthoritativeRunMutationBackendApiDependencies {
  readonly requestAuthoritativeRunCancellationUseCase: RequestAuthoritativeRunCancellationUseCase;
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

    const allowed = await this.isRunCancelAllowed({
      actorUserIdentityId,
      activeWorkspaceId: request.authorization.activeWorkspaceId,
      authenticatedAt: request.authorization.authenticatedAt,
      runId,
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

  private async isRunCancelAllowed(input: {
    readonly actorUserIdentityId: string;
    readonly activeWorkspaceId: string;
    readonly authenticatedAt?: string;
    readonly runId: string;
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
      requiredPermissionKey: "run.cancel",
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
