import type { ExecutionContext } from "../../../domain/system-runtime/SystemRuntimeDomain";
import type { ExecutionAccessContext } from "../../../application/system-runtime/RuntimeAccessControlService";
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
}

export interface ExternalExecutionTraceRequest extends GetSystemRuntimeExecutionTraceRequest {
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
}

export interface ExternalExecutionStatusRequest {
  readonly executionId?: string;
  readonly sessionId?: string;
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
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

export class ExternalSystemRuntimeInterface {
  public constructor(private readonly runtimeApi: SystemRuntimeBackendApi) {}

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

      const started = request.async
        ? await this.runtimeApi.startExecutionAsync({
          versionId,
          systemId,
          executionId: request.executionId,
          inputPayload: request.inputPayload,
          inputContentType: request.inputContentType,
          inputSchemaVersion: request.inputSchemaVersion,
          context: request.context,
          accessContext: request.callerContext,
          requestContext: {
            requireAuthentication: true,
            authentication: request.authentication,
            accessContext: request.callerContext,
          },
          callback: request.callback,
        })
        : await this.runtimeApi.startExecution({
        versionId,
        systemId,
        executionId: request.executionId,
        inputPayload: request.inputPayload,
        inputContentType: request.inputContentType,
        inputSchemaVersion: request.inputSchemaVersion,
        context: request.context,
        accessContext: request.callerContext,
        requestContext: {
          requireAuthentication: true,
          authentication: request.authentication,
          accessContext: request.callerContext,
        },
        callback: request.callback,
      });

      if (!started.ok || !started.data) {
        return started;
      }

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          executionId: started.data.executionId,
          sessionId: started.data.sessionId,
          status: started.data.status,
          acceptedState: "acceptedState" in started.data ? started.data.acceptedState : undefined,
          systemId,
          versionId,
          executedVersionMap: started.data.executedVersionMap,
        }),
      });
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
      });
    }
    const poll = await this.runtimeApi.pollExecution({
      sessionId: normalized.sessionId,
      requestContext: {
        requireAuthentication: true,
        authentication: normalized.authentication,
        accessContext: normalized.callerContext,
      },
    });
    if (!poll.ok || !poll.data) {
      return poll as SystemRuntimeApiResponse<ExternalExecutionStatus>;
    }
    return this.runtimeApi.getExecutionStatus(poll.data.executionId, {
      requireAuthentication: true,
      authentication: normalized.authentication,
      accessContext: normalized.callerContext,
    });
  }

  public async pollExecution(request: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly callerContext?: ExecutionAccessContext;
    readonly authentication?: RuntimeApiAuthenticationRequest;
  }): Promise<SystemRuntimeApiResponse<ExecutionPollResponse>> {
    return this.runtimeApi.pollExecution({
      executionId: request.executionId,
      sessionId: request.sessionId,
      requestContext: {
        requireAuthentication: true,
        authentication: request.authentication,
        accessContext: request.callerContext,
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
      },
    });
  }

  public async registerExecutionCallback(request: {
    readonly sessionId?: string;
    readonly executionId?: string;
    readonly callback: ExecutionCallbackRegistrationRequest;
    readonly callerContext?: ExecutionAccessContext;
    readonly authentication?: RuntimeApiAuthenticationRequest;
  }): Promise<SystemRuntimeApiResponse<ExecutionCallbackRegistration>> {
    return this.runtimeApi.registerExecutionCallback({
      sessionId: request.sessionId,
      executionId: request.executionId,
      callback: request.callback,
      requestContext: this.toRequestContext(request.callerContext, request.authentication),
    });
  }

  public subscribeToExecutionUpdates(request: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly eventKinds?: ReadonlyArray<ExecutionUpdateEventKind>;
    readonly callerContext?: ExecutionAccessContext;
    readonly authentication?: RuntimeApiAuthenticationRequest;
    readonly listener: (event: ExecutionUpdateEvent) => void;
  }): SystemRuntimeApiResponse<ExecutionUpdateSubscription> {
    return this.runtimeApi.subscribeToExecutionUpdates({
      executionId: request.executionId,
      sessionId: request.sessionId,
      eventKinds: request.eventKinds,
      requestContext: this.toRequestContext(request.callerContext, request.authentication),
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
  ): RuntimeApiRequestContext {
    return Object.freeze({
      requireAuthentication: true,
      authentication,
      accessContext: callerContext,
    });
  }
}
