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
import {
  type RuntimeValidationError,
  RuntimeInputValidationFailure,
} from "../../../application/system-runtime/RuntimeInputValidationService";
import {
  PermissiveRuntimeApiAuthenticator,
  type RuntimeApiAuthenticationRequest,
  type RuntimeApiAuthenticator,
} from "./RuntimeApiAuthentication";
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
} from "../../../domain/system-runtime/ExecutionSessionDomain";
import {
  ExecutionCallbackEventKinds,
  type ExecutionCallbackEventKind,
  type ExecutionCallbackRegistration,
} from "../../../domain/system-runtime/ExecutionCallbackDomain";
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

export type {
  RuntimeExecutionResultReadModel,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  StartSystemRuntimeExecutionRequest,
};

export interface SystemRuntimeApiError {
  readonly code: "not-found" | "invalid-request" | "forbidden" | "unauthorized" | "quota-exceeded" | "internal";
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
  readonly requireAuthentication?: boolean;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly accessContext?: ExecutionAccessContext;
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

export class SystemRuntimeBackendApi {
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

  public constructor(
    repository: IStudioShellRepository,
    executionStore?: ISystemRuntimeExecutionStore,
    private readonly runtimeAccessControl = new RuntimeAccessControlService(),
    private readonly runtimeAuthenticator: RuntimeApiAuthenticator = new PermissiveRuntimeApiAuthenticator(),
    private readonly executionQuotaEvaluator = new ExecutionQuotaEvaluator(),
    private readonly executionSessionRepository: ExecutionSessionRepository = new InMemoryExecutionSessionRepository(),
    private readonly callbackDispatcher: ExecutionCallbackDispatcher = new HttpExecutionCallbackDispatcher(),
  ) {
    this.service = new SystemRuntimeApplicationService(repository, executionStore);
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest & {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly systemId?: string;
    readonly callback?: ExecutionCallbackRegistrationRequest;
  }): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    return this.wrap(async () => {
      const callerContext = this.resolveCallerContext(request);
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
        started = await this.service.startExecution(request);
      } finally {
        reservation.reservation?.release();
      }
      const session = this.requireOrCreateSession({
        requestedSessionId: undefined,
        executionId: started.execution.executionId,
        callerContext,
        callback: request.callback,
      });
      const finalizedSession = this.executionSessionRepository.save(transitionExecutionSession({
        session,
        status: started.execution.status === "failed"
          ? ExecutionSessionStatuses.failed
          : ExecutionSessionStatuses.completed,
        executionId: started.execution.executionId,
      }));
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
      });
    });
  }

  public async startExecutionAsync(request: StartSystemRuntimeExecutionRequest & {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly systemId?: string;
    readonly sessionId?: string;
    readonly callback?: ExecutionCallbackRegistrationRequest;
  }): Promise<SystemRuntimeApiResponse<AsyncExecutionStartResponse>> {
    return this.wrap(async () => {
      const callerContext = this.resolveCallerContext(request);
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
      let session = this.requireOrCreateSession({
        requestedSessionId: request.sessionId,
        executionId,
        callerContext,
        callback: request.callback,
      });
      session = this.executionSessionRepository.save(transitionExecutionSession({
        session,
        status: ExecutionSessionStatuses.running,
        executionId,
      }));
      const sessionId = session.sessionId;
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

      const asyncRequest: StartSystemRuntimeExecutionRequest = Object.freeze({
        ...request,
        executionId,
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
      return this.service.getExecutionTrace(request.executionId, {
      eventLimit: request.eventLimit,
      logLimit: request.logLimit,
      });
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
      const base = this.service.getExecutionResult(request.executionId);
      const nodeResultLimit = this.normalizeOptionalBoundedInteger(request.nodeResultLimit, 1, 500, "nodeResultLimit");
      const diagnosticsLimit = this.normalizeOptionalBoundedInteger(request.diagnosticsLimit, 1, 500, "diagnosticsLimit");
      const bounded = Object.freeze({
        ...base,
        nodeResults: Object.freeze(nodeResultLimit ? base.nodeResults.slice(0, nodeResultLimit) : [...base.nodeResults]),
        diagnostics: Object.freeze(diagnosticsLimit ? base.diagnostics.slice(0, diagnosticsLimit) : [...base.diagnostics]),
      });
      return Object.freeze({
        ...bounded,
        serialized: this.outputSerializer.serialize(bounded),
      });
    });
  }

  public async listRecentExecutionsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): Promise<SystemRuntimeApiResponse<ReadonlyArray<RuntimeExecutionSummaryReadModel>>> {
    return this.wrap(async () => this.service.listRecentExecutionsForSystem(input));
  }

  public async pollExecution(input: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly requestContext?: RuntimeApiRequestContext;
  }): Promise<SystemRuntimeApiResponse<ExecutionPollResponse>> {
    return this.wrap(async () => {
      const executionId = input.executionId?.trim() || this.executionSessionRepository.getById(input.sessionId?.trim() ?? "")?.lastExecutionId;
      if (!executionId) {
        throw new Error("invalid-request:executionId or sessionId is required.");
      }
      const status = await this.getExecutionStatusAuthorized(executionId, input.requestContext).catch(() => undefined);
      if (status) {
        this.emitExecutionUpdateFromSnapshot({
          executionId,
          sessionId: this.executionSessionRepository.getByExecutionId(executionId)?.sessionId,
          status,
        });
        return Object.freeze({
          executionId,
          sessionId: this.executionSessionRepository.getByExecutionId(executionId)?.sessionId,
          acceptedState: status.status === "failed" ? "failed" : status.status === "succeeded" ? "completed" : "running",
          status: status.status,
          rootAssetId: status.rootAssetId,
          rootVersionId: status.rootVersionId,
        });
      }

      const pending = this.asyncRunsByExecutionId.get(executionId);
      if (pending) {
        return Object.freeze({
          executionId,
          sessionId: pending.sessionId,
          acceptedState: pending.state === "completed" || pending.state === "failed" ? pending.state : "running",
          rootAssetId: pending.rootAssetId,
          rootVersionId: pending.rootVersionId,
        });
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
      if (caller?.callerId && session.context?.callerId && caller.callerId !== session.context.callerId) {
        throw new Error("forbidden:Runtime execution session does not belong to caller.");
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
      const session = await this.resolveSessionForUpdate(input.sessionId, input.executionId, input.requestContext);
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
      this.resolveCallerContext({ requestContext: input.requestContext });
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
      return request.accessContext ?? runtimeContext.accessContext ?? Object.freeze({
        callerKind: "system",
        callerId: "studio-shell-internal",
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

  private toSessionContext(callerContext?: ExecutionAccessContext): ExecutionSessionContext | undefined {
    if (!callerContext) {
      return undefined;
    }
    return Object.freeze({
      callerKind: callerContext.callerKind ?? "anonymous",
      callerId: callerContext.callerId ?? "unknown",
      roles: callerContext.roles,
      callerSessionId: callerContext.sessionId,
      metadata: callerContext.metadata,
    });
  }

  private requireOrCreateSession(input: {
    readonly requestedSessionId?: string;
    readonly executionId: string;
    readonly callerContext?: ExecutionAccessContext;
    readonly callback?: ExecutionCallbackRegistrationRequest;
  }): ExecutionSession {
    const requested = input.requestedSessionId?.trim();
    const existing = requested ? this.executionSessionRepository.getById(requested) : undefined;
    if (existing) {
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
      context: this.toSessionContext(input.callerContext),
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
      const delivery = await this.callbackDispatcher.dispatch(callback, payload);
      const currentSession = this.executionSessionRepository.getById(input.session.sessionId) ?? input.session;
      this.executionSessionRepository.save(appendExecutionSessionCallbackDelivery({
        session: currentSession,
        delivery,
      }));
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
    const status = await this.service.getExecutionStatus(executionId);
    const callerContext = this.resolveCallerContext({ requestContext });
    this.assertExecutionAccess({
      accessContext: callerContext,
      systemId: status.rootAssetId,
      versionId: status.rootVersionId,
    });
    return status;
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

  private async wrap<T>(action: () => Promise<T>): Promise<SystemRuntimeApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
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

    return Object.freeze({ code: "internal", message });
  }
}
