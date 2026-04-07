import type {
  RuntimeCancelRunRequest,
  RuntimeCancelRunResponse,
  RuntimeDequeueRequest,
  RuntimeDequeueResponse,
  RuntimeSdkResponse,
  RuntimeSdkStartExecutionRequest,
  RuntimeSdkStartExecutionResponse,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import { SystemRuntimeTransportRoutes } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import {
  parseRuntimeCancelRunResponse,
  parseRuntimeDequeueResponse,
} from "@shared/schemas/runtime/SystemRuntimeTransportSchemaContracts";
import {
  SharedApiClient,
  parseSharedApiEnvelope,
  type SharedApiEnvelope,
} from "../api/SharedApiClient";

export interface RuntimeControlClient {
  startRun(
    request: RuntimeSdkStartExecutionRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>>;
  cancelRun(
    request: RuntimeCancelRunRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeCancelRunResponse>>;
  dequeueQueueItem(
    request: RuntimeDequeueRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeDequeueResponse>>;
}

export class HttpRuntimeControlClient implements RuntimeControlClient {
  private readonly sharedApiClient: SharedApiClient;

  public constructor(baseUrl: string, options?: { readonly fetchImplementation?: typeof fetch }) {
    this.sharedApiClient = new SharedApiClient({
      baseUrl,
      fetchImplementation: options?.fetchImplementation,
    });
  }

  public async startRun(
    request: RuntimeSdkStartExecutionRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>> {
    const { workspaceId, ...body } = request;
    return await this.sharedApiClient.requestJson({
      method: "POST",
      path: `${SystemRuntimeTransportRoutes.startRun}?workspaceId=${encodeURIComponent(workspaceId)}`,
      body,
      sessionToken,
      parseResponse: (payload) => parseSharedApiEnvelope(payload) as SharedApiEnvelope<RuntimeSdkStartExecutionResponse>,
    }) as RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>;
  }

  public async cancelRun(
    request: RuntimeCancelRunRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeCancelRunResponse>> {
    const { workspaceId } = request;
    return await this.sharedApiClient.requestJson({
      method: "POST",
      path: `${SystemRuntimeTransportRoutes.cancelRun.replace(":executionId", encodeURIComponent(request.executionId))}?workspaceId=${encodeURIComponent(workspaceId)}`,
      body: {
        reason: request.reason,
        cancelledAt: request.cancelledAt,
        idempotencyKey: request.idempotencyKey,
      },
      sessionToken,
      parseResponse: (payload) => parseRuntimeCancelRunResponse(payload) as SharedApiEnvelope<RuntimeCancelRunResponse>,
    }) as RuntimeSdkResponse<RuntimeCancelRunResponse>;
  }

  public async dequeueQueueItem(
    request: RuntimeDequeueRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeDequeueResponse>> {
    const { workspaceId } = request;
    return await this.sharedApiClient.requestJson({
      method: "POST",
      path: `${SystemRuntimeTransportRoutes.dequeueQueueItem.replace(":queueItemId", encodeURIComponent(request.queueItemId))}?workspaceId=${encodeURIComponent(workspaceId)}`,
      body: {
        reason: request.reason,
        dequeuedAt: request.dequeuedAt,
        idempotencyKey: request.idempotencyKey,
      },
      sessionToken,
      parseResponse: (payload) => parseRuntimeDequeueResponse(payload) as SharedApiEnvelope<RuntimeDequeueResponse>,
    }) as RuntimeSdkResponse<RuntimeDequeueResponse>;
  }
}
