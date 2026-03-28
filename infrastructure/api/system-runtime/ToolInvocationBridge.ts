import type { ExecutionContext } from "../../../domain/system-runtime/SystemRuntimeDomain";
import type { ExecutionAccessContext } from "../../../application/system-runtime/RuntimeAccessControlService";
import type { RuntimeApiAuthenticationRequest } from "./RuntimeApiAuthentication";
import type { ExternalExecutionEnvironmentRequest } from "../../../application/system-runtime/ExecutionEnvironmentConfigurationValidator";
import {
  ExternalSystemRuntimeInterface,
  type ExternalExecutionResult,
  type ExternalExecutionStatus,
  type ExternalExecutionTraceRequest,
  type ExternalExecutionResultRequest,
  type ExternalExecutionStatusRequest,
  type ExternalExecutionRequest,
} from "./ExternalSystemRuntimeInterface";
import type { SystemRuntimeApiResponse } from "./SystemRuntimeBackendApi";

export const ExternalToolInvocationActions = Object.freeze({
  startExecution: "start-execution",
  getExecutionStatus: "get-execution-status",
  getExecutionResult: "get-execution-result",
  getExecutionTrace: "get-execution-trace",
} as const);

export type ExternalToolInvocationAction = typeof ExternalToolInvocationActions[keyof typeof ExternalToolInvocationActions];

export interface ToolInvocationContext {
  readonly protocol?: string;
  readonly providerId?: string;
  readonly callerContext?: ExecutionAccessContext;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ExternalToolInvocationRequest {
  readonly invocationId?: string;
  readonly toolName?: string;
  readonly action?: ExternalToolInvocationAction;
  readonly systemId?: string;
  readonly versionId?: string;
  readonly executionId?: string;
  readonly sessionId?: string;
  readonly async?: boolean;
  readonly inputPayload?: unknown;
  readonly inputContentType?: string;
  readonly inputSchemaVersion?: string;
  readonly context?: ExecutionContext;
  readonly callback?: ExternalExecutionRequest["callback"];
  readonly requestedEnvironment?: ExternalExecutionEnvironmentRequest;
  readonly tenantId?: string;
  readonly nodeResultLimit?: number;
  readonly diagnosticsLimit?: number;
  readonly eventLimit?: number;
  readonly logLimit?: number;
  readonly invocationContext?: ToolInvocationContext;
}

export interface ExternalToolInvocationResponse {
  readonly invocationId: string;
  readonly toolName: string;
  readonly action: ExternalToolInvocationAction;
  readonly execution: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly status?: string;
    readonly acceptedState?: "accepted" | "running";
    readonly systemId?: string;
    readonly versionId?: string;
  };
  readonly bounded: {
    readonly inputWithinLimit: boolean;
    readonly nodeResultsTruncated?: boolean;
    readonly diagnosticsTruncated?: boolean;
  };
  readonly payload: Readonly<Record<string, unknown>>;
}

function createInvocationId(): string {
  return `tool-invoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonSize(value: unknown): number {
  if (value === undefined) {
    return 0;
  }
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function toRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({});
  }
  return value as Readonly<Record<string, unknown>>;
}

export class ToolInvocationBridge {
  public constructor(
    private readonly externalRuntime: ExternalSystemRuntimeInterface,
    private readonly maxInputBytes = 64 * 1024,
  ) {}

  public async invoke(
    request: ExternalToolInvocationRequest,
  ): Promise<SystemRuntimeApiResponse<ExternalToolInvocationResponse>> {
    const action = request.action ?? ExternalToolInvocationActions.startExecution;
    const invocationId = request.invocationId?.trim() || createInvocationId();
    const toolName = request.toolName?.trim() || "system-runtime";
    if (action === ExternalToolInvocationActions.startExecution) {
      return this.startExecution(request, invocationId, toolName);
    }
    if (action === ExternalToolInvocationActions.getExecutionStatus) {
      return this.getExecutionStatus(request, invocationId, toolName);
    }
    if (action === ExternalToolInvocationActions.getExecutionResult) {
      return this.getExecutionResult(request, invocationId, toolName);
    }
    return this.getExecutionTrace(request, invocationId, toolName);
  }

  private async startExecution(
    request: ExternalToolInvocationRequest,
    invocationId: string,
    toolName: string,
  ): Promise<SystemRuntimeApiResponse<ExternalToolInvocationResponse>> {
    const payloadSize = safeJsonSize(request.inputPayload);
    if (payloadSize > this.maxInputBytes) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "invalid-request",
          message: `Tool invocation input payload exceeds ${this.maxInputBytes} bytes.`,
        }),
      });
    }

    const started = await this.externalRuntime.startExecution({
      systemId: request.systemId ?? "",
      versionId: request.versionId ?? "",
      executionId: request.executionId,
      async: request.async,
      inputPayload: request.inputPayload,
      inputContentType: request.inputContentType,
      inputSchemaVersion: request.inputSchemaVersion,
      context: request.context,
      callback: request.callback,
      requestedEnvironment: request.requestedEnvironment,
      tenantId: request.tenantId,
      callerContext: request.invocationContext?.callerContext,
      authentication: request.invocationContext?.authentication,
    });
    if (!started.ok || !started.data) {
      return started;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invocationId,
        toolName,
        action: ExternalToolInvocationActions.startExecution,
        execution: Object.freeze({
          executionId: started.data.executionId,
          sessionId: started.data.sessionId,
          status: started.data.status,
          acceptedState: started.data.acceptedState,
          systemId: started.data.systemId,
          versionId: started.data.versionId,
        }),
        bounded: Object.freeze({
          inputWithinLimit: true,
        }),
        payload: Object.freeze({
          executedVersionMap: started.data.executedVersionMap,
          executionEnvironment: started.data.executionEnvironment,
        }),
      }),
    });
  }

  private async getExecutionStatus(
    request: ExternalToolInvocationRequest,
    invocationId: string,
    toolName: string,
  ): Promise<SystemRuntimeApiResponse<ExternalToolInvocationResponse>> {
    const statusRequest: ExternalExecutionStatusRequest = Object.freeze({
      executionId: request.executionId,
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      callerContext: request.invocationContext?.callerContext,
      authentication: request.invocationContext?.authentication,
    });
    const status = await this.externalRuntime.getExecutionStatus(statusRequest);
    if (!status.ok || !status.data) {
      return status as SystemRuntimeApiResponse<ExternalToolInvocationResponse>;
    }
    return this.toStatusResponse(invocationId, toolName, status.data);
  }

  private async getExecutionResult(
    request: ExternalToolInvocationRequest,
    invocationId: string,
    toolName: string,
  ): Promise<SystemRuntimeApiResponse<ExternalToolInvocationResponse>> {
    const resultRequest: ExternalExecutionResultRequest = Object.freeze({
      executionId: request.executionId ?? "",
      nodeResultLimit: request.nodeResultLimit,
      diagnosticsLimit: request.diagnosticsLimit,
      tenantId: request.tenantId,
      callerContext: request.invocationContext?.callerContext,
      authentication: request.invocationContext?.authentication,
    });
    const result = await this.externalRuntime.getExecutionResult(resultRequest);
    if (!result.ok || !result.data) {
      return result as SystemRuntimeApiResponse<ExternalToolInvocationResponse>;
    }

    const payload = toRecord({
      outputSummary: result.data.outputSummary,
      diagnostics: result.data.diagnostics,
      serialized: result.data.serialized,
    });
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invocationId,
        toolName,
        action: ExternalToolInvocationActions.getExecutionResult,
        execution: Object.freeze({
          executionId: result.data.executionId,
          status: result.data.status,
          systemId: result.data.rootAssetId,
          versionId: result.data.rootVersionId,
        }),
        bounded: Object.freeze({
          inputWithinLimit: true,
          nodeResultsTruncated: result.data.bounded.nodeResultsTruncated,
          diagnosticsTruncated: result.data.bounded.diagnosticsTruncated,
        }),
        payload,
      }),
    });
  }

  private async getExecutionTrace(
    request: ExternalToolInvocationRequest,
    invocationId: string,
    toolName: string,
  ): Promise<SystemRuntimeApiResponse<ExternalToolInvocationResponse>> {
    const traceRequest: ExternalExecutionTraceRequest = Object.freeze({
      executionId: request.executionId ?? "",
      eventLimit: request.eventLimit,
      logLimit: request.logLimit,
      tenantId: request.tenantId,
      callerContext: request.invocationContext?.callerContext,
      authentication: request.invocationContext?.authentication,
    });
    const trace = await this.externalRuntime.getExecutionTrace(traceRequest);
    if (!trace.ok || !trace.data) {
      return trace as SystemRuntimeApiResponse<ExternalToolInvocationResponse>;
    }
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invocationId,
        toolName,
        action: ExternalToolInvocationActions.getExecutionTrace,
        execution: Object.freeze({
          executionId: trace.data.executionId,
        }),
        bounded: Object.freeze({ inputWithinLimit: true }),
        payload: toRecord({ trace: trace.data.trace }),
      }),
    });
  }

  private toStatusResponse(
    invocationId: string,
    toolName: string,
    status: ExternalExecutionStatus,
  ): SystemRuntimeApiResponse<ExternalToolInvocationResponse> {
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invocationId,
        toolName,
        action: ExternalToolInvocationActions.getExecutionStatus,
        execution: Object.freeze({
          executionId: status.executionId,
          status: status.status,
          systemId: status.rootAssetId,
          versionId: status.rootVersionId,
        }),
        bounded: Object.freeze({ inputWithinLimit: true }),
        payload: toRecord({
          progress: status.progress,
          recovery: status.recovery,
          executedVersionMap: status.executedVersionMap,
        }),
      }),
    });
  }
}
