export const GeneratedResultManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  invalidState: "invalid-state",
  internal: "internal",
} as const);

export type GeneratedResultManagementApiErrorCode =
  typeof GeneratedResultManagementApiErrorCodes[keyof typeof GeneratedResultManagementApiErrorCodes];

export interface GeneratedResultManagementApiError {
  readonly code: GeneratedResultManagementApiErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface GeneratedResultManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: GeneratedResultManagementApiError;
}

export interface OpenGeneratedResultOriginalContentStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenGeneratedResultOriginalContentStreamApiResponse {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}
