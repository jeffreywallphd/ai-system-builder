import type { SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";

export class ImageAssetPreviewContentContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetPreviewContentContractError";
  }
}

export const ImageAssetPreviewRepresentations = Object.freeze({
  original: "original",
  gallery: "gallery",
  thumbnail: "thumbnail",
});

export type ImageAssetPreviewRepresentation =
  typeof ImageAssetPreviewRepresentations[keyof typeof ImageAssetPreviewRepresentations];

export const ImageAssetPreviewAvailabilityStatuses = Object.freeze({
  available: "available",
  pendingGeneration: "pending-generation",
  unavailable: "unavailable",
});

export type ImageAssetPreviewAvailabilityStatus =
  typeof ImageAssetPreviewAvailabilityStatuses[keyof typeof ImageAssetPreviewAvailabilityStatuses];

export const ImageAssetPreviewContentReadErrorCodes = Object.freeze({
  invalidRequest: "image-asset-preview-invalid-request",
  accessDenied: "image-asset-preview-access-denied",
  notFound: "image-asset-preview-not-found",
  invalidState: "image-asset-preview-invalid-state",
  contentUnavailable: "image-asset-preview-unavailable",
  internal: "image-asset-preview-internal",
});

export type ImageAssetPreviewContentReadErrorCode =
  typeof ImageAssetPreviewContentReadErrorCodes[keyof typeof ImageAssetPreviewContentReadErrorCodes];

export interface ImageAssetPreviewContentReadError {
  readonly code: ImageAssetPreviewContentReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ImageAssetPreviewContentReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ImageAssetPreviewContentReadError;
  };

export interface RequestImageAssetPreviewContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly representation?: ImageAssetPreviewRepresentation;
  readonly preferredMediaTypes?: ReadonlyArray<SupportedImageMediaType>;
  readonly expiresInSeconds?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface RequestImageAssetPreviewContentSuccess {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly representation: ImageAssetPreviewRepresentation;
  readonly status: ImageAssetPreviewAvailabilityStatus;
  readonly mediaType?: SupportedImageMediaType;
  readonly resolvedFrom: "original-fallback" | "derived-preview";
  readonly access?: {
    readonly previewToken: string;
    readonly expiresAt: string;
  };
}

export interface OpenImageAssetPreviewContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly previewToken: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenImageAssetPreviewContentSuccess {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly mediaType: SupportedImageMediaType;
  readonly sizeBytes: number;
  readonly contentDisposition: "inline";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface IRequestImageAssetPreviewContentUseCase {
  execute(
    request: RequestImageAssetPreviewContentRequest,
  ): Promise<ImageAssetPreviewContentReadResult<RequestImageAssetPreviewContentSuccess>>;
}

export interface IOpenImageAssetPreviewContentUseCase {
  execute(
    request: OpenImageAssetPreviewContentRequest,
  ): Promise<ImageAssetPreviewContentReadResult<OpenImageAssetPreviewContentSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetPreviewContentContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalTimestamp(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ImageAssetPreviewContentContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeOptionalPositiveInteger(
  value: number | undefined,
  field: string,
  minimum: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < minimum) {
    throw new ImageAssetPreviewContentContractError(`${field} must be an integer >= ${String(minimum)}.`);
  }
  return value;
}

export function validateRequestImageAssetPreviewContentRequest(
  input: RequestImageAssetPreviewContentRequest,
): RequestImageAssetPreviewContentRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    assetId: normalizeRequired(input.assetId, "assetId"),
    representation: input.representation ?? ImageAssetPreviewRepresentations.gallery,
    preferredMediaTypes: input.preferredMediaTypes
      ? Object.freeze(input.preferredMediaTypes.map((value) => value.trim().toLowerCase() as SupportedImageMediaType))
      : undefined,
    expiresInSeconds: normalizeOptionalPositiveInteger(input.expiresInSeconds, "expiresInSeconds", 1),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}

export function validateOpenImageAssetPreviewContentRequest(
  input: OpenImageAssetPreviewContentRequest,
): OpenImageAssetPreviewContentRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    assetId: normalizeRequired(input.assetId, "assetId"),
    previewToken: normalizeRequired(input.previewToken, "previewToken"),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
