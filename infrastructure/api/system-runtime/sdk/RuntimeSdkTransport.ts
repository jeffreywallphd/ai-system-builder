import type { ExecutionAccessContext } from "../../../../application/system-runtime/RuntimeAccessControlService";
import type {
  ExecutionCallbackRegistrationRequest,
} from "../SystemRuntimeBackendApi";
import type {
  ExternalExecutionRequest,
  ExternalExecutionResultRequest,
  ExternalExecutionStatusRequest,
  ExternalExecutionTraceRequest,
  ExternalSystemRuntimeInterface,
} from "../ExternalSystemRuntimeInterface";
import type { RuntimeApiAuthenticationRequest } from "../RuntimeApiAuthentication";
import type { SystemRuntimeApiError, SystemRuntimeApiResponse } from "../SystemRuntimeBackendApi";
import type {
  RuntimeSdkAccessContext,
  RuntimeSdkAuthentication,
  RuntimeSdkCallbackRegistration,
  RuntimeSdkExecutionResultRequest,
  RuntimeSdkExecutionResultResponse,
  RuntimeSdkExecutionStatusRequest,
  RuntimeSdkExecutionStatusResponse,
  RuntimeSdkExecutionTraceRequest,
  RuntimeSdkExecutionTraceResponse,
  RuntimeSdkResponse,
  RuntimeSdkStartExecutionRequest,
  RuntimeSdkStartExecutionResponse,
} from "./PublicExternalRuntimeSdkContract";

export interface RuntimeSdkTransportRequestContext {
  readonly authentication?: RuntimeSdkAuthentication;
  readonly accessContext?: RuntimeSdkAccessContext;
}

export interface RuntimeSdkTransport {
  startExecution(
    request: RuntimeSdkStartExecutionRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>>;
  getExecutionStatus(
    request: RuntimeSdkExecutionStatusRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>>;
  getExecutionResult(
    request: RuntimeSdkExecutionResultRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>>;
  getExecutionTrace(
    request: RuntimeSdkExecutionTraceRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>>;
}

function toAuthentication(request?: RuntimeSdkAuthentication): RuntimeApiAuthenticationRequest | undefined {
  if (!request?.bearerToken?.trim()) {
    return undefined;
  }
  return Object.freeze({ bearerToken: request.bearerToken.trim() });
}

function toExecutionAccessContext(context?: RuntimeSdkAccessContext): ExecutionAccessContext | undefined {
  if (!context) {
    return undefined;
  }
  return Object.freeze({
    callerKind: context.callerKind,
    callerId: context.callerId,
    roles: context.roles,
    metadata: {
      ...(context.metadata ?? {}),
      ...(context.tenantId?.trim() ? { tenantId: context.tenantId.trim() } : {}),
    },
  });
}

function toCallback(request?: RuntimeSdkCallbackRegistration): ExecutionCallbackRegistrationRequest | undefined {
  if (!request) {
    return undefined;
  }
  return Object.freeze({
    callbackId: request.callbackId,
    targetUrl: request.targetUrl,
    eventKinds: request.eventKinds,
    secretToken: request.secretToken,
    includeResultSummary: request.includeResultSummary,
    headers: request.headers,
    maxAttempts: request.maxAttempts,
  });
}

function toSdkResponse<T>(response: SystemRuntimeApiResponse<T>): RuntimeSdkResponse<T> {
  if (response.ok) {
    return Object.freeze({
      ok: true,
      data: response.data,
    });
  }
  return Object.freeze({
    ok: false,
    error: toPublicError(response.error),
  });
}

function toPublicError(error?: SystemRuntimeApiError): RuntimeSdkResponse<never>["error"] {
  if (!error) {
    return Object.freeze({ code: "internal", message: "Unknown runtime SDK transport error." });
  }
  return Object.freeze({
    code: error.code,
    message: error.message,
    validationErrors: error.validationErrors,
  });
}

export class ExternalInterfaceRuntimeSdkTransport implements RuntimeSdkTransport {
  public constructor(private readonly externalRuntime: ExternalSystemRuntimeInterface) {}

  public async startExecution(
    request: RuntimeSdkStartExecutionRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>> {
    const mapped: ExternalExecutionRequest = Object.freeze({
      systemId: request.systemId,
      versionId: request.versionId,
      executionId: request.executionId,
      async: request.async,
      inputPayload: request.inputPayload,
      inputContentType: request.inputContentType,
      inputSchemaVersion: request.inputSchemaVersion,
      context: request.context,
      callback: toCallback(request.callback),
      requestedEnvironment: request.environment
        ? {
          environmentId: request.environment.environmentId,
          environmentKind: request.environment.environmentKind,
          environmentRef: request.environment.environmentRef,
        }
        : undefined,
      tenantId: request.tenantId,
      idempotencyKey: request.idempotencyKey,
      authentication: toAuthentication(context?.authentication),
      callerContext: toExecutionAccessContext(context?.accessContext),
      requestSource: "external-api",
    });
    const response = await this.externalRuntime.startExecution(mapped);
    return toSdkResponse(response);
  }

  public async getExecutionStatus(
    request: RuntimeSdkExecutionStatusRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>> {
    const mapped: ExternalExecutionStatusRequest = Object.freeze({
      executionId: request.executionId,
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      idempotencyKey: request.idempotencyKey,
      authentication: toAuthentication(context?.authentication),
      callerContext: toExecutionAccessContext(context?.accessContext),
      requestSource: "external-api",
    });
    const response = await this.externalRuntime.getExecutionStatus(mapped);
    return toSdkResponse(response);
  }

  public async getExecutionResult(
    request: RuntimeSdkExecutionResultRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>> {
    const mapped: ExternalExecutionResultRequest = Object.freeze({
      executionId: request.executionId,
      nodeResultLimit: request.nodeResultLimit,
      diagnosticsLimit: request.diagnosticsLimit,
      tenantId: request.tenantId,
      idempotencyKey: request.idempotencyKey,
      authentication: toAuthentication(context?.authentication),
      callerContext: toExecutionAccessContext(context?.accessContext),
      requestSource: "external-api",
    });
    const response = await this.externalRuntime.getExecutionResult(mapped);
    return toSdkResponse(response);
  }

  public async getExecutionTrace(
    request: RuntimeSdkExecutionTraceRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>> {
    const mapped: ExternalExecutionTraceRequest = Object.freeze({
      executionId: request.executionId,
      eventLimit: request.eventLimit,
      logLimit: request.logLimit,
      tenantId: request.tenantId,
      idempotencyKey: request.idempotencyKey,
      authentication: toAuthentication(context?.authentication),
      callerContext: toExecutionAccessContext(context?.accessContext),
      requestSource: "external-api",
    });
    const response = await this.externalRuntime.getExecutionTrace(mapped);
    return toSdkResponse(response);
  }
}
