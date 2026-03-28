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
  ExecutionSessionStatuses,
  transitionExecutionSession,
  type ExecutionSession,
  type ExecutionSessionContext,
} from "../../../domain/system-runtime/ExecutionSessionDomain";

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

  public constructor(
    repository: IStudioShellRepository,
    executionStore?: ISystemRuntimeExecutionStore,
    private readonly runtimeAccessControl = new RuntimeAccessControlService(),
    private readonly runtimeAuthenticator: RuntimeApiAuthenticator = new PermissiveRuntimeApiAuthenticator(),
    private readonly executionQuotaEvaluator = new ExecutionQuotaEvaluator(),
    private readonly executionSessionRepository: ExecutionSessionRepository = new InMemoryExecutionSessionRepository(),
  ) {
    this.service = new SystemRuntimeApplicationService(repository, executionStore);
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest & {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly systemId?: string;
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
      });
      this.executionSessionRepository.save(transitionExecutionSession({
        session,
        status: started.execution.status === "failed"
          ? ExecutionSessionStatuses.failed
          : ExecutionSessionStatuses.completed,
        executionId: started.execution.executionId,
      }));
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
          this.executionSessionRepository.save(transitionExecutionSession({
            session: this.executionSessionRepository.getById(sessionId) ?? session,
            status: ExecutionSessionStatuses.completed,
            executionId,
          }));
          reservation.reservation?.release();
          return result;
        })
        .catch((error) => {
          const pending = this.asyncRunsByExecutionId.get(executionId);
          if (pending) {
            pending.state = "failed";
          }
          this.executionSessionRepository.save(transitionExecutionSession({
            session: this.executionSessionRepository.getById(sessionId) ?? session,
            status: ExecutionSessionStatuses.failed,
            executionId,
            error: {
              code: "runtime-async-failure",
              message: error instanceof Error ? error.message : "Asynchronous runtime execution failed.",
            },
          }));
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
  }): ExecutionSession {
    const requested = input.requestedSessionId?.trim();
    const existing = requested ? this.executionSessionRepository.getById(requested) : undefined;
    if (existing) {
      return this.executionSessionRepository.save(transitionExecutionSession({
        session: existing,
        status: existing.status,
        executionId: input.executionId,
      }));
    }
    const created = createExecutionSession({
      sessionId: requested ?? `exec-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      context: this.toSessionContext(input.callerContext),
      executionId: input.executionId,
      status: ExecutionSessionStatuses.accepted,
    });
    return this.executionSessionRepository.save(created);
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
