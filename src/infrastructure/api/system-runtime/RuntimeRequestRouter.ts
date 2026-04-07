import type { StartSystemRuntimeExecutionRequest, SystemRuntimeApiResponse } from "./SystemRuntimeBackendApi";
import type {
  ExternalExecutionRequest,
  ExternalExecutionResultRequest,
  ExternalExecutionStatusRequest,
  ExternalExecutionTraceRequest,
} from "./ExternalSystemRuntimeInterface";
import { ExternalSystemRuntimeInterface } from "./ExternalSystemRuntimeInterface";
import { SystemRuntimeBackendApi } from "./SystemRuntimeBackendApi";
import {
  ToolInvocationBridge,
  type ExternalToolInvocationRequest,
  type ExternalToolInvocationResponse,
} from "./ToolInvocationBridge";

export const RuntimeRequestSources = Object.freeze({
  studioShellInternal: "studio-shell-internal",
  externalApi: "external-api",
  externalTool: "external-tool",
} as const);

export type RuntimeRequestSource = typeof RuntimeRequestSources[keyof typeof RuntimeRequestSources];

export type RoutedRuntimeRequest =
  | {
    readonly source: typeof RuntimeRequestSources.studioShellInternal;
    readonly operation: "start-execution" | "get-execution-status" | "get-execution-result" | "get-execution-trace";
    readonly request:
      | (StartSystemRuntimeExecutionRequest & { readonly requestContext?: Parameters<SystemRuntimeBackendApi["startExecution"]>[0]["requestContext"] })
      | { readonly executionId: string; readonly requestContext?: Parameters<SystemRuntimeBackendApi["getExecutionStatus"]>[1] }
      | { readonly executionId: string; readonly requestContext?: Parameters<SystemRuntimeBackendApi["getExecutionResult"]>[1] }
      | (Parameters<SystemRuntimeBackendApi["getExecutionTrace"]>[0]);
  }
  | {
    readonly source: typeof RuntimeRequestSources.externalApi;
    readonly operation: "start-execution" | "get-execution-status" | "get-execution-result" | "get-execution-trace";
    readonly request: ExternalExecutionRequest | ExternalExecutionStatusRequest | ExternalExecutionResultRequest | ExternalExecutionTraceRequest;
  }
  | {
    readonly source: typeof RuntimeRequestSources.externalTool;
    readonly operation: "invoke-tool";
    readonly request: ExternalToolInvocationRequest;
  };

export interface RuntimeRequestDispatchResult<T = unknown> {
  readonly source: RuntimeRequestSource;
  readonly operation: RoutedRuntimeRequest["operation"];
  readonly response: SystemRuntimeApiResponse<T>;
}

export class RuntimeRequestRouter {
  private readonly externalInterface: ExternalSystemRuntimeInterface;
  private readonly toolBridge: ToolInvocationBridge;

  public constructor(private readonly backendApi: SystemRuntimeBackendApi) {
    this.externalInterface = new ExternalSystemRuntimeInterface(backendApi);
    this.toolBridge = new ToolInvocationBridge(this.externalInterface);
  }

  public async dispatch(request: RoutedRuntimeRequest): Promise<RuntimeRequestDispatchResult> {
    if (request.source === RuntimeRequestSources.studioShellInternal) {
      return this.dispatchInternal(request);
    }
    if (request.source === RuntimeRequestSources.externalApi) {
      return this.dispatchExternal(request);
    }
    const response = await this.toolBridge.invoke(request.request);
    return Object.freeze({
      source: request.source,
      operation: request.operation,
      response,
    });
  }

  private async dispatchInternal(
    request: Extract<RoutedRuntimeRequest, { readonly source: typeof RuntimeRequestSources.studioShellInternal }>,
  ): Promise<RuntimeRequestDispatchResult> {
    const context = request.request as { readonly requestContext?: Parameters<SystemRuntimeBackendApi["startExecution"]>[0]["requestContext"] };
    const internalRequestContext = Object.freeze({
      trustedInternal: true,
      trustedInternalAuthorization: Object.freeze({
        actorMode: "system-action" as const,
        systemActionId: "studio-shell-internal-router",
      }),
      requestSource: RuntimeRequestSources.studioShellInternal,
      ...(context.requestContext ?? {}),
    });
    if (request.operation === "start-execution") {
      const response = await this.backendApi.startExecution({
        ...(request.request as StartSystemRuntimeExecutionRequest),
        requestContext: internalRequestContext,
      });
      return Object.freeze({ source: request.source, operation: request.operation, response });
    }
    if (request.operation === "get-execution-status") {
      const statusRequest = request.request as { readonly executionId: string };
      const response = await this.backendApi.getExecutionStatus(statusRequest.executionId, internalRequestContext);
      return Object.freeze({ source: request.source, operation: request.operation, response });
    }
    if (request.operation === "get-execution-result") {
      const resultRequest = request.request as { readonly executionId: string };
      const response = await this.backendApi.getExecutionResult(resultRequest.executionId, internalRequestContext);
      return Object.freeze({ source: request.source, operation: request.operation, response });
    }

    const response = await this.backendApi.getExecutionTrace({
      ...(request.request as Parameters<SystemRuntimeBackendApi["getExecutionTrace"]>[0]),
      requestContext: internalRequestContext,
    });
    return Object.freeze({ source: request.source, operation: request.operation, response });
  }

  private async dispatchExternal(
    request: Extract<RoutedRuntimeRequest, { readonly source: typeof RuntimeRequestSources.externalApi }>,
  ): Promise<RuntimeRequestDispatchResult> {
    if (request.operation === "start-execution") {
      const response = await this.externalInterface.startExecution(request.request as ExternalExecutionRequest);
      return Object.freeze({ source: request.source, operation: request.operation, response });
    }
    if (request.operation === "get-execution-status") {
      const response = await this.externalInterface.getExecutionStatus(request.request as ExternalExecutionStatusRequest);
      return Object.freeze({ source: request.source, operation: request.operation, response });
    }
    if (request.operation === "get-execution-result") {
      const response = await this.externalInterface.getExecutionResult(request.request as ExternalExecutionResultRequest);
      return Object.freeze({ source: request.source, operation: request.operation, response });
    }

    const response = await this.externalInterface.getExecutionTrace(request.request as ExternalExecutionTraceRequest);
    return Object.freeze({ source: request.source, operation: request.operation, response });
  }

  public getExternalInterface(): ExternalSystemRuntimeInterface {
    return this.externalInterface;
  }

  public getToolBridge(): ToolInvocationBridge {
    return this.toolBridge;
  }
}

export type {
  ExternalToolInvocationRequest,
  ExternalToolInvocationResponse,
};
