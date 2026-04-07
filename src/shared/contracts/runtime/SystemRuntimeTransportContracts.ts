import type {
  RuntimeSdkError,
  RuntimeSdkExecutionResultRequest,
  RuntimeSdkExecutionResultResponse,
  RuntimeSdkExecutionStatusRequest,
  RuntimeSdkExecutionStatusResponse,
  RuntimeSdkExecutionTraceRequest,
  RuntimeSdkExecutionTraceResponse,
  RuntimeSdkResponse,
  RuntimeSdkStartExecutionRequest,
  RuntimeSdkStartExecutionResponse,
} from "@infrastructure/api/system-runtime/sdk/PublicExternalRuntimeSdkContract";
export type * from "@infrastructure/api/system-runtime/sdk/PublicExternalRuntimeSdkContract";

export const SystemRuntimeTransportRoutes = Object.freeze({
  startRun: "/api/v1/runtime/runs/start",
  getRunStatus: "/api/v1/runtime/runs/:executionId/status",
  getRunResult: "/api/v1/runtime/runs/:executionId/result",
  getRunTrace: "/api/v1/runtime/runs/:executionId/trace",
  listQueueItems: "/api/v1/runtime/queue",
  dequeueQueueItem: "/api/v1/runtime/queue/:queueItemId/dequeue",
  subscribeRealtime: "/api/v1/runtime/realtime",
} as const);

export const RuntimeQueueItemStatuses = Object.freeze({
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
} as const);

export type RuntimeQueueItemStatus =
  typeof RuntimeQueueItemStatuses[keyof typeof RuntimeQueueItemStatuses];

export interface RuntimeQueueListRequest {
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly tenantId?: string;
  readonly statuses?: ReadonlyArray<RuntimeQueueItemStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RuntimeQueueItem {
  readonly queueItemId: string;
  readonly executionId: string;
  readonly systemId: string;
  readonly status: RuntimeQueueItemStatus;
  readonly enqueuedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly priority?: number;
}

export interface RuntimeQueueListResponse {
  readonly items: ReadonlyArray<RuntimeQueueItem>;
  readonly totalCount: number;
}

export interface RuntimeDequeueRequest {
  readonly queueItemId: string;
  readonly reason?: string;
  readonly dequeuedAt?: string;
}

export interface RuntimeDequeueResponse {
  readonly queueItemId: string;
  readonly changed: boolean;
}

export interface SystemRuntimeTransportContract {
  readonly startRun: {
    readonly request: RuntimeSdkStartExecutionRequest;
    readonly response: RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>;
  };
  readonly getRunStatus: {
    readonly request: RuntimeSdkExecutionStatusRequest;
    readonly response: RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>;
  };
  readonly getRunResult: {
    readonly request: RuntimeSdkExecutionResultRequest;
    readonly response: RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>;
  };
  readonly getRunTrace: {
    readonly request: RuntimeSdkExecutionTraceRequest;
    readonly response: RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>;
  };
  readonly listQueueItems: {
    readonly request: RuntimeQueueListRequest;
    readonly response: RuntimeSdkResponse<RuntimeQueueListResponse>;
  };
  readonly dequeueQueueItem: {
    readonly request: RuntimeDequeueRequest;
    readonly response: RuntimeSdkResponse<RuntimeDequeueResponse>;
  };
}

export type SystemRuntimeTransportError = RuntimeSdkError;
