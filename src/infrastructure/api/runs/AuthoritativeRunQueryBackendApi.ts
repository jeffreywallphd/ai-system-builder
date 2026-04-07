import type { IPlatformAuditEventRepository } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  AuthorizationPolicyEvaluationTargetKinds,
  type IAuthorizationPolicyDecisionEvaluator,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { deriveAuthorizationResponseAccessLevel } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import { AuthorizationResponseAccessLevels } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import type { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import type { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import type { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import {
  buildOperationalRunStatusTimeline,
  mergeOperationalDetailProjection,
  mergeOperationalStatusProjection,
} from "@application/runs/use-cases/RunOperationalVisibilityProjection";
import {
  mapPlatformRunRecordToCanonicalRun,
  toRunStatusEnvelopeFromPlatformRecord,
} from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  RunDetail,
  RunListReadResponse,
  RunQueueStatusReadResponse,
  RunStatusEnvelope,
  RunSubmissionSource,
  RunSummary,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { RunLifecycleState } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  SharedApiErrorCodes,
  type SharedApiResponseEnvelope,
} from "@shared/contracts/api/SharedApiContractPrimitives";

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

export interface AuthoritativeRunQueueStatusRequest {
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
  readonly statuses?: ReadonlyArray<RunLifecycleState>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AuthoritativeRunDetailRequest {
  readonly runId: string;
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
}

export interface AuthoritativeRunStatusRequest extends AuthoritativeRunDetailRequest {}

export interface AuthoritativeRunQueryBackendApiDependencies {
  readonly listAuthoritativeRunsUseCase: ListAuthoritativeRunsUseCase;
  readonly listAuthoritativeRunQueueStatusUseCase: ListAuthoritativeRunQueueStatusUseCase;
  readonly getAuthoritativeRunUseCase: GetAuthoritativeRunUseCase;
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly auditEventRepository?: IPlatformAuditEventRepository;
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

  public async listQueueStatus(
    request: AuthoritativeRunQueueStatusRequest,
  ): Promise<SharedApiResponseEnvelope<RunQueueStatusReadResponse>> {
    const workspaceId = request.workspaceId.trim();
    if (!workspaceId) {
      return this.invalidRequest("workspaceId is required.");
    }

    const queue = await this.dependencies.listAuthoritativeRunQueueStatusUseCase.execute({
      workspaceId,
      statuses: request.statuses,
      limit: request.limit,
      offset: request.offset,
      asOf: this.now().toISOString(),
    });

    const visibleItems = [];
    for (const item of queue.items) {
      if (await this.isRunReadAllowed({
        authorization: request.authorization,
        runId: item.runId,
      })) {
        visibleItems.push(item);
      }
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        items: Object.freeze(visibleItems),
        totalCount: visibleItems.length,
        asOf: queue.asOf,
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

    const record = await this.dependencies.runRepository.findRunById(runId);
    if (!record) {
      return this.notFound(`Run '${runId}' was not found.`);
    }

    const timeline = await this.getRunStatusTimeline(runId, workspaceId, record);

    return Object.freeze({
      ok: true,
      data: mergeOperationalDetailProjection({
        detail,
        run: mapPlatformRunRecordToCanonicalRun(record),
        timeline,
      }),
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

    const status = toRunStatusEnvelopeFromPlatformRecord(record);
    const timeline = await this.getRunStatusTimeline(runId, workspaceId, record);
    return Object.freeze({
      ok: true,
      data: mergeOperationalStatusProjection({
        status,
        run: mapPlatformRunRecordToCanonicalRun(record),
        timeline,
      }),
    });
  }

  private async getRunStatusTimeline(
    runId: string,
    workspaceId: string,
    record: PlatformRunRecord,
  ) {
    const canonicalRun = mapPlatformRunRecordToCanonicalRun(record);
    if (!this.dependencies.auditEventRepository) {
      return buildOperationalRunStatusTimeline({
        run: canonicalRun,
        auditEvents: Object.freeze([]),
      });
    }

    const events = await this.dependencies.auditEventRepository.listAuditEvents({
      eventKinds: Object.freeze(["runs"]),
      workspaceId,
      targetRef: `run:${runId}`,
      limit: 64,
      offset: 0,
    });

    return buildOperationalRunStatusTimeline({
      run: canonicalRun,
      auditEvents: events,
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
