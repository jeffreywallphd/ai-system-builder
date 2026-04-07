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
  OperationalVisibilityAudiences,
  mergeOperationalDetailProjection,
  mergeOperationalStatusProjection,
} from "@application/runs/use-cases/RunOperationalVisibilityProjection";
import {
  mapPlatformRunRecordToCanonicalRun,
  toRunStatusEnvelopeFromPlatformRecord,
} from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
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
import { RunOrchestrationObservability } from "./RunOrchestrationObservability";

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
  readonly queueRepository?: IRunOrchestrationQueuePersistenceRepository;
  readonly auditEventRepository?: IPlatformAuditEventRepository;
  readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly observability?: RunOrchestrationObservability;
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
      await this.recordObservability({
        event: "run.orchestration.query.list-runs.completed",
        operation: "query.list-runs",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
      return this.invalidRequest("workspaceId is required.");
    }

    const actorUserIdentityId = request.authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      await this.recordObservability({
        event: "run.orchestration.query.list-runs.completed",
        operation: "query.list-runs",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["forbidden"]),
      });
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
    const stateCounters = countByState(paged.map((run) => run.state));
    await this.recordObservability({
      event: "run.orchestration.query.list-runs.completed",
      operation: "query.list-runs",
      outcome: "success",
      severity: "info",
      workspaceId,
      counters: Object.freeze({
        listed_total: all.items.length,
        listed_visible_total: visible.length,
        listed_page_total: paged.length,
        ...stateCounters,
      }),
      details: Object.freeze({
        hasSearch: Boolean(request.search?.trim()),
        sortBy: request.sortBy,
        sortDirection: request.sortDirection,
      }),
    });

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
      await this.recordObservability({
        event: "run.orchestration.query.list-queue-status.completed",
        operation: "query.list-queue-status",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
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
    const queueStateCounters = countByState(visibleItems.map((item) => item.state));
    await this.recordObservability({
      event: "run.orchestration.query.list-queue-status.completed",
      operation: "query.list-queue-status",
      outcome: "success",
      severity: "info",
      workspaceId,
      counters: Object.freeze({
        queue_items_total: queue.items.length,
        queue_visible_items_total: visibleItems.length,
        ...queueStateCounters,
      }),
      details: Object.freeze({
        asOf: queue.asOf,
      }),
    });

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
      await this.recordObservability({
        event: "run.orchestration.query.get-run-detail.completed",
        operation: "query.get-run-detail",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
      return this.invalidRequest("workspaceId and runId are required.");
    }

    const detail = await this.dependencies.getAuthoritativeRunUseCase.execute({
      runId,
      workspaceId,
    });
    if (!detail) {
      await this.recordObservability({
        event: "run.orchestration.query.get-run-detail.completed",
        operation: "query.get-run-detail",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["not-found"]),
      });
      return this.notFound(`Run '${runId}' was not found.`);
    }

    if (!await this.isRunReadAllowed({
      authorization: request.authorization,
      runId,
    })) {
      await this.recordObservability({
        event: "run.orchestration.query.get-run-detail.completed",
        operation: "query.get-run-detail",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["not-found-or-forbidden"]),
      });
      return this.notFound(`Run '${runId}' was not found.`);
    }

    const record = await this.dependencies.runRepository.findRunById(runId);
    if (!record) {
      await this.recordObservability({
        event: "run.orchestration.query.get-run-detail.completed",
        operation: "query.get-run-detail",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["not-found"]),
      });
      return this.notFound(`Run '${runId}' was not found.`);
    }

    const audience = await this.resolveOperationalAudience(request.authorization, runId);
    const timeline = await this.getRunStatusTimeline(runId, workspaceId, record, audience);
    const dispatchAttempts = await this.getDispatchAttempts(runId);
    await this.recordObservability({
      event: "run.orchestration.query.get-run-detail.completed",
      operation: "query.get-run-detail",
      outcome: "success",
      severity: "info",
      runId,
      workspaceId,
      correlationId: detail.submission.correlationId,
      lifecycleState: detail.state,
      counters: Object.freeze({
        status_timeline_entries_total: timeline.length,
        dispatch_attempts_total: dispatchAttempts.length,
      }),
      markers: Object.freeze([
        audience === OperationalVisibilityAudiences.admin
          ? "admin-diagnostics-eligible"
          : "user-visibility",
      ]),
    });

    return Object.freeze({
      ok: true,
      data: mergeOperationalDetailProjection({
        detail,
        run: mapPlatformRunRecordToCanonicalRun(record),
        timeline,
        metadata: record.metadata,
        dispatchAttempts,
        audience,
      }),
    });
  }

  public async getRunStatus(
    request: AuthoritativeRunStatusRequest,
  ): Promise<SharedApiResponseEnvelope<RunStatusEnvelope>> {
    const workspaceId = request.workspaceId.trim();
    const runId = request.runId.trim();
    if (!workspaceId || !runId) {
      await this.recordObservability({
        event: "run.orchestration.query.get-run-status.completed",
        operation: "query.get-run-status",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
      return this.invalidRequest("workspaceId and runId are required.");
    }

    const record = await this.dependencies.runRepository.findRunById(runId);
    if (!record || record.workspaceId !== workspaceId) {
      await this.recordObservability({
        event: "run.orchestration.query.get-run-status.completed",
        operation: "query.get-run-status",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["not-found"]),
      });
      return this.notFound(`Run '${runId}' was not found.`);
    }

    if (!await this.isRunReadAllowed({
      authorization: request.authorization,
      runId,
    })) {
      await this.recordObservability({
        event: "run.orchestration.query.get-run-status.completed",
        operation: "query.get-run-status",
        outcome: "failure",
        severity: "warn",
        runId,
        workspaceId,
        markers: Object.freeze(["not-found-or-forbidden"]),
      });
      return this.notFound(`Run '${runId}' was not found.`);
    }

    const status = toRunStatusEnvelopeFromPlatformRecord(record);
    const audience = await this.resolveOperationalAudience(request.authorization, runId);
    const timeline = await this.getRunStatusTimeline(runId, workspaceId, record, audience);
    const dispatchAttempts = await this.getDispatchAttempts(runId);
    await this.recordObservability({
      event: "run.orchestration.query.get-run-status.completed",
      operation: "query.get-run-status",
      outcome: "success",
      severity: "info",
      runId,
      workspaceId,
      lifecycleState: status.state,
      counters: Object.freeze({
        status_timeline_entries_total: timeline.length,
        dispatch_attempts_total: dispatchAttempts.length,
      }),
      markers: Object.freeze([
        audience === OperationalVisibilityAudiences.admin
          ? "admin-diagnostics-eligible"
          : "user-visibility",
      ]),
    });
    return Object.freeze({
      ok: true,
      data: mergeOperationalStatusProjection({
        status,
        run: mapPlatformRunRecordToCanonicalRun(record),
        timeline,
        metadata: record.metadata,
        dispatchAttempts,
        audience,
      }),
    });
  }

  private async getRunStatusTimeline(
    runId: string,
    workspaceId: string,
    record: PlatformRunRecord,
    audience: typeof OperationalVisibilityAudiences[keyof typeof OperationalVisibilityAudiences],
  ) {
    const canonicalRun = mapPlatformRunRecordToCanonicalRun(record);
    const dispatchAttempts = await this.getDispatchAttempts(runId);
    if (!this.dependencies.auditEventRepository) {
      return buildOperationalRunStatusTimeline({
        run: canonicalRun,
        auditEvents: Object.freeze([]),
        dispatchAttempts,
        audience,
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
      dispatchAttempts,
      audience,
    });
  }

  private async getDispatchAttempts(runId: string) {
    if (!this.dependencies.queueRepository) {
      return Object.freeze([]);
    }
    const attempts = await this.dependencies.queueRepository.listDispatchAttemptsByRunId(runId);
    return Object.freeze([...attempts]);
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

  private async resolveOperationalAudience(
    authorization: AuthoritativeRunQueryAuthorizationContext,
    runId: string,
  ): Promise<typeof OperationalVisibilityAudiences[keyof typeof OperationalVisibilityAudiences]> {
    if (!this.dependencies.authorizationDecisionEvaluator) {
      return OperationalVisibilityAudiences.user;
    }

    const actorUserIdentityId = authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return OperationalVisibilityAudiences.user;
    }

    const decision = await this.dependencies.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: authorization.activeWorkspaceId.trim() || undefined,
        authenticatedAt: authorization.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: "run.manage",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: AuthoritativeRunResourceType,
          resourceId: runId.trim(),
        }),
      }),
      asOf: this.now().toISOString(),
    });

    return deriveAuthorizationResponseAccessLevel(decision.decision) === AuthorizationResponseAccessLevels.deny
      ? OperationalVisibilityAudiences.user
      : OperationalVisibilityAudiences.admin;
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

function countByState(states: ReadonlyArray<string>): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const state of states) {
    const normalized = state.trim();
    if (!normalized) {
      continue;
    }
    const key = `state_${normalized.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_total`;
    counters[key] = (counters[key] ?? 0) + 1;
  }
  return counters;
}
