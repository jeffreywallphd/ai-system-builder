/* MIGRATION NOTE: prefer importing shared transport contracts from src/shared/contracts/* for new work. This SDK contract remains for compatibility during convergence. */
export const RuntimeSdkErrorCodes = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  invalidRequest: "invalid-request",
  notFound: "not-found",
  quotaExceeded: "quota-exceeded",
  rateLimitExceeded: "rate-limit-exceeded",
  internal: "internal",
} as const);

export type RuntimeSdkErrorCode = typeof RuntimeSdkErrorCodes[keyof typeof RuntimeSdkErrorCodes];

export interface RuntimeSdkValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeSdkError {
  readonly code: RuntimeSdkErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<RuntimeSdkValidationError>;
}

export interface RuntimeSdkResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: RuntimeSdkError;
}

export interface RuntimeSdkAuthentication {
  readonly bearerToken?: string;
}

export interface RuntimeSdkAccessContext {
  readonly callerKind: "user" | "service" | "tool";
  readonly callerId: string;
  readonly roles?: ReadonlyArray<string>;
  readonly tenantId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface RuntimeSdkExecutionContext {
  readonly invocationId?: string;
  readonly trigger?: "manual" | "scheduled" | "event" | "api";
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RuntimeSdkCallbackRegistration {
  readonly callbackId?: string;
  readonly targetUrl: string;
  readonly eventKinds?: ReadonlyArray<"execution-accepted" | "execution-completed" | "execution-failed">;
  readonly secretToken?: string;
  readonly includeResultSummary?: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly maxAttempts?: number;
}

export interface RuntimeSdkEnvironmentSelection {
  readonly environmentId?: string;
  readonly environmentKind?: "local" | "managed" | "remote";
  readonly environmentRef?: {
    readonly provider?: string;
    readonly region?: string;
    readonly labels?: ReadonlyArray<string>;
  };
}

export interface RuntimeSdkStartExecutionRequest {
  readonly systemId: string;
  readonly versionId: string;
  readonly executionId?: string;
  readonly async?: boolean;
  readonly inputPayload?: unknown;
  readonly inputContentType?: string;
  readonly inputSchemaVersion?: string;
  readonly context?: RuntimeSdkExecutionContext;
  readonly callback?: RuntimeSdkCallbackRegistration;
  readonly environment?: RuntimeSdkEnvironmentSelection;
  readonly tenantId?: string;
  readonly idempotencyKey?: string;
}

export interface RuntimeSdkStartExecutionResponse {
  readonly executionId: string;
  readonly sessionId?: string;
  readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  readonly acceptedState?: "accepted" | "running";
  readonly systemId: string;
  readonly versionId: string;
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly executionEnvironment?: {
    readonly environmentId: string;
    readonly environmentKind?: string;
    readonly provider?: string;
    readonly region?: string;
    readonly labels?: ReadonlyArray<string>;
  };
  readonly nestedExecutionLineage: ReadonlyArray<{
    readonly executionId: string;
    readonly parentExecutionId?: string;
    readonly parentNodeId?: string;
    readonly rootAssetId: string;
    readonly rootVersionId?: string;
    readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
    readonly startedAt: string;
    readonly completedAt?: string;
  }>;
}

export interface RuntimeSdkExecutionStatusRequest {
  readonly executionId?: string;
  readonly sessionId?: string;
  readonly tenantId?: string;
  readonly idempotencyKey?: string;
}

export interface RuntimeSdkExecutionStatusResponse {
  readonly executionId: string;
  readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly progress: {
    readonly totalNodeCount: number;
    readonly completedNodeCount: number;
    readonly failedNodeCount: number;
    readonly runningNodeCount: number;
    readonly updatedAt: string;
  };
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly nestedExecutionLineage: RuntimeSdkStartExecutionResponse["nestedExecutionLineage"];
}

export interface RuntimeSdkExecutionResultRequest {
  readonly executionId: string;
  readonly nodeResultLimit?: number;
  readonly diagnosticsLimit?: number;
  readonly tenantId?: string;
  readonly idempotencyKey?: string;
}

export interface RuntimeSdkExecutionResultResponse {
  readonly executionId: string;
  readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  readonly output?: unknown;
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly completedAt?: string;
  readonly diagnostics: ReadonlyArray<{
    readonly source: "output" | "runtime-error" | "trace-log";
    readonly severity: "info" | "warning" | "error";
    readonly code?: string;
    readonly message: string;
    readonly nodeId?: string;
    readonly at?: string;
  }>;
  readonly outputSummary: {
    readonly hasOutput: boolean;
    readonly hasError: boolean;
    readonly outputFieldCount: number;
    readonly contractOutputIds: ReadonlyArray<string>;
  };
  readonly bounded: {
    readonly nodeResultsTruncated: boolean;
    readonly diagnosticsTruncated: boolean;
  };
  readonly serialized: {
    readonly identity: {
      readonly executionId: string;
      readonly status: string;
      readonly rootAssetId: string;
      readonly rootVersionId?: string;
      readonly startedAt: string;
      readonly completedAt?: string;
    };
    readonly summary: {
      readonly hasOutput: boolean;
      readonly hasError: boolean;
      readonly outputFieldCount: number;
      readonly contractOutputIds: ReadonlyArray<string>;
      readonly diagnosticsCount: number;
      readonly nodeResultCount: number;
      readonly nestedSystemResultCount: number;
    };
  };
}

export interface RuntimeSdkExecutionTraceRequest {
  readonly executionId: string;
  readonly eventLimit?: number;
  readonly logLimit?: number;
  readonly tenantId?: string;
  readonly idempotencyKey?: string;
}

export interface RuntimeSdkExecutionTraceResponse {
  readonly executionId: string;
  readonly trace: {
    readonly events: ReadonlyArray<{
      readonly eventId: string;
      readonly kind: string;
      readonly at: string;
      readonly executionNodeId?: string;
      readonly payload?: Readonly<Record<string, unknown>>;
    }>;
    readonly logs: ReadonlyArray<{
      readonly logId: string;
      readonly at: string;
      readonly level: "info" | "warning" | "error";
      readonly message: string;
      readonly executionNodeId?: string;
      readonly payload?: Readonly<Record<string, unknown>>;
    }>;
  };
}
