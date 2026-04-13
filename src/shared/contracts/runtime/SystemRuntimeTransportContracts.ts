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
import type { SharedApiMutationResult } from "@shared/contracts/api/SharedApiContractPrimitives";
import type { RuntimeAvailabilityResponseContract } from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";
import {
  type ExecutionReadinessNodeAvailabilitySummary,
  RunOrchestrationTransportRoutes,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

/*
  Migration note (Story 16.1.2):
  Canonical run submission/mutation/status contracts now live in
  `RunOrchestrationTransportContracts.ts`. This module remains the compatibility
  facade for existing runtime-sdk consumers until endpoint migration completes.
*/

export type * from "@infrastructure/api/system-runtime/sdk/PublicExternalRuntimeSdkContract";
export type * from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
export type * from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";

export const SystemRuntimeTransportRoutes = Object.freeze({
  startRun: RunOrchestrationTransportRoutes.submitRun,
  cancelRun: RunOrchestrationTransportRoutes.cancelRun,
  getRunStatus: RunOrchestrationTransportRoutes.getRunStatus,
  getExecutionReadiness: RunOrchestrationTransportRoutes.getExecutionReadiness,
  getRunResult: "/api/v1/runtime/runs/:executionId/result",
  getRunTrace: "/api/v1/runtime/runs/:executionId/trace",
  listQueueItems: RunOrchestrationTransportRoutes.listQueueStatus,
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
  readonly idempotencyKey?: string;
}

export interface RuntimeDequeueResponse {
  readonly queueItemId: string;
  readonly executionId: string;
  readonly status: RuntimeQueueItemStatus;
  readonly mutation: SharedApiMutationResult;
}

/*
  Deprecated compatibility DTO: prefer RunCancellationRequest from
  RunOrchestrationTransportContracts.
*/
export interface RuntimeCancelRunRequest {
  readonly executionId: string;
  readonly reason?: string;
  readonly cancelledAt?: string;
  readonly idempotencyKey?: string;
}

export interface RuntimeCancelRunResponse {
  readonly executionId: string;
  readonly status: RuntimeSdkExecutionStatusResponse["status"];
  readonly mutation: SharedApiMutationResult;
}

export interface RuntimeExecutionReadinessRequest {
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}

export interface RuntimeExecutionReadinessResponse {
  readonly backendFamily: string;
  readonly checkedAt: string;
  readonly readiness: "ready" | "degraded" | "unavailable";
  readonly readyForExecution: boolean;
  readonly runtimeLifecycle?: RuntimeAvailabilityResponseContract;
  readonly message?: string;
  readonly capabilities: {
    readonly backendFamily: string;
    readonly supportsProgressPolling: boolean;
    readonly supportsProgressStreaming: boolean;
    readonly supportsCancellation: boolean;
    readonly supportsOutputDiscovery: boolean;
    readonly supportedOperationKinds: ReadonlyArray<string>;
    readonly supportedTranslationContractVersions: ReadonlyArray<string>;
  };
  readonly nodeAvailability?: RuntimeExecutionReadinessNodeAvailabilitySummary;
  readonly issues: ReadonlyArray<{
    readonly code: string;
    readonly severity: "error" | "warning";
    readonly message: string;
  }>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export type RuntimeExecutionReadinessNodeAvailabilitySummary =
  ExecutionReadinessNodeAvailabilitySummary;

export interface SystemRuntimeTransportContract {
  readonly startRun: {
    readonly request: RuntimeSdkStartExecutionRequest;
    readonly response: RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>;
  };
  readonly cancelRun: {
    readonly request: RuntimeCancelRunRequest;
    readonly response: RuntimeSdkResponse<RuntimeCancelRunResponse>;
  };
  readonly getRunStatus: {
    readonly request: RuntimeSdkExecutionStatusRequest;
    readonly response: RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>;
  };
  readonly getExecutionReadiness: {
    readonly request: RuntimeExecutionReadinessRequest;
    readonly response: RuntimeSdkResponse<RuntimeExecutionReadinessResponse>;
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
