import type { IPlatformAuditEventRepository } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  AuthorizationPolicyEvaluationTargetKinds,
  type IAuthorizationPolicyDecisionEvaluator,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { deriveAuthorizationResponseAccessLevel } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import { AuthorizationResponseAccessLevels } from "@application/authorization/use-cases/AuthorizationResponseRedaction";
import type { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import type { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import type { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import type { GetImageManipulationExecutionReadinessUseCase } from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import type {
  ListStaleSchedulingReservationsUseCase,
} from "@application/runs/use-cases/ListStaleSchedulingReservationsUseCase";
import {
  buildOperationalRunStatusTimeline,
  OperationalVisibilityAudiences,
  mergeOperationalDetailProjection,
  mergeOperationalStatusProjection,
} from "@application/runs/use-cases/RunOperationalVisibilityProjection";
import {
  buildRunQueueSchedulingAdminSummary,
  buildRunSchedulingVisibilityProjection,
  stripRunSchedulingAdminDiagnostics,
} from "@application/runs/use-cases/RunSchedulingVisibilityProjection";
import {
  mapPlatformRunRecordToCanonicalRun,
  toRunStatusEnvelopeFromPlatformRecord,
} from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type {
  RunDetail,
  ExecutionReadinessReadResponse,
  RunListReadResponse,
  RunQueueStatusItem,
  RunQueueStatusReadResponse,
  RunStatusEnvelope,
  RunSubmissionSource,
  RunSummary,
  SchedulingAdminListStaleReservationsResponse,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { RunLifecycleState } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type {
  RuntimeAvailabilityResponseContract,
  RuntimeUnavailableLifecycleResponseContract,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";
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

export interface AuthoritativeSchedulingStaleReservationsRequest {
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
  readonly queueId?: string;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AuthoritativeRunDetailRequest {
  readonly runId: string;
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
}

export interface AuthoritativeRunStatusRequest extends AuthoritativeRunDetailRequest {}

export interface AuthoritativeExecutionReadinessRequest {
  readonly workspaceId: string;
  readonly authorization: AuthoritativeRunQueryAuthorizationContext;
  readonly runtimeLifecycle?: RuntimeUnavailableLifecycleResponseContract;
  readonly systemId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}

export interface AuthoritativeRunQueryBackendApiDependencies {
  readonly listAuthoritativeRunsUseCase: ListAuthoritativeRunsUseCase;
  readonly listAuthoritativeRunQueueStatusUseCase: ListAuthoritativeRunQueueStatusUseCase;
  readonly listStaleSchedulingReservationsUseCase: ListStaleSchedulingReservationsUseCase;
  readonly getAuthoritativeRunUseCase: GetAuthoritativeRunUseCase;
  readonly getImageManipulationExecutionReadinessUseCase?: GetImageManipulationExecutionReadinessUseCase;
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository?: IRunOrchestrationQueuePersistenceRepository;
  readonly auditEventRepository?: IPlatformAuditEventRepository;
  readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly workspaceAuthorizationReadRepository?: IWorkspaceAuthorizationReadRepository;
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

    const visibleItems: RunQueueStatusItem[] = [];
    const adminVisibleItems: RunQueueStatusItem[] = [];
    for (const item of queue.items) {
      if (await this.isRunReadAllowed({
        authorization: request.authorization,
        runId: item.runId,
      })) {
        const audience = await this.resolveOperationalAudience(request.authorization, item.runId);
        if (audience === OperationalVisibilityAudiences.admin) {
          visibleItems.push(item);
          adminVisibleItems.push(item);
        } else {
          visibleItems.push(Object.freeze({
            ...item,
            scheduling: stripRunSchedulingAdminDiagnostics(item.scheduling),
          }));
        }
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
        schedulingAdminSummary: adminVisibleItems.length > 0
          ? buildRunQueueSchedulingAdminSummary({
            asOf: queue.asOf,
            items: Object.freeze(adminVisibleItems),
          })
          : undefined,
      }),
    });
  }

  public async getExecutionReadiness(
    request: AuthoritativeExecutionReadinessRequest,
  ): Promise<SharedApiResponseEnvelope<ExecutionReadinessReadResponse>> {
    const workspaceId = request.workspaceId.trim();
    if (!workspaceId) {
      await this.recordObservability({
        event: "run.orchestration.query.get-execution-readiness.completed",
        operation: "query.get-execution-readiness",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["invalid-request"]),
      });
      return this.invalidRequest("workspaceId is required.");
    }

    if (request.runtimeLifecycle && request.runtimeLifecycle.state !== "ready") {
      const lifecycleReadiness = this.buildRuntimeLifecycleExecutionReadinessResponse(request.runtimeLifecycle);
      await this.recordObservability({
        event: "run.orchestration.query.get-execution-readiness.completed",
        operation: "query.get-execution-readiness",
        outcome: "success",
        severity: "warn",
        workspaceId,
        details: Object.freeze({
          backendFamily: lifecycleReadiness.backendFamily,
          readiness: lifecycleReadiness.readiness,
          runtimeLifecycleState: request.runtimeLifecycle.state,
          operationKind: request.operationKind,
          translationContractVersion: request.translationContractVersion,
        }),
        counters: Object.freeze({
          readiness_issues_total: lifecycleReadiness.issues.length,
        }),
        markers: Object.freeze([
          `readiness:${lifecycleReadiness.readiness}`,
          `runtime-lifecycle:${request.runtimeLifecycle.state}`,
        ]),
      });
      return Object.freeze({
        ok: true,
        data: lifecycleReadiness,
      });
    }

    const actorUserIdentityId = request.authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      await this.recordObservability({
        event: "run.orchestration.query.get-execution-readiness.completed",
        operation: "query.get-execution-readiness",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["forbidden"]),
      });
      return this.forbidden("Execution readiness visibility requires an authenticated actor.");
    }

    const allowed = await this.isWorkspaceRunReadAllowed(request.authorization);
    if (!allowed) {
      await this.recordObservability({
        event: "run.orchestration.query.get-execution-readiness.completed",
        operation: "query.get-execution-readiness",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["authorization-denied"]),
      });
      return this.forbidden("Execution readiness visibility is not authorized for this actor.");
    }

    const readiness = this.dependencies.getImageManipulationExecutionReadinessUseCase
      ? await this.dependencies.getImageManipulationExecutionReadinessUseCase.execute({
        workspaceId,
        systemId: request.systemId,
        operationKind: request.operationKind,
        translationContractVersion: request.translationContractVersion,
      })
      : Object.freeze({
        backendFamily: "adapter.image-manipulation.execution",
        checkedAt: this.now().toISOString(),
        readiness: "unavailable" as const,
        readyForExecution: false,
        message: "Execution readiness use case is not configured.",
        capabilities: Object.freeze({
          backendFamily: "adapter.image-manipulation.execution",
          supportsProgressPolling: false,
          supportsProgressStreaming: false,
          supportsCancellation: false,
          supportsOutputDiscovery: false,
          supportedOperationKinds: Object.freeze([]),
          supportedTranslationContractVersions: Object.freeze([]),
        }),
        nodeAvailability: Object.freeze({
          state: "unknown" as const,
          checkedAt: this.now().toISOString(),
          candidateNodeCount: 0,
          eligibleNodeCount: 0,
          unavailableNodeCount: 0,
          incompatibleNodeCount: 0,
          topBlockingReasonCodes: Object.freeze([]),
          topTransientAvailabilityReasonCodes: Object.freeze([]),
          reasonCode: "execution-readiness-use-case-not-configured",
        }),
        issues: Object.freeze([Object.freeze({
          code: "execution-readiness-use-case-not-configured",
          severity: "error" as const,
          message: "Execution readiness use case is not configured.",
        })]),
        diagnostics: undefined,
      });

    await this.recordObservability({
      event: "run.orchestration.query.get-execution-readiness.completed",
      operation: "query.get-execution-readiness",
      outcome: "success",
      severity: readiness.readyForExecution ? "info" : "warn",
      workspaceId,
      details: Object.freeze({
        backendFamily: readiness.backendFamily,
        readiness: readiness.readiness,
        operationKind: request.operationKind,
        translationContractVersion: request.translationContractVersion,
      }),
      counters: Object.freeze({
        readiness_issues_total: readiness.issues.length,
      }),
      markers: Object.freeze([
        `readiness:${readiness.readiness}`,
      ]),
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        backendFamily: readiness.backendFamily,
        checkedAt: readiness.checkedAt,
        readiness: readiness.readiness,
        readyForExecution: readiness.readyForExecution,
        message: readiness.message,
        capabilities: readiness.capabilities,
        nodeAvailability: readiness.nodeAvailability,
        issues: readiness.issues,
        diagnostics: readiness.diagnostics,
      }),
    });
  }

  public async listStaleSchedulingReservations(
    request: AuthoritativeSchedulingStaleReservationsRequest,
  ): Promise<SharedApiResponseEnvelope<SchedulingAdminListStaleReservationsResponse>> {
    const workspaceId = request.workspaceId.trim();
    if (!workspaceId) {
      await this.recordObservability({
        event: "run.orchestration.query.list-stale-scheduling-reservations.completed",
        operation: "query.list-stale-scheduling-reservations",
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
        event: "run.orchestration.query.list-stale-scheduling-reservations.completed",
        operation: "query.list-stale-scheduling-reservations",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["forbidden"]),
      });
      return this.forbidden("Scheduling admin reservation visibility requires an authenticated actor.");
    }

    const allowed = await this.isWorkspaceRunManageAllowed(request.authorization);
    if (!allowed) {
      await this.recordObservability({
        event: "run.orchestration.query.list-stale-scheduling-reservations.completed",
        operation: "query.list-stale-scheduling-reservations",
        outcome: "failure",
        severity: "warn",
        workspaceId,
        markers: Object.freeze(["authorization-denied"]),
      });
      return this.forbidden("Scheduling stale reservations are not authorized for this actor.");
    }

    const stale = await this.dependencies.listStaleSchedulingReservationsUseCase.execute({
      workspaceId,
      queueId: request.queueId,
      asOf: request.asOf,
      limit: request.limit,
      offset: request.offset,
    });
    await this.recordObservability({
      event: "run.orchestration.query.list-stale-scheduling-reservations.completed",
      operation: "query.list-stale-scheduling-reservations",
      outcome: "success",
      severity: "info",
      workspaceId,
      counters: Object.freeze({
        stale_reservations_total: stale.totalCount,
      }),
      details: Object.freeze({
        asOf: stale.asOf,
      }),
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        asOf: stale.asOf,
        totalCount: stale.totalCount,
        items: stale.items,
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
    const auditEvents = await this.listRunAuditEvents(runId, workspaceId);
    const dispatchAttempts = await this.getDispatchAttempts(runId);
    const timeline = buildOperationalRunStatusTimeline({
      run: mapPlatformRunRecordToCanonicalRun(record),
      auditEvents,
      dispatchAttempts,
      audience,
    });
    const queueEntry = await this.getQueueEntry(runId);
    const scheduling = buildRunSchedulingVisibilityProjection({
      runRecord: record,
      queueEntry,
      auditEvents,
      dispatchAttempts,
    });
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
      data: Object.freeze({
        ...mergeOperationalDetailProjection({
        detail,
        run: mapPlatformRunRecordToCanonicalRun(record),
        timeline,
        metadata: record.metadata,
        dispatchAttempts,
        audience,
      }),
        scheduling: audience === OperationalVisibilityAudiences.admin
          ? scheduling
          : stripRunSchedulingAdminDiagnostics(scheduling),
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
    const auditEvents = await this.listRunAuditEvents(runId, workspaceId);
    const dispatchAttempts = await this.getDispatchAttempts(runId);
    const timeline = buildOperationalRunStatusTimeline({
      run: mapPlatformRunRecordToCanonicalRun(record),
      auditEvents,
      dispatchAttempts,
      audience,
    });
    const queueEntry = await this.getQueueEntry(runId);
    const scheduling = buildRunSchedulingVisibilityProjection({
      runRecord: record,
      queueEntry,
      auditEvents,
      dispatchAttempts,
    });
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
      data: Object.freeze({
        ...mergeOperationalStatusProjection({
        status,
        run: mapPlatformRunRecordToCanonicalRun(record),
        timeline,
        metadata: record.metadata,
        dispatchAttempts,
        audience,
      }),
        scheduling: audience === OperationalVisibilityAudiences.admin
          ? scheduling
          : stripRunSchedulingAdminDiagnostics(scheduling),
      }),
    });
  }

  private async listRunAuditEvents(runId: string, workspaceId: string) {
    if (!this.dependencies.auditEventRepository) {
      return Object.freeze([]);
    }
    const events = await this.dependencies.auditEventRepository.listAuditEvents({
      eventKinds: Object.freeze(["runs"]),
      workspaceId,
      targetRef: `run:${runId}`,
      limit: 64,
      offset: 0,
    });
    return Object.freeze([...events]);
  }

  private async getDispatchAttempts(runId: string) {
    if (!this.dependencies.queueRepository) {
      return Object.freeze([]);
    }
    const attempts = await this.dependencies.queueRepository.listDispatchAttemptsByRunId(runId);
    return Object.freeze([...attempts]);
  }

  private async getQueueEntry(runId: string) {
    if (!this.dependencies.queueRepository) {
      return undefined;
    }
    return this.dependencies.queueRepository.getQueueEntryByRunId(runId);
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

  private async isWorkspaceRunManageAllowed(
    authorization: AuthoritativeRunQueryAuthorizationContext,
  ): Promise<boolean> {
    if (!this.dependencies.authorizationDecisionEvaluator) {
      return true;
    }
    const actorUserIdentityId = authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return false;
    }
    const workspaceId = authorization.activeWorkspaceId.trim();
    if (!workspaceId) {
      return false;
    }

    const decision = await this.dependencies.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: workspaceId,
        authenticatedAt: authorization.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: "run.manage",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId,
        capabilityResourceType: AuthoritativeRunResourceType,
      }),
      asOf: this.now().toISOString(),
    });

    return deriveAuthorizationResponseAccessLevel(decision.decision) !== AuthorizationResponseAccessLevels.deny;
  }

  private async isWorkspaceRunReadAllowed(
    authorization: AuthoritativeRunQueryAuthorizationContext,
  ): Promise<boolean> {
    const actorUserIdentityId = authorization.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return false;
    }
    const workspaceId = authorization.activeWorkspaceId.trim();
    if (!workspaceId) {
      return false;
    }

    if (!this.dependencies.authorizationDecisionEvaluator) {
      return true;
    }

    const decision = await this.dependencies.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: workspaceId,
        authenticatedAt: authorization.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: "run.read",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId,
        capabilityResourceType: AuthoritativeRunResourceType,
      }),
      asOf: this.now().toISOString(),
    });

    if (deriveAuthorizationResponseAccessLevel(decision.decision) !== AuthorizationResponseAccessLevels.deny) {
      return true;
    }

    return this.isWorkspaceReadinessVisibleViaWorkspaceAuthority({
      workspaceId,
      actorUserIdentityId,
      asOf: this.now().toISOString(),
    });
  }

  private async isWorkspaceReadinessVisibleViaWorkspaceAuthority(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly asOf?: string;
  }): Promise<boolean> {
    if (!this.dependencies.workspaceAuthorizationReadRepository) {
      return false;
    }
    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId: input.workspaceId,
      userIdentityId: input.actorUserIdentityId,
      asOf: input.asOf,
    });
    if (!snapshot) {
      return false;
    }

    const hasActiveMembership = snapshot.isWorkspaceOwner
      || snapshot.membership?.status === WorkspaceMembershipStatuses.active;
    const isWorkspaceAdminOrOwner = snapshot.isWorkspaceOwner
      || snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);

    return hasActiveMembership && isWorkspaceAdminOrOwner;
  }

  private buildRuntimeLifecycleExecutionReadinessResponse(
    runtimeLifecycle: RuntimeUnavailableLifecycleResponseContract,
  ): ExecutionReadinessReadResponse {
    const checkedAt = runtimeLifecycle.checkedAt;
    const lifecycleDiagnostics = runtimeLifecycle.diagnostics;
    const primaryMessage = runtimeLifecycle.state === "failed"
      ? runtimeLifecycle.failure.message
      : runtimeLifecycle.blockingReasons[0]?.message ?? `Runtime lifecycle is '${runtimeLifecycle.state}'.`;

    return Object.freeze({
      backendFamily: "adapter.image-manipulation.execution",
      checkedAt,
      readiness: "unavailable" as const,
      readyForExecution: false,
      runtimeLifecycle: runtimeLifecycle as RuntimeAvailabilityResponseContract,
      message: primaryMessage,
      capabilities: Object.freeze({
        backendFamily: "adapter.image-manipulation.execution",
        supportsProgressPolling: false,
        supportsProgressStreaming: false,
        supportsCancellation: false,
        supportsOutputDiscovery: false,
        supportedOperationKinds: Object.freeze([]),
        supportedTranslationContractVersions: Object.freeze([]),
      }),
      nodeAvailability: Object.freeze({
        state: "unknown" as const,
        checkedAt,
        candidateNodeCount: 0,
        eligibleNodeCount: 0,
        unavailableNodeCount: 0,
        incompatibleNodeCount: 0,
        topBlockingReasonCodes: Object.freeze(runtimeLifecycle.blockingReasons.map((reason) => reason.code)),
        topTransientAvailabilityReasonCodes: Object.freeze([]),
        reasonCode: this.mapRuntimeLifecycleReasonCode(runtimeLifecycle),
      }),
      issues: Object.freeze([
        ...runtimeLifecycle.blockingReasons.map((reason) => Object.freeze({
          code: reason.code,
          severity: "error" as const,
          message: reason.message,
        })),
        ...(runtimeLifecycle.state === "failed"
          ? [Object.freeze({
            code: runtimeLifecycle.failure.code,
            severity: "error" as const,
            message: runtimeLifecycle.failure.message,
          })]
          : []),
      ]),
      diagnostics: Object.freeze({
        runtimeLifecycleState: runtimeLifecycle.state,
        blockingDependencyCategory: lifecycleDiagnostics?.blockingDependencyCategory,
        runtimeLifecycleSummary: lifecycleDiagnostics?.summary,
        runtimeLifecyclePhase: lifecycleDiagnostics?.lifecyclePhase,
        runtimeTransportPhase: lifecycleDiagnostics?.transportPhase,
      }),
    });
  }

  private mapRuntimeLifecycleReasonCode(
    runtimeLifecycle: RuntimeUnavailableLifecycleResponseContract,
  ): string {
    if (runtimeLifecycle.state === "failed") {
      return runtimeLifecycle.failure.code;
    }
    return runtimeLifecycle.blockingReasons[0]?.code ?? "runtime-lifecycle-unavailable";
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
