import type { ImageAsset } from "@domain/image-assets/ImageAssetDomain";

export class ImageAssetOriginalContentReadContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetOriginalContentReadContractError";
  }
}

export const ImageAssetOriginalContentReadErrorCodes = Object.freeze({
  invalidRequest: "image-asset-original-content-invalid-request",
  accessDenied: "image-asset-original-content-access-denied",
  notFound: "image-asset-original-content-not-found",
  invalidState: "image-asset-original-content-invalid-state",
  contentUnavailable: "image-asset-original-content-unavailable",
  internal: "image-asset-original-content-internal",
});

export type ImageAssetOriginalContentReadErrorCode =
  typeof ImageAssetOriginalContentReadErrorCodes[keyof typeof ImageAssetOriginalContentReadErrorCodes];

export interface ImageAssetOriginalContentReadError {
  readonly code: ImageAssetOriginalContentReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ImageAssetOriginalContentReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ImageAssetOriginalContentReadError;
  };

export interface GetImageAssetOriginalContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetImageAssetOriginalContentSuccess {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly mediaType: ImageAsset["mediaType"];
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface IGetImageAssetOriginalContentUseCase {
  execute(
    request: GetImageAssetOriginalContentRequest,
  ): Promise<ImageAssetOriginalContentReadResult<GetImageAssetOriginalContentSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetOriginalContentReadContractError(`${field} is required.`);
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
    throw new ImageAssetOriginalContentReadContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

export function validateGetImageAssetOriginalContentRequest(
  input: GetImageAssetOriginalContentRequest,
): GetImageAssetOriginalContentRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    assetId: normalizeRequired(input.assetId, "assetId"),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
