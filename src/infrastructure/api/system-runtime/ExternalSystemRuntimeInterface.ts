import type { ExecutionContext } from "../../../domain/system-runtime/SystemRuntimeDomain";
import type { ExecutionAccessContext } from "../../../application/system-runtime/RuntimeAccessControlService";
import type { ExternalExecutionEnvironmentRequest, SerializedExecutionEnvironment } from "../../../application/system-runtime/ExecutionEnvironmentConfigurationValidator";
import {
  type AsyncExecutionStartResponse,
  type ExecutionCallbackRegistrationRequest,
  type ExecutionPollResponse,
  type GetSystemRuntimeExecutionResultRequest,
  type GetSystemRuntimeExecutionTraceRequest,
  type RuntimeExecutionResultApiModel,
  type RuntimeApiRequestContext,
  type RuntimeExecutionStatusReadModel,
  type RuntimeExecutionTraceReadModel,
  SystemRuntimeBackendApi,
  type SystemRuntimeApiResponse,
} from "./SystemRuntimeBackendApi";
import type { RuntimeApiAuthenticationRequest } from "./RuntimeApiAuthentication";
import type { ExecutionCallbackRegistration } from "../../../domain/system-runtime/ExecutionCallbackDomain";
import type { ExecutionUpdateEvent, ExecutionUpdateEventKind, ExecutionUpdateSubscription } from "./ExecutionUpdateStream";
import { BoundedExternalRetryPolicy, buildRetryAttemptRecord, InMemoryRequestReplayGuard, type ExternalRetryPolicy, type RequestReplayGuard } from "./ExternalRetryPolicy";

export interface ExternalExecutionRequest {
  readonly systemId: string;
  readonly versionId: string;
  readonly inputPayload?: unknown;
  readonly inputContentType?: string;
  readonly inputSchemaVersion?: string;
  readonly context?: ExecutionContext;
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly executionId?: string;
  readonly async?: boolean;
  readonly callback?: ExecutionCallbackRegistrationRequest;
  readonly requestedEnvironment?: ExternalExecutionEnvironmentRequest;
  readonly tenantId?: string;
  readonly requestSource?: RuntimeApiRequestContext["requestSource"];
  readonly idempotencyKey?: string;
}

export interface ExternalExecutionResponse {
  readonly executionId: string;
  readonly sessionId?: string;
  readonly status: RuntimeExecutionStatusReadModel["status"];
  readonly acceptedState?: "accepted" | "running";
  readonly systemId: string;
  readonly versionId: string;
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly executionEnvironment?: SerializedExecutionEnvironment;
  readonly nestedExecutionLineage: RuntimeExecutionStatusReadModel["nestedExecutionLineage"];
}

export interface ExternalExecutionStatus extends RuntimeExecutionStatusReadModel {}

export interface ExternalExecutionResult extends RuntimeExecutionResultApiModel {
  readonly bounded: {
    readonly nodeResultsTruncated: boolean;
    readonly diagnosticsTruncated: boolean;
  };
}

export interface ExternalExecutionResultRequest {
  readonly executionId: string;
  readonly nodeResultLimit?: number;
  readonly diagnosticsLimit?: number;
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly tenantId?: string;
  readonly requestSource?: RuntimeApiRequestContext["requestSource"];
  readonly idempotencyKey?: string;
}

export interface ExternalExecutionTraceRequest extends GetSystemRuntimeExecutionTraceRequest {
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly tenantId?: string;
  readonly requestSource?: RuntimeApiRequestContext["requestSource"];
  readonly idempotencyKey?: string;
}

export interface ExternalExecutionStatusRequest {
  readonly executionId?: string;
  readonly sessionId?: string;
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly tenantId?: string;
  readonly requestSource?: RuntimeApiRequestContext["requestSource"];
  readonly idempotencyKey?: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`invalid-request:${label} is required.`);
  }
  return normalized;
}

function deriveSystemIdFromVersionId(versionId: string): string | undefined {
  const normalized = versionId.trim();
  if (!normalized) {
    return undefined;
  }
  const index = normalized.lastIndexOf(":v");
  if (index <= 0) {
    return undefined;
  }
  const systemId = normalized.slice(0, index).trim();
  return systemId || undefined;
}


function createExternalExecutionId(): string {
  return `ext-exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ExternalSystemRuntimeInterface {
  public constructor(
    private readonly runtimeApi: SystemRuntimeBackendApi,
    private readonly retryPolicy: ExternalRetryPolicy = new BoundedExternalRetryPolicy(),
    private readonly replayGuard: RequestReplayGuard<ExternalExecutionResponse> = new InMemoryRequestReplayGuard<ExternalExecutionResponse>(),
  ) {}

  public async startExecution(request: ExternalExecutionRequest): Promise<SystemRuntimeApiResponse<ExternalExecutionResponse>> {
    try {
      const systemId = normalizeRequired(request.systemId, "systemId");
      const versionId = normalizeRequired(request.versionId, "versionId");
      const derivedSystemId = deriveSystemIdFromVersionId(versionId);
      if (!derivedSystemId) {
        throw new Error("invalid-request:versionId must include a canonical version suffix (for example 'system:demo:v1').");
      }
      if (derivedSystemId !== systemId) {
        throw new Error("invalid-request:systemId must match the system encoded in versionId.");
      }

      const requestSource = request.requestSource ?? "external-api";
      const executionId = request.executionId?.trim() || createExternalExecutionId();
      const idempotencyKey = request.idempotencyKey?.trim();
      const replayIdentity = idempotencyKey
        ? Object.freeze({
          operation: "start-execution" as const,
          idempotencyKey,
          callerId: request.callerContext?.callerId,
          tenantId: request.tenantId,
          requestSource,
        })
        : undefined;
      if (replayIdentity) {
        const replayed = this.replayGuard.get(replayIdentity);
        if (replayed) {
          return replayed;
        }
      }

      let lastResponse: SystemRuntimeApiResponse<ExternalExecutionResponse> | undefined;
      for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
        const retryAttempt = buildRetryAttemptRecord({
          attempt,
          maxAttempts: this.retryPolicy.maxAttempts,
          decision: {
            shouldRetry: attempt < this.retryPolicy.maxAttempts,
            classification: "retryable-transport",
            reason: "External start attempt in progress.",
          },
        });
        const started = request.async
          ? await this.runtimeApi.startExecutionAsync({
            versionId,
            systemId,
            executionId,
            inputPayload: request.inputPayload,
            inputContentType: request.inputContentType,
            inputSchemaVersion: request.inputSchemaVersion,
            context: request.context,
            accessContext: request.callerContext,
            requestContext: {
              requireAuthentication: true,
              authentication: request.authentication,
              accessContext: request.callerContext,
              tenantId: request.tenantId,
              requestSource,
              retryAttempt,
            },
            callback: request.callback,
            requestedEnvironment: request.requestedEnvironment,
            tenantId: request.tenantId,
          })
          : await this.runtimeApi.startExecution({
            versionId,
            systemId,
            executionId,
            inputPayload: request.inputPayload,
            inputContentType: request.inputContentType,
            inputSchemaVersion: request.inputSchemaVersion,
            context: request.context,
            accessContext: request.callerContext,
            requestContext: {
              requireAuthentication: true,
              authentication: request.authentication,
              accessContext: request.callerContext,
              tenantId: request.tenantId,
              requestSource,
              retryAttempt,
            },
            callback: request.callback,
            requestedEnvironment: request.requestedEnvironment,
            tenantId: request.tenantId,
          });

        if (started.ok && started.data) {
          const response: SystemRuntimeApiResponse<ExternalExecutionResponse> = Object.freeze({
            ok: true,
            data: Object.freeze({
              executionId: started.data.executionId,
              sessionId: started.data.sessionId,
              status: started.data.status,
              acceptedState: "acceptedState" in started.data ? started.data.acceptedState : undefined,
              systemId,
              versionId,
              executedVersionMap: started.data.executedVersionMap,
              executionEnvironment: started.data.executionEnvironment,
              nestedExecutionLineage: started.data.nestedExecutionLineage,
            }),
          });
          if (replayIdentity) {
            this.replayGuard.remember(replayIdentity, response);
          }
          return response;
        }

        lastResponse = started;
        const decision = this.retryPolicy.classify(started.error ?? { code: "internal", message: "Unknown external runtime error." });
        if (!decision.shouldRetry || attempt >= this.retryPolicy.maxAttempts) {
          if (replayIdentity && started.error?.code === "rate-limit-exceeded") {
            this.replayGuard.remember(replayIdentity, started);
          }
          return started;
        }
      }
      return lastResponse ?? Object.freeze({ ok: false, error: { code: "internal", message: "External runtime start failed." } });
    } catch (error) {
      return Object.freeze({
        ok: false,
        error: this.toApiError(error),
      });
    }
  }

  public async getExecutionStatus(
    request: string | ExternalExecutionStatusRequest,
  ): Promise<SystemRuntimeApiResponse<ExternalExecutionStatus>> {
    const normalized = typeof request === "string"
      ? Object.freeze({ executionId: request })
      : request;
    if (normalized.executionId?.trim()) {
      return this.runtimeApi.getExecutionStatus(normalized.executionId, {
        requireAuthentication: true,
        authentication: normalized.authentication,
        accessContext: normalized.callerContext,
        tenantId: normalized.tenantId,
        requestSource: normalized.requestSource ?? "external-api",
      });
    }
    const poll = await this.runtimeApi.pollExecution({
      sessionId: normalized.sessionId,
      requestContext: {
        requireAuthentication: true,
        authentication: normalized.authentication,
        accessContext: normalized.callerContext,
        tenantId: normalized.tenantId,
      },
    });
    if (!poll.ok || !poll.data) {
      return poll as SystemRuntimeApiResponse<ExternalExecutionStatus>;
    }
    return this.runtimeApi.getExecutionStatus(poll.data.executionId, {
      requireAuthentication: true,
      authentication: normalized.authentication,
      accessContext: normalized.callerContext,
      tenantId: normalized.tenantId,
      requestSource: normalized.requestSource ?? "external-api",
    });
  }

  public async pollExecution(request: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly callerContext?: ExecutionAccessContext;
    readonly authentication?: RuntimeApiAuthenticationRequest;
    readonly tenantId?: string;
  }): Promise<SystemRuntimeApiResponse<ExecutionPollResponse>> {
    return this.runtimeApi.pollExecution({
      executionId: request.executionId,
      sessionId: request.sessionId,
      requestContext: {
        requireAuthentication: true,
        authentication: request.authentication,
        accessContext: request.callerContext,
        tenantId: request.tenantId,
        requestSource: request.requestSource ?? "external-api",
      },
    });
  }

  public async getExecutionResult(request: ExternalExecutionResultRequest): Promise<SystemRuntimeApiResponse<ExternalExecutionResult>> {
    const result = await this.runtimeApi.getExecutionResultBounded({
      ...(request as GetSystemRuntimeExecutionResultRequest),
      requestContext: {
        requireAuthentication: true,
        authentication: request.authentication,
        accessContext: request.callerContext,
        tenantId: request.tenantId,
        requestSource: request.requestSource ?? "external-api",
      },
    });
    if (!result.ok || !result.data) {
      return result;
    }

    const bounded = Object.freeze({
      nodeResultsTruncated: typeof request.nodeResultLimit === "number" && result.data.nodeResults.length >= request.nodeResultLimit,
      diagnosticsTruncated: typeof request.diagnosticsLimit === "number" && result.data.diagnostics.length >= request.diagnosticsLimit,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        ...result.data,
        bounded,
      }),
    });
  }

  public async getExecutionTrace(request: ExternalExecutionTraceRequest): Promise<SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>> {
    return this.runtimeApi.getExecutionTrace({
      ...request,
      requestContext: {
        requireAuthentication: true,
        authentication: request.authentication,
        accessContext: request.callerContext,
        tenantId: request.tenantId,
        requestSource: "external-api",
      },
    });
  }

  public async registerExecutionCallback(request: {
    readonly sessionId?: string;
    readonly executionId?: string;
    readonly callback: ExecutionCallbackRegistrationRequest;
    readonly callerContext?: ExecutionAccessContext;
    readonly authentication?: RuntimeApiAuthenticationRequest;
    readonly tenantId?: string;
    readonly requestSource?: RuntimeApiRequestContext["requestSource"];
  }): Promise<SystemRuntimeApiResponse<ExecutionCallbackRegistration>> {
    return this.runtimeApi.registerExecutionCallback({
      sessionId: request.sessionId,
      executionId: request.executionId,
      callback: request.callback,
      requestContext: this.toRequestContext(request.callerContext, request.authentication, request.tenantId, request.requestSource),
    });
  }

  public subscribeToExecutionUpdates(request: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly eventKinds?: ReadonlyArray<ExecutionUpdateEventKind>;
    readonly callerContext?: ExecutionAccessContext;
    readonly authentication?: RuntimeApiAuthenticationRequest;
    readonly tenantId?: string;
    readonly requestSource?: RuntimeApiRequestContext["requestSource"];
    readonly listener: (event: ExecutionUpdateEvent) => void;
  }): SystemRuntimeApiResponse<ExecutionUpdateSubscription> {
    return this.runtimeApi.subscribeToExecutionUpdates({
      executionId: request.executionId,
      sessionId: request.sessionId,
      eventKinds: request.eventKinds,
      requestContext: this.toRequestContext(request.callerContext, request.authentication, request.tenantId, request.requestSource),
      listener: request.listener,
    });
  }

  private toApiError(error: unknown): { readonly code: "invalid-request" | "internal"; readonly message: string } {
    const message = error instanceof Error ? error.message : "Unexpected external runtime interface error.";
    if (message.startsWith("invalid-request:")) {
      return Object.freeze({ code: "invalid-request", message: message.slice("invalid-request:".length) });
    }
    return Object.freeze({ code: "internal", message });
  }

  private toRequestContext(
    callerContext?: ExecutionAccessContext,
    authentication?: RuntimeApiAuthenticationRequest,
    tenantId?: string,
    requestSource?: RuntimeApiRequestContext["requestSource"],
  ): RuntimeApiRequestContext {
    return Object.freeze({
      requireAuthentication: true,
      authentication,
      accessContext: callerContext,
      tenantId: tenantId?.trim() || undefined,
      requestSource: requestSource ?? "external-api",
    });
  }
}
