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

export interface RequestGeneratedResultPreviewApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly preferredPreviewKinds?: ReadonlyArray<"thumbnail" | "display-safe" | "history-safe">;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface RequestGeneratedResultPreviewApiResponse {
  readonly preview: {
    readonly resultAssetId: string;
    readonly workspaceId: string;
    readonly state: "preview-pending" | "preview-available" | "preview-failed" | "preview-unavailable";
    readonly available: boolean;
    readonly reasonCode?: string;
    readonly retryable?: boolean;
    readonly selected?: {
      readonly derivativeId: string;
      readonly previewKind: "thumbnail" | "display-safe" | "history-safe";
      readonly mediaType: string;
      readonly width?: number;
      readonly height?: number;
      readonly byteSize?: number;
      readonly previewToken: string;
      readonly contentEndpoint: string;
    };
    readonly alternatives: ReadonlyArray<{
      readonly derivativeId: string;
      readonly previewKind: "thumbnail" | "display-safe" | "history-safe";
      readonly availabilityStatus: "pending" | "available" | "failed" | "stale";
      readonly mediaType?: string;
      readonly width?: number;
      readonly height?: number;
      readonly byteSize?: number;
      readonly failureCode?: string;
    }>;
  };
}

export interface OpenGeneratedResultPreviewContentStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly previewToken: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenGeneratedResultPreviewContentStreamApiResponse {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDisposition: "inline";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}
