import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import {
  SystemRuntimeApplicationService,
  type RuntimeExecutionSummaryReadModel,
  type RuntimeExecutionResultReadModel,
  type RuntimeExecutionStatusReadModel,
  type RuntimeExecutionTraceReadModel,
  type StartSystemRuntimeExecutionRequest,
} from "../../../application/system-runtime/SystemRuntimeApplicationService";
import type { ISystemRuntimeExecutionStore } from "../../../application/system-runtime/SystemRuntimeExecutionStore";
import {
  InMemoryExecutionSessionRepository,
  type ExecutionSessionRepository,
} from "../../../application/system-runtime/ExecutionSessionRepository";
import { RuntimeAccessControlService, type ExecutionAccessContext } from "../../../application/system-runtime/RuntimeAccessControlService";
import { ExecutionQuotaEvaluator } from "../../../application/system-runtime/ExecutionQuotaEvaluator";
import { RuntimeRateLimitEvaluator } from "../../../application/system-runtime/RuntimeRateLimitEvaluator";
import {
  type RuntimeValidationError,
  RuntimeInputValidationFailure,
} from "../../../application/system-runtime/RuntimeInputValidationService";
import {
  PermissiveRuntimeApiAuthenticator,
  type RuntimeApiAuthenticationRequest,
  type RuntimeApiAuthenticator,
} from "./RuntimeApiAuthentication";
import type {
  ExternalExecutionEnvironmentRequest,
  SerializedExecutionEnvironment,
} from "../../../application/system-runtime/ExecutionEnvironmentConfigurationValidator";
import {
  TenantExecutionIsolationPolicy,
  type ExecutionTenantContext,
  type TenantScopedExecutionAccessContext,
} from "../../../application/system-runtime/TenantExecutionIsolationPolicy";
import {
  RuntimeOutputSerializer,
  type SerializedExecutionResult,
} from "./RuntimeOutputSerializer";
import {
  createExecutionSession,
  appendExecutionSessionCallbackDelivery,
  ExecutionSessionStatuses,
  registerExecutionSessionCallback,
  transitionExecutionSession,
  type ExecutionSession,
  type ExecutionSessionContext,
} from "../../../src/domain/system-runtime/ExecutionSessionDomain";
import {
  ExecutionCallbackEventKinds,
  type ExecutionCallbackEventKind,
  type ExecutionCallbackRegistration,
} from "../../../src/domain/system-runtime/ExecutionCallbackDomain";
import type { RuntimeEnvironment } from "../../../src/domain/system-runtime/RuntimeEnvironmentDomain";
import {
  ExecutionUpdateEventKinds,
  ExecutionUpdateStream,
  type ExecutionUpdateEventKind,
  type ExecutionUpdateSubscription,
} from "./ExecutionUpdateStream";
import {
  HttpExecutionCallbackDispatcher,
  type ExecutionCallbackDispatcher,
  type ExecutionCallbackPayload,
} from "./ExecutionCallbackDispatcher";
import { ExecutionAuditEventKinds, type ExecutionAuditRecord } from "../../../src/domain/system-runtime/ExecutionAuditTrailDomain";
import type { RetryAttemptRecord } from "./ExternalRetryPolicy";
import { ExecutionAuditTrailService } from "../../../application/system-runtime/ExecutionAuditTrailService";
import {
  InMemoryExecutionAuditRepository,
  type ExecutionAuditRepository,
} from "../../../application/system-runtime/ExecutionAuditRepository";
import type { IAuthorizationPolicyDecisionEvaluator } from "../../../src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyEvaluationTargetKinds } from "../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationResourceFamilies } from "../../../src/domain/authorization/AuthorizationPermissionCatalog";
import {
  AuthorizationResponseAccessLevels,
  deriveAuthorizationResponseAccessLevel,
  shapeAuthorizationAwareResponse,
  type AuthorizationResponseAccessLevel,
} from "../../../src/application/authorization/use-cases/AuthorizationResponseRedaction";

export type {
  RuntimeExecutionResultReadModel,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  StartSystemRuntimeExecutionRequest,
};

export interface SystemRuntimeApiError {
  readonly code: "not-found" | "invalid-request" | "forbidden" | "unauthorized" | "quota-exceeded" | "rate-limit-exceeded" | "internal";
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<RuntimeValidationError>;
}

export interface SystemRuntimeApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: SystemRuntimeApiError;
}

export interface StartSystemRuntimeExecutionResponse {
  readonly executionId: string;
  readonly sessionId?: string;
  readonly status: RuntimeExecutionStatusReadModel["status"];
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly runtimeBehavior: {
    readonly behaviorKind: string;
    readonly executionPattern: string;
  };
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly executionEnvironment?: SerializedExecutionEnvironment;
  readonly nestedExecutionLineage: RuntimeExecutionStatusReadModel["nestedExecutionLineage"];
}
export interface AsyncExecutionStartResponse extends StartSystemRuntimeExecutionResponse {
  readonly acceptedState: "accepted" | "running";
}

export interface ExecutionPollResponse {
  readonly executionId: string;
  readonly sessionId?: string;
  readonly acceptedState: "accepted" | "running" | "completed" | "failed";
  readonly status?: RuntimeExecutionStatusReadModel["status"];
  readonly rootAssetId?: string;
  readonly rootVersionId?: string;
}

export interface GetSystemRuntimeExecutionTraceRequest {
  readonly executionId: string;
  readonly eventLimit?: number;
  readonly logLimit?: number;
}

export interface GetSystemRuntimeExecutionResultRequest {
  readonly executionId: string;
  readonly nodeResultLimit?: number;
  readonly diagnosticsLimit?: number;
}

export interface RuntimeExecutionResultApiModel extends RuntimeExecutionResultReadModel {
  readonly serialized: SerializedExecutionResult;
}

export interface RuntimeApiRequestContext {
  readonly trustedInternal?: boolean;
  readonly trustedInternalAuthorization?: {
    readonly actorMode?: "propagate-caller" | "system-action";
    readonly systemActionId?: string;
  };
  readonly requireAuthentication?: boolean;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly accessContext?: ExecutionAccessContext;
  readonly tenantId?: string;
  readonly requestSource?: ExecutionAuditRecord["requestSource"];
  readonly retryAttempt?: RetryAttemptRecord;
}

export interface ExecutionCallbackRegistrationRequest {
  readonly callbackId?: string;
  readonly targetUrl: string;
  readonly eventKinds?: ReadonlyArray<ExecutionCallbackEventKind>;
  readonly secretToken?: string;
  readonly includeResultSummary?: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly maxAttempts?: number;
}

export interface SystemRuntimeAuthorizationOptions {
  readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly runProtectedResourceType?: string;
  readonly queueProtectedResourceType?: string;
  readonly logProtectedResourceType?: string;
  readonly now?: () => Date;
}

const RuntimeExecutionTracePartialRedactionRules = Object.freeze([
  Object.freeze({ path: "trace.events" }),
  Object.freeze({ path: "trace.logs" }),
]);

const RuntimeExecutionResultPartialRedactionRules = Object.freeze([
  Object.freeze({ path: "output" }),
  Object.freeze({ path: "diagnostics" }),
  Object.freeze({ path: "serialized.outputs" }),
  Object.freeze({ path: "serialized.diagnostics.entries" }),
]);

export class SystemRuntimeBackendApi {
  private static readonly EXTERNAL_POLL_RESPONSE_CACHE_TTL_MS = 75;
  private static readonly EXTERNAL_STATUS_RESPONSE_CACHE_TTL_MS = 75;
  private static readonly STREAM_EMIT_MIN_INTERVAL_MS = 50;
  private static readonly MAX_IN_FLIGHT_ASYNC_RUNS = 500;
  private static readonly MAX_CALLBACK_REGISTRATIONS_PER_SESSION = 20;

  private readonly service: SystemRuntimeApplicationService;
  private readonly outputSerializer = new RuntimeOutputSerializer();
  private readonly asyncRunsByExecutionId = new Map<string, {
    readonly executionId: string;
    readonly sessionId: string;
    readonly rootAssetId: string;
    readonly rootVersionId?: string;
    state: ExecutionPollResponse["acceptedState"];
  }>();
  private readonly updateStream = new ExecutionUpdateStream();
  private readonly emittedTraceCountsByExecutionId = new Map<string, number>();
  private readonly lastStreamEmitByExecutionId = new Map<string, number>();
  private readonly cachedExternalPollsByKey = new Map<string, {
    readonly expiresAtMs: number;
    readonly response: ExecutionPollResponse;
  }>();
  private readonly cachedExternalStatusByKey = new Map<string, {
    readonly expiresAtMs: number;
    readonly response: RuntimeExecutionStatusReadModel;
  }>();
  private readonly tenantIsolationPolicy = new TenantExecutionIsolationPolicy();
  private readonly auditTrailService: ExecutionAuditTrailService;
  private readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  private readonly runProtectedResourceType: string;
  private readonly queueProtectedResourceType: string;
  private readonly logProtectedResourceType: string;
  private readonly now: () => Date;

  public constructor(
    repository: IStudioShellRepository,
    executionStore?: ISystemRuntimeExecutionStore,
    private readonly runtimeAccessControl = new RuntimeAccessControlService(),
    private readonly runtimeAuthenticator: RuntimeApiAuthenticator = new PermissiveRuntimeApiAuthenticator(),
    private readonly executionQuotaEvaluator = new ExecutionQuotaEvaluator(),
    private readonly executionSessionRepository: ExecutionSessionRepository = new InMemoryExecutionSessionRepository(),
    private readonly callbackDispatcher: ExecutionCallbackDispatcher = new HttpExecutionCallbackDispatcher(),
    executionAuditRepository: ExecutionAuditRepository = new InMemoryExecutionAuditRepository(),
    private readonly runtimeRateLimitEvaluator = new RuntimeRateLimitEvaluator(),
    authorizationOptions?: SystemRuntimeAuthorizationOptions,
  ) {
    this.service = new SystemRuntimeApplicationService(repository, executionStore);
    this.auditTrailService = new ExecutionAuditTrailService(executionAuditRepository);
    this.authorizationDecisionEvaluator = authorizationOptions?.authorizationDecisionEvaluator;
    this.runProtectedResourceType = authorizationOptions?.runProtectedResourceType?.trim() || "runtime-execution";
    this.queueProtectedResourceType = authorizationOptions?.queueProtectedResourceType?.trim() || "runtime-queue";
    this.logProtectedResourceType = authorizationOptions?.logProtectedResourceType?.trim() || "runtime-log";
    this.now = authorizationOptions?.now ?? (() => new Date());
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest & {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly systemId?: string;
    readonly callback?: ExecutionCallbackRegistrationRequest;
    readonly requestedEnvironment?: ExternalExecutionEnvironmentRequest;
    readonly tenantId?: string;
  }): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    return this.wrap(async () => {
      const callerContext = this.resolveCallerContext(request);
      const tenantContext = this.resolveTenantContext({ requestContext: request.requestContext, callerContext, requestTenantId: request.tenantId });
      const requestSource = this.resolveRequestSource(request.requestContext);
      this.assertExternalRateLimit({ requestContext: request.requestContext, callerContext, tenantId: tenantContext?.tenantId, operation: "start-execution" });
      this.recordRetryAuditFromContext(request.requestContext, requestSource, request.executionId);
      this.assertExecutionAccess({
        accessContext: callerContext,
        systemId: request.systemId,
        versionId: request.versionId,
      });
      const reservation = this.executionQuotaEvaluator.reserveExecution({ callerContext });
      if (!reservation.decision.allowed) {
        throw new Error(`quota-exceeded:${reservation.decision.message ?? "Runtime execution quota exceeded."}`);
      }

      let started;
      try {
        started = await this.service.startExecution({
          ...request,
          tenantContext,
          requestedEnvironment: request.requestedEnvironment,
        });
      } finally {
        reservation.reservation?.release();
      }
      const session = this.requireOrCreateSession({
        requestedSessionId: undefined,
        executionId: started.execution.executionId,
        callerContext,
        tenantContext,
        callback: request.callback,
      });
      const finalizedSession = this.executionSessionRepository.save(transitionExecutionSession({
        session,
        status: started.execution.status === "failed"
          ? ExecutionSessionStatuses.failed
          : ExecutionSessionStatuses.completed,
        executionId: started.execution.executionId,
      }));
      this.recordAudit({
        eventKind: ExecutionAuditEventKinds.requested,
        requestSource,
        callerContext,
        tenantContext,
        execution: {
          executionId: started.execution.executionId,
          sessionId: finalizedSession.sessionId,
          status: "pending",
          systemId: started.execution.root.assetId,
          versionId: started.execution.root.versionId,
        },
      });
      this.recordAudit({
        eventKind: ExecutionAuditEventKinds.accepted,
        requestSource,
        callerContext,
        tenantContext,
        execution: {
          executionId: started.execution.executionId,
          sessionId: finalizedSession.sessionId,
          status: started.execution.status,
          systemId: started.execution.root.assetId,
          versionId: started.execution.root.versionId,
        },
      });
      this.recordAudit({
        eventKind: started.execution.status === "failed"
          ? ExecutionAuditEventKinds.failed
          : ExecutionAuditEventKinds.completed,
        requestSource,
        callerContext,
        tenantContext,
        execution: {
          executionId: started.execution.executionId,
          sessionId: finalizedSession.sessionId,
          status: started.execution.status,
          systemId: started.execution.root.assetId,
          versionId: started.execution.root.versionId,
          childExecutionIds: this.service.getExecutionResult(started.execution.executionId).nestedExecutionLineage.map((entry) => entry.executionId),
        },
      });
      await this.dispatchExecutionCallbacks({
        session: finalizedSession,
        eventKind: started.execution.status === "failed"
          ? ExecutionCallbackEventKinds.executionFailed
          : ExecutionCallbackEventKinds.executionCompleted,
        executionId: started.execution.executionId,
      });
      this.emitExecutionUpdateFromSnapshot({
        executionId: started.execution.executionId,
        sessionId: finalizedSession.sessionId,
      });
      return Object.freeze({
        executionId: started.execution.executionId,
        sessionId: this.executionSessionRepository.getByExecutionId(started.execution.executionId)?.sessionId,
        status: started.execution.status,
        rootAssetId: started.execution.root.assetId,
        rootVersionId: started.execution.root.versionId,
        runtimeBehavior: Object.freeze({
          behaviorKind: started.runtimeBehavior.behaviorKind,
          executionPattern: started.runtimeBehavior.executionPattern,
        }),
        executedVersionMap: Object.freeze({
          rootVersionId: started.execution.root.versionId,
          nodeVersionIds: Object.freeze(Object.fromEntries(started.execution.nodes
            .filter((node) => Boolean(node.target.versionId))
            .map((node) => [node.executionNodeId, node.target.versionId!])
            .sort(([left], [right]) => left.localeCompare(right)))),
        }),
        executionEnvironment: started.executionEnvironment
          ? this.serializeExecutionEnvironment(started.executionEnvironment)
          : undefined,
        nestedExecutionLineage: this.service.getExecutionStatus(started.execution.executionId).nestedExecutionLineage,
      });
    });
  }

  public async startExecutionAsync(request: StartSystemRuntimeExecutionRequest & {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly systemId?: string;
    readonly sessionId?: string;
    readonly callback?: ExecutionCallbackRegistrationRequest;
    readonly requestedEnvironment?: ExternalExecutionEnvironmentRequest;
    readonly tenantId?: string;
  }): Promise<SystemRuntimeApiResponse<AsyncExecutionStartResponse>> {
    return this.wrap(async () => {
      const callerContext = this.resolveCallerContext(request);
      const tenantContext = this.resolveTenantContext({ requestContext: request.requestContext, callerContext, requestTenantId: request.tenantId });
      const requestSource = this.resolveRequestSource(request.requestContext);
      this.assertExternalRateLimit({ requestContext: request.requestContext, callerContext, tenantId: tenantContext?.tenantId, operation: "start-execution-async" });
      this.assertExecutionAccess({
        accessContext: callerContext,
        systemId: request.systemId,
        versionId: request.versionId,
      });
      const reservation = this.executionQuotaEvaluator.reserveExecution({ callerContext });
      if (!reservation.decision.allowed) {
        throw new Error(`quota-exceeded:${reservation.decision.message ?? "Runtime execution quota exceeded."}`);
      }

      const executionId = request.executionId?.trim() || `sys-exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      this.recordRetryAuditFromContext(request.requestContext, requestSource, executionId);
      let session = this.requireOrCreateSession({
        requestedSessionId: request.sessionId,
        executionId,
        callerContext,
        tenantContext,
        callback: request.callback,
      });
      session = this.executionSessionRepository.save(transitionExecutionSession({
        session,
        status: ExecutionSessionStatuses.running,
        executionId,
      }));
      const sessionId = session.sessionId;
      if (this.asyncRunsByExecutionId.size >= SystemRuntimeBackendApi.MAX_IN_FLIGHT_ASYNC_RUNS) {
        throw new Error(`rate-limit-exceeded:Too many asynchronous runtime executions are currently in-flight (max ${SystemRuntimeBackendApi.MAX_IN_FLIGHT_ASYNC_RUNS}).`);
      }
      this.asyncRunsByExecutionId.set(executionId, {
        executionId,
        sessionId,
        rootAssetId: request.systemId ?? this.deriveSystemIdFromVersionId(request.versionId),
        rootVersionId: request.versionId,
        state: "accepted",
      });
      await this.dispatchExecutionCallbacks({
        session,
        eventKind: ExecutionCallbackEventKinds.executionAccepted,
        executionId,
      });
      this.updateStream.emit({
        executionId,
        sessionId,
        kind: ExecutionUpdateEventKinds.executionAccepted,
        status: "pending",
      });
      this.recordAudit({
        eventKind: ExecutionAuditEventKinds.requested,
        requestSource,
        callerContext,
        tenantContext,
        execution: {
          executionId,
          sessionId,
          systemId: request.systemId,
          versionId: request.versionId,
          status: "pending",
        },
      });
      this.recordAudit({
        eventKind: ExecutionAuditEventKinds.accepted,
        requestSource,
        callerContext,
        tenantContext,
        execution: {
          executionId,
          sessionId,
          systemId: request.systemId,
          versionId: request.versionId,
          status: "pending",
        },
      });

      const asyncRequest: StartSystemRuntimeExecutionRequest = Object.freeze({
        ...request,
        executionId,
        tenantContext,
        requestedEnvironment: request.requestedEnvironment,
      });

      void this.service.startExecution(asyncRequest)
        .then((result) => {
          const pending = this.asyncRunsByExecutionId.get(executionId);
          if (pending) {
            pending.state = "completed";
          }
          const updatedSession = this.executionSessionRepository.save(transitionExecutionSession({
            session: this.executionSessionRepository.getById(sessionId) ?? session,
            status: ExecutionSessionStatuses.completed,
            executionId,
          }));
          void this.dispatchExecutionCallbacks({
            session: updatedSession,
            eventKind: ExecutionCallbackEventKinds.executionCompleted,
            executionId,
          });
          this.emitExecutionUpdateFromSnapshot({
            executionId: result.execution.executionId,
            sessionId,
          });
          this.recordAudit({
            eventKind: ExecutionAuditEventKinds.completed,
            requestSource,
            callerContext,
            tenantContext,
            execution: {
              executionId,
              sessionId,
              status: result.execution.status,
              systemId: result.execution.root.assetId,
              versionId: result.execution.root.versionId,
              childExecutionIds: this.service.getExecutionResult(executionId).nestedExecutionLineage.map((entry) => entry.executionId),
            },
          });
          this.asyncRunsByExecutionId.delete(executionId);
          reservation.reservation?.release();
          return result;
        })
        .catch((error) => {
          const pending = this.asyncRunsByExecutionId.get(executionId);
          if (pending) {
            pending.state = "failed";
          }
          const updatedSession = this.executionSessionRepository.save(transitionExecutionSession({
            session: this.executionSessionRepository.getById(sessionId) ?? session,
            status: ExecutionSessionStatuses.failed,
            executionId,
            error: {
              code: "runtime-async-failure",
              message: error instanceof Error ? error.message : "Asynchronous runtime execution failed.",
            },
          }));
          void this.dispatchExecutionCallbacks({
            session: updatedSession,
            eventKind: ExecutionCallbackEventKinds.executionFailed,
            executionId,
          });
          this.emitExecutionUpdateFromSnapshot({
            executionId,
            sessionId,
          });
          this.recordAudit({
            eventKind: ExecutionAuditEventKinds.failed,
            requestSource,
            callerContext,
            tenantContext,
            execution: {
              executionId,
              sessionId,
              status: "failed",
              systemId: request.systemId,
              versionId: request.versionId,
            },
            detail: {
              message: error instanceof Error ? error.message : "Asynchronous runtime execution failed.",
              errorCode: "runtime-async-failure",
            },
          });
          this.asyncRunsByExecutionId.delete(executionId);
          reservation.reservation?.release();
        });

      return Object.freeze({
        executionId,
        sessionId,
        acceptedState: "accepted" as const,
        status: "pending" as const,
        rootAssetId: request.systemId ?? this.deriveSystemIdFromVersionId(request.versionId),
        rootVersionId: request.versionId,
        runtimeBehavior: Object.freeze({
          behaviorKind: "unknown",
          executionPattern: "asynchronous",
        }),
        executedVersionMap: Object.freeze({
          rootVersionId: request.versionId,
          nodeVersionIds: Object.freeze({}),
        }),
        nestedExecutionLineage: Object.freeze([]),
      });
    });
  }

  public async getExecutionStatus(
    executionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionStatusReadModel>> {
    return this.wrap(async () => this.getExecutionStatusAuthorized(executionId, requestContext));
  }

  public async getExecutionTrace(
    request: GetSystemRuntimeExecutionTraceRequest & { readonly requestContext?: RuntimeApiRequestContext },
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>> {
    return this.wrap(async () => {
      await this.getExecutionStatusAuthorized(request.executionId, request.requestContext);
      const accessLevel = await this.resolveOperationalResourceAccessLevel({
        requestContext: request.requestContext,
        requiredPermissionKey: "run.read",
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: this.runProtectedResourceType,
        resourceId: request.executionId,
      });
      await this.assertOperationalResourceAuthorized({
        requestContext: request.requestContext,
        requiredPermissionKey: "log.read",
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: this.logProtectedResourceType,
        resourceId: request.executionId,
      });
      const trace = this.service.getExecutionTrace(request.executionId, {
        eventLimit: request.eventLimit,
        logLimit: request.logLimit,
      });
      const shaped = shapeAuthorizationAwareResponse({
        accessLevel,
        value: trace,
        partialRules: RuntimeExecutionTracePartialRedactionRules,
      });
      return shaped.value ?? trace;
    });
  }

  public async getExecutionResult(
    executionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultApiModel>> {
    return this.getExecutionResultBounded({ executionId, requestContext });
  }

  public async getExecutionResultBounded(
    request: GetSystemRuntimeExecutionResultRequest & { readonly requestContext?: RuntimeApiRequestContext },
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultApiModel>> {
    return this.wrap(async () => {
      await this.getExecutionStatusAuthorized(request.executionId, request.requestContext);
      const accessLevel = await this.resolveOperationalResourceAccessLevel({
        requestContext: request.requestContext,
        requiredPermissionKey: "run.read",
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: this.runProtectedResourceType,
        resourceId: request.executionId,
      });
      const base = this.service.getExecutionResult(request.executionId);
      const nodeResultLimit = this.normalizeOptionalBoundedInteger(request.nodeResultLimit, 1, 500, "nodeResultLimit");
      const diagnosticsLimit = this.normalizeOptionalBoundedInteger(request.diagnosticsLimit, 1, 500, "diagnosticsLimit");
      const bounded = Object.freeze({
        ...base,
        nodeResults: Object.freeze(nodeResultLimit ? base.nodeResults.slice(0, nodeResultLimit) : [...base.nodeResults]),
        diagnostics: Object.freeze(diagnosticsLimit ? base.diagnostics.slice(0, diagnosticsLimit) : [...base.diagnostics]),
      });
      const projected = Object.freeze({
        ...bounded,
        serialized: this.outputSerializer.serialize(bounded),
      });
      const shaped = shapeAuthorizationAwareResponse({
        accessLevel,
        value: projected,
        partialRules: RuntimeExecutionResultPartialRedactionRules,
      });
      return shaped.value ?? projected;
    });
  }

  public async listRecentExecutionsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
    readonly requestContext?: RuntimeApiRequestContext;
  }): Promise<SystemRuntimeApiResponse<ReadonlyArray<RuntimeExecutionSummaryReadModel>>> {
    return this.wrap(async () => {
      await this.assertOperationalResourceAuthorized({
        requestContext: input.requestContext,
        requiredPermissionKey: "queue.read",
        resourceFamily: AuthorizationResourceFamilies.queue,
        resourceType: this.queueProtectedResourceType,
        resourceId: this.createQueueResourceId(input.assetId, input.versionId),
      });
      const summaries = await this.service.listRecentExecutionsForSystem({
        assetId: input.assetId,
        versionId: input.versionId,
        limit: input.limit,
      });
      if (!this.authorizationDecisionEvaluator) {
        return summaries;
      }
      const filtered: RuntimeExecutionSummaryReadModel[] = [];
      for (const summary of summaries) {
        if (await this.isOperationalResourceAllowed({
          requestContext: input.requestContext,
          requiredPermissionKey: "run.read",
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: this.runProtectedResourceType,
          resourceId: summary.executionId,
        })) {
          filtered.push(summary);
        }
      }
      return Object.freeze(filtered);
    });
  }

  public async getExecutionAuditTrail(input: {
    readonly executionId: string;
    readonly limit?: number;
    readonly requestContext?: RuntimeApiRequestContext;
  }): Promise<SystemRuntimeApiResponse<ReadonlyArray<ExecutionAuditRecord>>> {
    return this.wrap(async () => {
      await this.getExecutionStatusAuthorized(input.executionId, input.requestContext);
      await this.assertOperationalResourceAuthorized({
        requestContext: input.requestContext,
        requiredPermissionKey: "log.read",
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: this.logProtectedResourceType,
        resourceId: input.executionId,
      });
      return this.auditTrailService.listByExecutionId(input.executionId, input.limit);
    });
  }

  public async pollExecution(input: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly requestContext?: RuntimeApiRequestContext;
  }): Promise<SystemRuntimeApiResponse<ExecutionPollResponse>> {
    return this.wrap(async () => {
      const pollCaller = this.resolveCallerContext({ requestContext: input.requestContext });
      const pollTenant = this.resolveTenantContext({ requestContext: input.requestContext, callerContext: pollCaller });
      const cacheKey = this.buildExternalPollCacheKey(input, pollCaller, pollTenant?.tenantId);
      const cached = cacheKey ? this.readExternalPollCache(cacheKey) : undefined;
      if (cached) {
        return cached;
      }
      this.assertExternalRateLimit({ requestContext: input.requestContext, callerContext: pollCaller, tenantId: pollTenant?.tenantId, operation: "poll-execution" });
      const executionId = input.executionId?.trim() || this.executionSessionRepository.getById(input.sessionId?.trim() ?? "")?.lastExecutionId;
      if (!executionId) {
        throw new Error("invalid-request:executionId or sessionId is required.");
      }
      let status: RuntimeExecutionStatusReadModel | undefined;
      try {
        status = await this.getExecutionStatusAuthorized(executionId, input.requestContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.startsWith("not-found:")) {
          throw error;
        }
      }
      if (status) {
        this.emitExecutionUpdateFromSnapshot({
          executionId,
          sessionId: this.executionSessionRepository.getByExecutionId(executionId)?.sessionId,
          status,
        });
        const response = Object.freeze({
          executionId,
          sessionId: this.executionSessionRepository.getByExecutionId(executionId)?.sessionId,
          acceptedState: status.status === "failed" ? "failed" : status.status === "succeeded" ? "completed" : "running",
          status: status.status,
          rootAssetId: status.rootAssetId,
          rootVersionId: status.rootVersionId,
        });
        if (cacheKey) {
          this.rememberExternalPollCache(cacheKey, response);
        }
        return response;
      }

      const pending = this.asyncRunsByExecutionId.get(executionId);
      if (pending) {
        const caller = this.resolveCallerContext({ requestContext: input.requestContext });
        const tenantContext = this.resolveTenantContext({ requestContext: input.requestContext, callerContext: caller });
        const session = this.executionSessionRepository.getById(pending.sessionId);
        if (caller?.callerId && session?.context?.callerId && caller.callerId !== session.context.callerId) {
          throw new Error("forbidden:Runtime execution session does not belong to caller.");
        }
        this.assertTenantIsolation({
          access: { caller, tenant: tenantContext },
          resourceTenantId: session?.context?.tenantId,
        });
        await this.assertOperationalResourceAuthorized({
          requestContext: input.requestContext,
          requiredPermissionKey: "run.read",
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: this.runProtectedResourceType,
          resourceId: executionId,
        });
        const response = Object.freeze({
          executionId,
          sessionId: pending.sessionId,
          acceptedState: pending.state === "completed" || pending.state === "failed" ? pending.state : "running",
          rootAssetId: pending.rootAssetId,
          rootVersionId: pending.rootVersionId,
        });
        if (cacheKey) {
          this.rememberExternalPollCache(cacheKey, response);
        }
        return response;
      }
      throw new Error(`not-found:Execution '${executionId}' was not found.`);
    });
  }

  public async getExecutionSession(
    sessionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<SystemRuntimeApiResponse<ExecutionSession>> {
    return this.wrap(async () => {
      const normalized = sessionId.trim();
      if (!normalized) {
        throw new Error("invalid-request:sessionId is required.");
      }
      const session = this.executionSessionRepository.getById(normalized);
      if (!session) {
        throw new Error(`not-found:Execution session '${normalized}' was not found.`);
      }
      const caller = this.resolveCallerContext({ requestContext });
      const tenantContext = this.resolveTenantContext({ requestContext, callerContext: caller });
      this.assertExternalRateLimit({ requestContext, callerContext: caller, tenantId: tenantContext?.tenantId, operation: "get-execution-session" });
      if (caller?.callerId && session.context?.callerId && caller.callerId !== session.context.callerId) {
        throw new Error("forbidden:Runtime execution session does not belong to caller.");
      }
      this.assertTenantIsolation({
        access: { caller, tenant: tenantContext },
        resourceTenantId: session.context?.tenantId,
      });
      for (const executionId of session.executionIds ?? []) {
        await this.assertOperationalResourceAuthorized({
          requestContext,
          requiredPermissionKey: "run.read",
          resourceFamily: AuthorizationResourceFamilies.run,
          resourceType: this.runProtectedResourceType,
          resourceId: executionId,
        });
      }
      return session;
    });
  }

  public async registerExecutionCallback(input: {
    readonly sessionId?: string;
    readonly executionId?: string;
    readonly callback: ExecutionCallbackRegistrationRequest;
    readonly requestContext?: RuntimeApiRequestContext;
  }): Promise<SystemRuntimeApiResponse<ExecutionCallbackRegistration>> {
    return this.wrap(async () => {
      const caller = this.resolveCallerContext({ requestContext: input.requestContext });
      const tenantContext = this.resolveTenantContext({ requestContext: input.requestContext, callerContext: caller });
      this.assertExternalRateLimit({ requestContext: input.requestContext, callerContext: caller, tenantId: tenantContext?.tenantId, operation: "register-execution-callback" });
      const session = await this.resolveSessionForUpdate(input.sessionId, input.executionId, input.requestContext);
      if ((session.callbacks?.length ?? 0) >= SystemRuntimeBackendApi.MAX_CALLBACK_REGISTRATIONS_PER_SESSION) {
        throw new Error(`invalid-request:Execution session callback registration exceeds bounded limit (${SystemRuntimeBackendApi.MAX_CALLBACK_REGISTRATIONS_PER_SESSION}).`);
      }
      const updated = this.executionSessionRepository.save(registerExecutionSessionCallback({
        session,
        callback: input.callback,
      }));
      return updated.callbacks?.[updated.callbacks.length - 1] as ExecutionCallbackRegistration;
    });
  }

  public subscribeToExecutionUpdates(input: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly eventKinds?: ReadonlyArray<ExecutionUpdateEventKind>;
    readonly listener: (event: ReturnType<ExecutionUpdateStream["emit"]>) => void;
  }): SystemRuntimeApiResponse<ExecutionUpdateSubscription> {
    try {
      if (!input.executionId?.trim() && !input.sessionId?.trim()) {
        throw new Error("invalid-request:executionId or sessionId is required.");
      }
      const caller = this.resolveCallerContext({ requestContext: input.requestContext });
      const tenantContext = this.resolveTenantContext({ requestContext: input.requestContext, callerContext: caller });
      this.assertExternalRateLimit({ requestContext: input.requestContext, callerContext: caller, tenantId: tenantContext?.tenantId, operation: "subscribe-execution-updates" });
      if (input.executionId?.trim()) {
        this.assertTenantIsolation({
          access: { caller, tenant: tenantContext },
          resourceTenantId: this.readExecutionTenantId(input.executionId),
        });
      }
      if (input.sessionId?.trim()) {
        const session = this.executionSessionRepository.getById(input.sessionId.trim());
        this.assertTenantIsolation({
          access: { caller, tenant: tenantContext },
          resourceTenantId: session?.context?.tenantId,
        });
      }
      const subscription = this.updateStream.subscribe({
        executionId: input.executionId,
        sessionId: input.sessionId,
        eventKinds: input.eventKinds,
        listener: input.listener,
      });
      return Object.freeze({
        ok: true,
        data: subscription,
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        error: this.toApiError(error),
      });
    }
  }


  private assertExecutionAccess(request: { readonly accessContext?: ExecutionAccessContext; readonly systemId?: string; readonly versionId?: string }): void {
    const decision = this.runtimeAccessControl.evaluate({
      context: request.accessContext,
      systemId: request.systemId,
      versionId: request.versionId,
    });

    if (!decision.allowed) {
      const reason = decision.reasonCode ? ` (${decision.reasonCode})` : "";
      throw new Error(`forbidden:${decision.message ?? `Runtime execution was denied by access policy${reason}.`}`);
    }
  }

  private resolveCallerContext(request: {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
  }): ExecutionAccessContext | undefined {
    const runtimeContext = request.requestContext;
    if (runtimeContext?.trustedInternal) {
      const explicitCallerContext = request.accessContext ?? runtimeContext.accessContext;
      const trustedInternalAuthorization = runtimeContext.trustedInternalAuthorization;
      const actorMode = trustedInternalAuthorization?.actorMode?.trim() || (explicitCallerContext ? "propagate-caller" : "system-action");
      if (actorMode === "propagate-caller") {
        if (!explicitCallerContext) {
          throw new Error("invalid-request:Trusted internal request is missing delegated caller context.");
        }
        return explicitCallerContext;
      }
      const systemActionId = trustedInternalAuthorization?.systemActionId?.trim()
        || (this.authorizationDecisionEvaluator ? "" : "studio-shell-internal");
      if (!systemActionId) {
        throw new Error("invalid-request:Trusted internal system actions must include a trustedInternalAuthorization.systemActionId.");
      }
      return Object.freeze({
        callerKind: "system",
        callerId: systemActionId,
        roles: Object.freeze(["trusted-internal"]),
      });
    }

    const authDecision = this.runtimeAuthenticator.authenticate(runtimeContext?.authentication);
    if (!authDecision.authenticated && runtimeContext?.requireAuthentication) {
      throw new Error(`unauthorized:${authDecision.message ?? "Runtime API request is missing or has invalid authentication."}`);
    }
    if (!authDecision.authenticated) {
      return request.accessContext ?? runtimeContext?.accessContext;
    }

    const principal = authDecision.principal!;
    return Object.freeze({
      callerKind: principal.callerKind,
      callerId: principal.callerId,
      sessionId: principal.sessionId,
      roles: principal.roles,
      metadata: principal.metadata,
    });
  }

  private toSessionContext(
    callerContext?: ExecutionAccessContext,
    tenantContext?: ExecutionTenantContext,
  ): ExecutionSessionContext | undefined {
    if (!callerContext) {
      return tenantContext ? Object.freeze({
        callerKind: "anonymous",
        callerId: "unknown",
        tenantId: tenantContext.tenantId,
      }) : undefined;
    }
    return Object.freeze({
      callerKind: callerContext.callerKind ?? "anonymous",
      callerId: callerContext.callerId ?? "unknown",
      roles: callerContext.roles,
      callerSessionId: callerContext.sessionId,
      tenantId: tenantContext?.tenantId,
      metadata: callerContext.metadata,
    });
  }

  private requireOrCreateSession(input: {
    readonly requestedSessionId?: string;
    readonly executionId: string;
    readonly callerContext?: ExecutionAccessContext;
    readonly tenantContext?: ExecutionTenantContext;
    readonly callback?: ExecutionCallbackRegistrationRequest;
  }): ExecutionSession {
    const requested = input.requestedSessionId?.trim();
    const existing = requested ? this.executionSessionRepository.getById(requested) : undefined;
    if (existing) {
      this.assertTenantIsolation({
        access: { caller: input.callerContext, tenant: input.tenantContext },
        resourceTenantId: existing.context?.tenantId,
      });
      let updated = this.executionSessionRepository.save(transitionExecutionSession({
        session: existing,
        status: existing.status,
        executionId: input.executionId,
      }));
      if (input.callback) {
        updated = registerExecutionSessionCallback({
          session: updated,
          callback: input.callback,
        });
      }
      return this.executionSessionRepository.save(updated);
    }
    let created = createExecutionSession({
      sessionId: requested ?? `exec-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      context: this.toSessionContext(input.callerContext, input.tenantContext),
      executionId: input.executionId,
      status: ExecutionSessionStatuses.accepted,
    });
    if (input.callback) {
      created = registerExecutionSessionCallback({
        session: created,
        callback: input.callback,
      });
    }
    return this.executionSessionRepository.save(created);
  }

  private async resolveSessionForUpdate(
    sessionId: string | undefined,
    executionId: string | undefined,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<ExecutionSession> {
    const byId = sessionId?.trim() ? this.executionSessionRepository.getById(sessionId.trim()) : undefined;
    const byExecution = executionId?.trim() ? this.executionSessionRepository.getByExecutionId(executionId.trim()) : undefined;
    const session = byId ?? byExecution;
    if (!session) {
      throw new Error("not-found:Execution session was not found.");
    }
    const caller = this.resolveCallerContext({ requestContext });
    if (caller?.callerId && session.context?.callerId && caller.callerId !== session.context.callerId) {
      throw new Error("forbidden:Runtime execution session does not belong to caller.");
    }
    const tenantContext = this.resolveTenantContext({ requestContext, callerContext: caller });
    this.assertTenantIsolation({
      access: { caller, tenant: tenantContext },
      resourceTenantId: session.context?.tenantId,
    });
    return session;
  }

  private async dispatchExecutionCallbacks(input: {
    readonly session: ExecutionSession;
    readonly eventKind: ExecutionCallbackEventKind;
    readonly executionId: string;
  }): Promise<void> {
    const callbacks = (input.session.callbacks ?? []).filter((entry) => entry.eventKinds.includes(input.eventKind));
    if (callbacks.length === 0) {
      return;
    }
    for (const callback of callbacks) {
      const payload = await this.buildCallbackPayload(input, callback);
      const maxAttempts = Math.max(1, callback.maxAttempts ?? 1);
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const delivery = await this.callbackDispatcher.dispatch(callback, payload);
        const currentSession = this.executionSessionRepository.getById(input.session.sessionId) ?? input.session;
        this.executionSessionRepository.save(appendExecutionSessionCallbackDelivery({
          session: currentSession,
          delivery,
        }));
        if (delivery.succeeded) {
          break;
        }
        const retryable = delivery.statusCode === undefined || delivery.statusCode >= 500;
        this.recordAudit({
          eventKind: attempt < maxAttempts && retryable ? ExecutionAuditEventKinds.retryAttempted : ExecutionAuditEventKinds.retryExhausted,
          requestSource: "unknown",
          execution: { executionId: input.executionId, sessionId: input.session.sessionId, status: input.session.status },
          detail: {
            message: delivery.message,
            errorCode: `callback-delivery-${delivery.statusCode ?? "unknown"}`,
            retryAttempt: attempt,
            retryMaxAttempts: maxAttempts,
            retryClassification: retryable ? "retryable-callback-delivery" : "non-retryable-callback-delivery",
          },
        });
        if (!retryable || attempt >= maxAttempts) {
          break;
        }
      }
    }
  }

  private async buildCallbackPayload(
    input: { readonly session: ExecutionSession; readonly eventKind: ExecutionCallbackEventKind; readonly executionId: string },
    callback: ExecutionCallbackRegistration,
  ): Promise<ExecutionCallbackPayload> {
    let status: RuntimeExecutionStatusReadModel | undefined;
    try {
      status = this.service.getExecutionStatus(input.executionId);
    } catch {
      status = undefined;
    }
    const safeResult = callback.includeResultSummary
      ? (() => {
        try {
          return this.service.getExecutionResult(input.executionId);
        } catch {
          return undefined;
        }
      })()
      : undefined;
    return Object.freeze({
      callbackId: callback.callbackId,
      eventKind: input.eventKind,
      executionId: input.executionId,
      sessionId: input.session.sessionId,
      occurredAt: new Date().toISOString(),
      status: status?.status ?? input.session.status,
      summary: callback.includeResultSummary && input.eventKind !== ExecutionCallbackEventKinds.executionAccepted
        ? Object.freeze({
          rootAssetId: status?.rootAssetId,
          rootVersionId: status?.rootVersionId,
          completedAt: status?.completedAt,
          outputSummary: safeResult?.outputSummary,
          diagnostics: safeResult?.diagnostics.slice(0, 10),
        })
        : undefined,
    });
  }

  private emitExecutionUpdateFromSnapshot(input: {
    readonly executionId: string;
    readonly sessionId?: string;
    readonly status?: RuntimeExecutionStatusReadModel;
  }): void {
    try {
      const nowMs = Date.now();
      const lastEmittedAt = this.lastStreamEmitByExecutionId.get(input.executionId) ?? 0;
      if (nowMs - lastEmittedAt < SystemRuntimeBackendApi.STREAM_EMIT_MIN_INTERVAL_MS) {
        return;
      }
      this.lastStreamEmitByExecutionId.set(input.executionId, nowMs);
      const status = input.status ?? this.service.getExecutionStatus(input.executionId);
      const trace = this.service.getExecutionTrace(input.executionId, { eventLimit: 50 }).trace;
      const priorTraceCount = this.emittedTraceCountsByExecutionId.get(input.executionId) ?? 0;
      const nextTraceCount = trace.events.length;
      const nextEvents = trace.events.slice(priorTraceCount);
      this.emittedTraceCountsByExecutionId.set(input.executionId, nextTraceCount);
      this.updateStream.emit({
        executionId: input.executionId,
        sessionId: input.sessionId,
        kind: ExecutionUpdateEventKinds.executionStatus,
        status: status.status,
        progress: status.progress,
      });
      for (const traceEvent of nextEvents.slice(0, 20)) {
        this.updateStream.emit({
          executionId: input.executionId,
          sessionId: input.sessionId,
          kind: ExecutionUpdateEventKinds.executionTrace,
          status: status.status,
          traceEvent: {
            kind: traceEvent.kind,
            at: traceEvent.at,
            nodeId: traceEvent.nodeId,
            status: traceEvent.status,
            summary: traceEvent.summary,
          },
        });
      }
      if (status.status === "succeeded" || status.status === "failed") {
        const result = this.service.getExecutionResult(input.executionId);
        this.updateStream.emit({
          executionId: input.executionId,
          sessionId: input.sessionId,
          kind: status.status === "succeeded" ? ExecutionUpdateEventKinds.executionCompleted : ExecutionUpdateEventKinds.executionFailed,
          status: status.status,
          summary: {
            rootAssetId: result.rootAssetId,
            rootVersionId: result.rootVersionId,
            diagnosticsCount: result.diagnostics.length,
          },
        });
      }
    } catch {
      return;
    }
  }

  private deriveSystemIdFromVersionId(versionId?: string): string {
    const normalized = versionId?.trim();
    if (!normalized) {
      return "unknown-system";
    }
    const index = normalized.lastIndexOf(":v");
    return index > 0 ? normalized.slice(0, index) : normalized;
  }

  private async getExecutionStatusAuthorized(
    executionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<RuntimeExecutionStatusReadModel> {
    const callerContext = this.resolveCallerContext({ requestContext });
    const tenantContext = this.resolveTenantContext({ requestContext, callerContext });
    const cacheKey = this.buildExternalStatusCacheKey(executionId, requestContext, callerContext, tenantContext?.tenantId);
    const cached = cacheKey ? this.readExternalStatusCache(cacheKey) : undefined;
    if (cached) {
      return cached;
    }
    const status = await this.service.getExecutionStatus(executionId);
    this.assertExternalRateLimit({ requestContext, callerContext, tenantId: tenantContext?.tenantId, operation: "get-execution-status" });
    this.assertExecutionAccess({
      accessContext: callerContext,
      systemId: status.rootAssetId,
      versionId: status.rootVersionId,
    });
    this.assertTenantIsolation({
      access: { caller: callerContext, tenant: tenantContext },
      resourceTenantId: this.readExecutionTenantId(executionId),
    });
    await this.assertOperationalResourceAuthorized({
      requestContext,
      requiredPermissionKey: "run.read",
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: this.runProtectedResourceType,
      resourceId: executionId,
    });
    if (cacheKey) {
      this.rememberExternalStatusCache(cacheKey, status);
    }
    return status;
  }

  private createQueueResourceId(assetId: string, versionId?: string): string {
    const normalizedAssetId = assetId.trim();
    const normalizedVersionId = versionId?.trim();
    return normalizedVersionId
      ? `${normalizedAssetId}::${normalizedVersionId}`
      : normalizedAssetId;
  }

  private async assertOperationalResourceAuthorized(input: {
    readonly requestContext?: RuntimeApiRequestContext;
    readonly requiredPermissionKey: "run.read" | "queue.read" | "log.read";
    readonly resourceFamily:
      | typeof AuthorizationResourceFamilies.run
      | typeof AuthorizationResourceFamilies.queue
      | typeof AuthorizationResourceFamilies.log;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<void> {
    if (!await this.isOperationalResourceAllowed(input)) {
      throw new Error("forbidden:Runtime operational resource access is not authorized.");
    }
  }

  private async isOperationalResourceAllowed(input: {
    readonly requestContext?: RuntimeApiRequestContext;
    readonly requiredPermissionKey: "run.read" | "queue.read" | "log.read";
    readonly resourceFamily:
      | typeof AuthorizationResourceFamilies.run
      | typeof AuthorizationResourceFamilies.queue
      | typeof AuthorizationResourceFamilies.log;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<boolean> {
    const accessLevel = await this.resolveOperationalResourceAccessLevel(input);
    return accessLevel !== AuthorizationResponseAccessLevels.deny;
  }

  private async resolveOperationalResourceAccessLevel(input: {
    readonly requestContext?: RuntimeApiRequestContext;
    readonly requiredPermissionKey: "run.read" | "queue.read" | "log.read";
    readonly resourceFamily:
      | typeof AuthorizationResourceFamilies.run
      | typeof AuthorizationResourceFamilies.queue
      | typeof AuthorizationResourceFamilies.log;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<AuthorizationResponseAccessLevel> {
    if (!this.authorizationDecisionEvaluator) {
      return AuthorizationResponseAccessLevels.full;
    }
    const callerContext = this.resolveCallerContext({ requestContext: input.requestContext });
    if (input.requestContext?.trustedInternal && callerContext?.callerKind === "system") {
      return AuthorizationResponseAccessLevels.full;
    }
    const actorUserIdentityId = callerContext?.callerKind === "user"
      ? callerContext.callerId?.trim()
      : undefined;
    const actorServiceId = callerContext?.callerKind && callerContext.callerKind !== "user"
      ? callerContext.callerId?.trim()
      : undefined;
    if (!actorUserIdentityId && !actorServiceId) {
      return AuthorizationResponseAccessLevels.deny;
    }
    const metadata = callerContext?.metadata as {
      readonly workspaceId?: unknown;
      readonly activeWorkspaceId?: unknown;
      readonly authenticatedAt?: unknown;
    } | undefined;
    const activeWorkspaceIdRaw = typeof metadata?.activeWorkspaceId === "string"
      ? metadata.activeWorkspaceId
      : typeof metadata?.workspaceId === "string"
        ? metadata.workspaceId
        : undefined;
    const authenticatedAtRaw = typeof metadata?.authenticatedAt === "string"
      ? metadata.authenticatedAt
      : undefined;
    const decision = await this.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        actorServiceId,
        activeWorkspaceId: activeWorkspaceIdRaw?.trim() || undefined,
        authenticatedAt: authenticatedAtRaw?.trim() || undefined,
      }),
      requiredPermissionKey: input.requiredPermissionKey,
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: input.resourceFamily,
          resourceType: input.resourceType.trim(),
          resourceId: input.resourceId.trim(),
        }),
      }),
      asOf: this.now().toISOString(),
    });
    return deriveAuthorizationResponseAccessLevel(decision.decision);
  }

  private resolveTenantContext(input: {
    readonly requestContext?: RuntimeApiRequestContext;
    readonly callerContext?: ExecutionAccessContext;
    readonly requestTenantId?: string;
  }): ExecutionTenantContext | undefined {
    const explicitTenantId = input.requestTenantId?.trim() || input.requestContext?.tenantId?.trim();
    if (explicitTenantId) {
      return Object.freeze({ tenantId: explicitTenantId, source: "explicit-request" });
    }
    const metadata = input.callerContext?.metadata as { readonly tenantId?: unknown } | undefined;
    const tenantFromCaller = typeof metadata?.tenantId === "string" ? metadata.tenantId.trim() : "";
    if (tenantFromCaller) {
      return Object.freeze({ tenantId: tenantFromCaller, source: "caller-context" });
    }
    return undefined;
  }

  private readExecutionTenantId(executionId: string): string | undefined {
    try {
      return this.service.getExecutionTenantId(executionId);
    } catch {
      const session = this.executionSessionRepository.getByExecutionId(executionId);
      return session?.context?.tenantId;
    }
  }

  private assertTenantIsolation(input: {
    readonly access: TenantScopedExecutionAccessContext;
    readonly resourceTenantId?: string;
  }): void {
    const decision = this.tenantIsolationPolicy.evaluate(input);
    if (!decision.allowed) {
      throw new Error(`forbidden:${decision.reason ?? "Runtime tenant isolation policy denied access."}`);
    }
  }


  private assertExternalRateLimit(input: {
    readonly requestContext?: RuntimeApiRequestContext;
    readonly callerContext?: ExecutionAccessContext;
    readonly tenantId?: string;
    readonly operation: string;
  }): void {
    if (input.requestContext?.trustedInternal) {
      return;
    }
    const decision = this.runtimeRateLimitEvaluator.evaluate({
      callerContext: input.callerContext,
      tenantId: input.tenantId,
      requestSource: this.resolveRequestSource(input.requestContext),
      operation: input.operation,
    });
    if (!decision.allowed) {
      throw new Error(`rate-limit-exceeded:${decision.message ?? "Runtime request rate limit exceeded."}`);
    }
  }

  private serializeExecutionEnvironment(input: RuntimeEnvironment): SerializedExecutionEnvironment {
    return Object.freeze({
      environmentId: input.environmentId,
      option: input.kind,
      displayName: input.displayName,
      capabilities: Object.freeze({
        supportsNestedSystems: input.capabilities.supportsNestedSystems,
        supportsMcpMediatedExecution: input.capabilities.supportsMcpMediatedExecution,
        supportsStructuralKinds: Object.freeze([...input.capabilities.supportsStructuralKinds]),
      }),
    });
  }

  private normalizeOptionalBoundedInteger(value: number | undefined, min: number, max: number, label: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!Number.isFinite(value) || Math.floor(value) !== value) {
      throw new Error(`invalid-request:${label} must be an integer.`);
    }
    if (value < min || value > max) {
      throw new Error(`invalid-request:${label} must be between ${min} and ${max}.`);
    }
    return value;
  }

  private buildExternalPollCacheKey(
    input: { readonly executionId?: string; readonly sessionId?: string; readonly requestContext?: RuntimeApiRequestContext },
    callerContext?: ExecutionAccessContext,
    tenantId?: string,
  ): string | undefined {
    if (input.requestContext?.trustedInternal) {
      return undefined;
    }
    const executionId = input.executionId?.trim() || "";
    const sessionId = input.sessionId?.trim() || "";
    const identity = `${callerContext?.callerKind ?? "anonymous"}:${callerContext?.callerId ?? "unknown"}:${tenantId ?? "no-tenant"}`;
    if (!executionId && !sessionId) {
      return undefined;
    }
    return `${identity}:${executionId || `session:${sessionId}`}`;
  }

  private readExternalPollCache(cacheKey: string): ExecutionPollResponse | undefined {
    const cached = this.cachedExternalPollsByKey.get(cacheKey);
    if (!cached) {
      return undefined;
    }
    if (Date.now() > cached.expiresAtMs) {
      this.cachedExternalPollsByKey.delete(cacheKey);
      return undefined;
    }
    return cached.response;
  }

  private rememberExternalPollCache(cacheKey: string, response: ExecutionPollResponse): void {
    this.cachedExternalPollsByKey.set(cacheKey, Object.freeze({
      expiresAtMs: Date.now() + SystemRuntimeBackendApi.EXTERNAL_POLL_RESPONSE_CACHE_TTL_MS,
      response,
    }));
  }

  private buildExternalStatusCacheKey(
    executionId: string,
    requestContext: RuntimeApiRequestContext | undefined,
    callerContext: ExecutionAccessContext | undefined,
    tenantId: string | undefined,
  ): string | undefined {
    if (requestContext?.trustedInternal) {
      return undefined;
    }
    const normalizedExecutionId = executionId.trim();
    if (!normalizedExecutionId) {
      return undefined;
    }
    const identity = `${callerContext?.callerKind ?? "anonymous"}:${callerContext?.callerId ?? "unknown"}:${tenantId ?? "no-tenant"}`;
    return `${identity}:${normalizedExecutionId}`;
  }

  private readExternalStatusCache(cacheKey: string): RuntimeExecutionStatusReadModel | undefined {
    const cached = this.cachedExternalStatusByKey.get(cacheKey);
    if (!cached) {
      return undefined;
    }
    if (Date.now() > cached.expiresAtMs) {
      this.cachedExternalStatusByKey.delete(cacheKey);
      return undefined;
    }
    return cached.response;
  }

  private rememberExternalStatusCache(cacheKey: string, response: RuntimeExecutionStatusReadModel): void {
    this.cachedExternalStatusByKey.set(cacheKey, Object.freeze({
      expiresAtMs: Date.now() + SystemRuntimeBackendApi.EXTERNAL_STATUS_RESPONSE_CACHE_TTL_MS,
      response,
    }));
  }

  private async wrap<T>(action: () => Promise<T>): Promise<SystemRuntimeApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private resolveRequestSource(requestContext?: RuntimeApiRequestContext): ExecutionAuditRecord["requestSource"] {
    if (requestContext?.requestSource) {
      return requestContext.requestSource;
    }
    if (requestContext?.trustedInternal) {
      return "internal-trusted";
    }
    return "unknown";
  }

  private recordRetryAuditFromContext(
    requestContext: RuntimeApiRequestContext | undefined,
    requestSource: ExecutionAuditRecord["requestSource"],
    executionId: string | undefined,
  ): void {
    const attempt = requestContext?.retryAttempt;
    if (!attempt || attempt.attempt <= 1 || !executionId) {
      return;
    }
    this.recordAudit({
      eventKind: ExecutionAuditEventKinds.retryAttempted,
      requestSource,
      callerContext: requestContext.accessContext,
      tenantContext: this.resolveTenantContext({ requestContext, callerContext: requestContext.accessContext }),
      execution: {
        executionId,
        status: "pending",
      },
      detail: {
        message: attempt.reason,
        retryAttempt: attempt.attempt,
        retryMaxAttempts: attempt.maxAttempts,
        retryClassification: attempt.classification,
      },
    });
  }

  private recordAudit(input: {
    readonly eventKind: typeof ExecutionAuditEventKinds[keyof typeof ExecutionAuditEventKinds];
    readonly requestSource: ExecutionAuditRecord["requestSource"];
    readonly callerContext?: ExecutionAccessContext;
    readonly tenantContext?: ExecutionTenantContext;
    readonly execution: {
      readonly executionId: string;
      readonly sessionId?: string;
      readonly status?: string;
      readonly systemId?: string;
      readonly versionId?: string;
      readonly childExecutionIds?: ReadonlyArray<string>;
    };
    readonly detail?: {
      readonly message?: string;
      readonly errorCode?: string;
      readonly retryAttempt?: number;
      readonly retryMaxAttempts?: number;
      readonly retryClassification?: string;
    };
  }): void {
    this.auditTrailService.record({
      eventKind: input.eventKind,
      requestSource: input.requestSource,
      caller: Object.freeze({
        callerKind: input.callerContext?.callerKind,
        callerId: input.callerContext?.callerId,
        sessionId: input.callerContext?.sessionId,
        roles: input.callerContext?.roles,
        authenticatedPrincipalId: input.callerContext?.callerId,
      }),
      tenant: Object.freeze({
        tenantId: input.tenantContext?.tenantId,
        source: input.tenantContext?.source,
      }),
      execution: Object.freeze({
        executionId: input.execution.executionId,
        sessionId: input.execution.sessionId,
        status: input.execution.status,
        systemId: input.execution.systemId,
        versionId: input.execution.versionId,
        childExecutionIds: input.execution.childExecutionIds,
      }),
      detail: input.detail,
    });
  }

  private toApiError(error: unknown): SystemRuntimeApiError {
    if (error instanceof RuntimeInputValidationFailure) {
      return Object.freeze({
        code: "invalid-request",
        message: "Runtime input validation failed.",
        validationErrors: error.validationErrors,
      });
    }
    const message = error instanceof Error ? error.message : "Unexpected backend runtime error.";
    if (message.startsWith("not-found:")) {
      return Object.freeze({ code: "not-found", message: message.slice("not-found:".length) });
    }
    if (message.startsWith("invalid-request:")) {
      return Object.freeze({ code: "invalid-request", message: message.slice("invalid-request:".length) });
    }
    if (message.startsWith("forbidden:")) {
      return Object.freeze({ code: "forbidden", message: message.slice("forbidden:".length) });
    }
    if (message.startsWith("unauthorized:")) {
      return Object.freeze({ code: "unauthorized", message: message.slice("unauthorized:".length) });
    }
    if (message.startsWith("quota-exceeded:")) {
      return Object.freeze({ code: "quota-exceeded", message: message.slice("quota-exceeded:".length) });
    }
    if (message.startsWith("rate-limit-exceeded:")) {
      return Object.freeze({ code: "rate-limit-exceeded", message: message.slice("rate-limit-exceeded:".length) });
    }

    return Object.freeze({ code: "internal", message });
  }
}
