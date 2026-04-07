export const SharedApiContractVersions = Object.freeze({
  v1: "shared-api/v1",
} as const);

export type SharedApiContractVersion =
  typeof SharedApiContractVersions[keyof typeof SharedApiContractVersions];

export const SharedApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  rateLimited: "rate-limited",
  internal: "internal",
} as const);

export type SharedApiErrorCode = typeof SharedApiErrorCodes[keyof typeof SharedApiErrorCodes];

export interface SharedApiValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface SharedApiErrorShape {
  readonly code: SharedApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<SharedApiValidationIssue>;
}

export interface SharedApiResponseEnvelope<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: SharedApiErrorShape;
}

export interface SharedApiIdentifierEnvelope {
  readonly id: string;
}

export interface SharedApiPagination {
  readonly limit?: number;
  readonly offset?: number;
}

export interface SharedApiPage<TItem> {
  readonly items: ReadonlyArray<TItem>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly totalCount: number;
    readonly hasMore: boolean;
  };
}

export interface SharedApiTimestampWindow {
  readonly from?: string;
  readonly to?: string;
}

export interface SharedApiMutationResult {
  readonly changed: boolean;
  readonly mutationId?: string;
  readonly occurredAt?: string;
}

export const SharedApiRealtimeEventKinds = Object.freeze({
  runStatusChanged: "run-status-changed",
  queuePositionChanged: "queue-position-changed",
  queueItemDequeued: "queue-item-dequeued",
  queueItemEnqueued: "queue-item-enqueued",
} as const);

export type SharedApiRealtimeEventKind =
  typeof SharedApiRealtimeEventKinds[keyof typeof SharedApiRealtimeEventKinds];

export interface SharedApiRealtimeEventEnvelope<TPayload> {
  readonly eventId: string;
  readonly eventKind: SharedApiRealtimeEventKind;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly payload: TPayload;
}

export const SharedApiQueryDefaults = Object.freeze({
  defaultLimit: 50,
  maxLimit: 200,
} as const);
