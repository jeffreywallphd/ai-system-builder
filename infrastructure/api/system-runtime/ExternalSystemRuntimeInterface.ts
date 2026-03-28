import type { ExecutionContext } from "../../../domain/system-runtime/SystemRuntimeDomain";
import type { ExecutionAccessContext } from "../../../application/system-runtime/RuntimeAccessControlService";
import {
  type GetSystemRuntimeExecutionResultRequest,
  type GetSystemRuntimeExecutionTraceRequest,
  type RuntimeExecutionResultReadModel,
  type RuntimeExecutionStatusReadModel,
  type RuntimeExecutionTraceReadModel,
  SystemRuntimeBackendApi,
  type SystemRuntimeApiResponse,
} from "./SystemRuntimeBackendApi";
import type { RuntimeApiAuthenticationRequest } from "./RuntimeApiAuthentication";

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
}

export interface ExternalExecutionResponse {
  readonly executionId: string;
  readonly status: RuntimeExecutionStatusReadModel["status"];
  readonly systemId: string;
  readonly versionId: string;
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
}

export interface ExternalExecutionStatus extends RuntimeExecutionStatusReadModel {}

export interface ExternalExecutionResult extends RuntimeExecutionResultReadModel {
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
  readonly executionId: string;
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

      const started = await this.runtimeApi.startExecution({
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
      });

      if (!started.ok || !started.data) {
        return started;
      }

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          executionId: started.data.executionId,
          status: started.data.status,
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
    return this.runtimeApi.getExecutionStatus(normalized.executionId, {
      requireAuthentication: true,
      authentication: normalized.authentication,
      accessContext: normalized.callerContext,
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

  private toApiError(error: unknown): { readonly code: "invalid-request" | "internal"; readonly message: string } {
    const message = error instanceof Error ? error.message : "Unexpected external runtime interface error.";
    if (message.startsWith("invalid-request:")) {
      return Object.freeze({ code: "invalid-request", message: message.slice("invalid-request:".length) });
    }
    return Object.freeze({ code: "internal", message });
  }
}
