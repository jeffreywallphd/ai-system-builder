import type {
  SharedApiResponseEnvelope,
} from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  SharedApiErrorCodes,
} from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  AuthorizationPolicyEvaluationTargetKinds,
  type IAuthorizationPolicyDecisionEvaluator,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { deriveAuthorizationResponseAccessLevel } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import { AuthorizationResponseAccessLevels } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  RunDetail,
  RunSummary,
  RunListReadResponse,
  RunStatusEnvelope,
  RunSubmissionSource,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { toRunStatusEnvelope, type RunLifecycleState } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import type { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { mapPlatformRunRecordToCanonicalRun } from "@application/runs/use-cases/RunCreationPersistenceMapper";

const AuthoritativeRunResourceType = "authoritative-run";

export interface AuthoritativeRunQueryAuthorizationContext {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId: string;
  readonly authenticatedAt?: string;
}

export interface AuthoritativeRunListRequest {
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
  readonly states?: ReadonlyArray<RunLifecycleState>;
  readonly sources?: ReadonlyArray<RunSubmissionSource>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: "submittedAt" | "updatedAt" | "state";
  readonly sortDirection?: "asc" | "desc";
}

export interface AuthoritativeRunDetailRequest {
  readonly runId: string;
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
}

export interface AuthoritativeRunStatusRequest extends AuthoritativeRunDetailRequest {}

export interface AuthoritativeRunQueryBackendApiDependencies {
  readonly listAuthoritativeRunsUseCase: ListAuthoritativeRunsUseCase;
  readonly getAuthoritativeRunUseCase: GetAuthoritativeRunUseCase;
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly now?: () => Date;
}

export class AuthoritativeRunQueryBackendApi {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: AuthoritativeRunQueryBackendApiDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async listRuns(
    request: AuthoritativeRunListRequest,
  ): Promise<SharedApiResponseEnvelope<RunListReadResponse>> {
    const workspaceId = request.workspaceId.trim();
    if (!workspaceId) {
      return this.invalidRequest("workspaceId is required.");
    }

    const actorUserIdentityId = request.authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.forbidden("Run visibility requires an authenticated actor.");
    }

    const all = await this.dependencies.listAuthoritativeRunsUseCase.execute({
      workspaceId,
      states: request.states,
      sources: request.sources,
      search: request.search,
      sortBy: request.sortBy,
      sortDirection: request.sortDirection,
    });

    const visible: RunSummary[] = [];
    for (const run of all.items) {
      if (await this.isRunReadAllowed({
        authorization: request.authorization,
        runId: run.runId,
      })) {
        visible.push(run);
      }
    }

    const offset = Math.max(0, request.offset ?? 0);
    const limit = Math.max(1, request.limit ?? 50);
    const paged = visible.slice(offset, offset + limit);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        items: Object.freeze(paged),
        totalCount: visible.length,
      }),
    });
  }

  public async getRunDetail(
    request: AuthoritativeRunDetailRequest,
  ): Promise<SharedApiResponseEnvelope<RunDetail>> {
    const workspaceId = request.workspaceId.trim();
    const runId = request.runId.trim();
    if (!workspaceId || !runId) {
      return this.invalidRequest("workspaceId and runId are required.");
    }

    const detail = await this.dependencies.getAuthoritativeRunUseCase.execute({
      runId,
      workspaceId,
    });
    if (!detail) {
      return this.notFound(`Run '${runId}' was not found.`);
    }

    if (!await this.isRunReadAllowed({
      authorization: request.authorization,
      runId,
    })) {
      return this.notFound(`Run '${runId}' was not found.`);
    }

    return Object.freeze({
      ok: true,
      data: detail,
    });
  }

  public async getRunStatus(
    request: AuthoritativeRunStatusRequest,
  ): Promise<SharedApiResponseEnvelope<RunStatusEnvelope>> {
    const workspaceId = request.workspaceId.trim();
    const runId = request.runId.trim();
    if (!workspaceId || !runId) {
      return this.invalidRequest("workspaceId and runId are required.");
    }

    const record = await this.dependencies.runRepository.findRunById(runId);
    if (!record || record.workspaceId !== workspaceId) {
      return this.notFound(`Run '${runId}' was not found.`);
    }

    if (!await this.isRunReadAllowed({
      authorization: request.authorization,
      runId,
    })) {
      return this.notFound(`Run '${runId}' was not found.`);
    }

    return Object.freeze({
      ok: true,
      data: toRunStatusEnvelope(mapPlatformRunRecordToCanonicalRun(record)),
    });
  }

  private async isRunReadAllowed(input: {
    readonly authorization: AuthoritativeRunQueryAuthorizationContext;
    readonly runId: string;
  }): Promise<boolean> {
    if (!this.dependencies.authorizationDecisionEvaluator) {
      return true;
    }
    const actorUserIdentityId = input.authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return false;
    }
    const decision = await this.dependencies.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: input.authorization.activeWorkspaceId.trim() || undefined,
        authenticatedAt: input.authorization.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: "run.read",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: AuthoritativeRunResourceType,
          resourceId: input.runId.trim(),
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
