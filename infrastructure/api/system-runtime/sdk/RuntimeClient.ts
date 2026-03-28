import type {
  RuntimeSdkAccessContext,
  RuntimeSdkAuthentication,
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
import type { RuntimeSdkTransport, RuntimeSdkTransportRequestContext } from "./RuntimeSdkTransport";

export interface RuntimeClientOptions {
  readonly transport: RuntimeSdkTransport;
  readonly authentication?: RuntimeSdkAuthentication;
  readonly accessContext?: RuntimeSdkAccessContext;
}

function mergeContext(
  defaults: Pick<RuntimeClientOptions, "authentication" | "accessContext">,
  overrides?: RuntimeSdkTransportRequestContext,
): RuntimeSdkTransportRequestContext {
  return Object.freeze({
    authentication: overrides?.authentication ?? defaults.authentication,
    accessContext: overrides?.accessContext ?? defaults.accessContext,
  });
}

export class RuntimeClient {
  private readonly transport: RuntimeSdkTransport;
  private readonly defaultContext: RuntimeSdkTransportRequestContext;

  public constructor(options: RuntimeClientOptions) {
    this.transport = options.transport;
    this.defaultContext = Object.freeze({
      authentication: options.authentication,
      accessContext: options.accessContext,
    });
  }

  public startExecution(
    request: RuntimeSdkStartExecutionRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>> {
    return this.transport.startExecution(request, mergeContext(this.defaultContext, context));
  }

  public getExecutionStatus(
    request: RuntimeSdkExecutionStatusRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>> {
    return this.transport.getExecutionStatus(request, mergeContext(this.defaultContext, context));
  }

  public getExecutionResult(
    request: RuntimeSdkExecutionResultRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>> {
    return this.transport.getExecutionResult(request, mergeContext(this.defaultContext, context));
  }

  public getExecutionTrace(
    request: RuntimeSdkExecutionTraceRequest,
    context?: RuntimeSdkTransportRequestContext,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>> {
    return this.transport.getExecutionTrace(request, mergeContext(this.defaultContext, context));
  }
}
