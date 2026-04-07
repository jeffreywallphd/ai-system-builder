import type {
  RuntimeCancelRunRequest,
  RuntimeCancelRunResponse,
  RuntimeDequeueRequest,
  RuntimeDequeueResponse,
  RuntimeQueueListRequest,
  RuntimeQueueListResponse,
  RuntimeSdkResponse,
  RuntimeSdkExecutionResultRequest,
  RuntimeSdkExecutionResultResponse,
  RuntimeSdkExecutionStatusRequest,
  RuntimeSdkExecutionStatusResponse,
  RuntimeSdkStartExecutionRequest,
  RuntimeSdkStartExecutionResponse,
  RuntimeSdkExecutionTraceRequest,
  RuntimeSdkExecutionTraceResponse,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import { SystemRuntimeTransportRoutes } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import {
  parseRuntimeCancelRunResponse,
  parseRuntimeQueueListResponse,
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
  getRunStatus(
    request: RuntimeSdkExecutionStatusRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>>;
  getRunResult(
    request: RuntimeSdkExecutionResultRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>>;
  getRunTrace(
    request: RuntimeSdkExecutionTraceRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>>;
  listQueueItems(
    request: RuntimeQueueListRequest,
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeQueueListResponse>>;
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

  public async getRunStatus(
    request: RuntimeSdkExecutionStatusRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>> {
    const { workspaceId, executionId } = request;
    return await this.sharedApiClient.requestJson({
      method: "GET",
      path: `${SystemRuntimeTransportRoutes.getRunStatus.replace(":executionId", encodeURIComponent(executionId ?? ""))}?workspaceId=${encodeURIComponent(workspaceId)}`,
      sessionToken,
      parseResponse: (payload) => parseSharedApiEnvelope(payload) as SharedApiEnvelope<RuntimeSdkExecutionStatusResponse>,
    }) as RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>;
  }

  public async getRunResult(
    request: RuntimeSdkExecutionResultRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>> {
    const { workspaceId, executionId, nodeResultLimit, diagnosticsLimit } = request;
    const query = new URLSearchParams();
    query.set("workspaceId", workspaceId);
    if (nodeResultLimit !== undefined) {
      query.set("nodeResultLimit", nodeResultLimit.toString());
    }
    if (diagnosticsLimit !== undefined) {
      query.set("diagnosticsLimit", diagnosticsLimit.toString());
    }
    return await this.sharedApiClient.requestJson({
      method: "GET",
      path: `${SystemRuntimeTransportRoutes.getRunResult.replace(":executionId", encodeURIComponent(executionId))}?${query.toString()}`,
      sessionToken,
      parseResponse: (payload) => parseSharedApiEnvelope(payload) as SharedApiEnvelope<RuntimeSdkExecutionResultResponse>,
    }) as RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>;
  }

  public async getRunTrace(
    request: RuntimeSdkExecutionTraceRequest & { readonly workspaceId: string },
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>> {
    const { workspaceId, executionId, eventLimit, logLimit } = request;
    const query = new URLSearchParams();
    query.set("workspaceId", workspaceId);
    if (eventLimit !== undefined) {
      query.set("eventLimit", eventLimit.toString());
    }
    if (logLimit !== undefined) {
      query.set("logLimit", logLimit.toString());
    }
    return await this.sharedApiClient.requestJson({
      method: "GET",
      path: `${SystemRuntimeTransportRoutes.getRunTrace.replace(":executionId", encodeURIComponent(executionId))}?${query.toString()}`,
      sessionToken,
      parseResponse: (payload) => parseSharedApiEnvelope(payload) as SharedApiEnvelope<RuntimeSdkExecutionTraceResponse>,
    }) as RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>;
  }

  public async listQueueItems(
    request: RuntimeQueueListRequest,
    sessionToken: string,
  ): Promise<RuntimeSdkResponse<RuntimeQueueListResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    if (request.systemId) {
      query.set("systemId", request.systemId);
    }
    if (request.tenantId) {
      query.set("tenantId", request.tenantId);
    }
    if (request.limit !== undefined) {
      query.set("limit", request.limit.toString());
    }
    if (request.offset !== undefined) {
      query.set("offset", request.offset.toString());
    }
    for (const status of request.statuses ?? []) {
      query.append("status", status);
    }
    return await this.sharedApiClient.requestJson({
      method: "GET",
      path: `${SystemRuntimeTransportRoutes.listQueueItems}?${query.toString()}`,
      sessionToken,
      parseResponse: (payload) => parseRuntimeQueueListResponse(payload) as SharedApiEnvelope<RuntimeQueueListResponse>,
    }) as RuntimeSdkResponse<RuntimeQueueListResponse>;
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
