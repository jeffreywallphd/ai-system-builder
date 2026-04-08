import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";
import type {
  ImageAsset,
  ImageAssetFingerprint,
  ImageAssetLineageMetadata,
  ImageAssetOriginKind,
  ImageAssetSharingPolicy,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";
import { SupportedImageMediaTypes } from "@domain/image-assets/ImageAssetDomain";
import type {
  ImageAssetStorageObjectArea,
  ReserveImageAssetStorageLocationResult,
} from "../ports/ImageAssetStoragePort";

export class ImageAssetCreationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetCreationContractError";
  }
}

export const ImageAssetCreationErrorCodes = Object.freeze({
  invalidRequest: "image-asset-create-invalid-request",
  accessDenied: "image-asset-create-access-denied",
  policyViolation: "image-asset-create-policy-violation",
  notFound: "image-asset-create-not-found",
  invalidState: "image-asset-create-invalid-state",
  conflict: "image-asset-create-conflict",
  internal: "image-asset-create-internal",
});

export type ImageAssetCreationErrorCode =
  typeof ImageAssetCreationErrorCodes[keyof typeof ImageAssetCreationErrorCodes];

export interface ImageAssetCreationError {
  readonly code: ImageAssetCreationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ImageAssetCreationResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ImageAssetCreationError;
  };

export interface InitiateImageAssetCreationRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly operationKey: string;
  readonly assetId?: string;
  readonly ownerUserId?: string;
  readonly storageInstanceId?: string;
  readonly visibility?: ResourceVisibility;
  readonly sharingPolicy?: ImageAssetSharingPolicy;
  readonly originKind?: ImageAssetOriginKind;
  readonly mediaType: string;
  readonly originalFilename: string;
  readonly normalizedFilename?: string;
  readonly sizeBytes: number;
  readonly fingerprint: ImageAssetFingerprint;
  readonly lineage?: ImageAssetLineageMetadata;
  readonly uploadArea?: ImageAssetStorageObjectArea;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface InitiateImageAssetCreationSuccess {
  readonly imageAsset: ImageAsset;
  readonly upload: {
    readonly status: "upload-pending";
    readonly reservation: ReserveImageAssetStorageLocationResult;
  };
}

export interface IInitiateImageAssetCreationUseCase {
  execute(
    request: InitiateImageAssetCreationRequest,
  ): Promise<ImageAssetCreationResult<InitiateImageAssetCreationSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetCreationContractError(`${field} is required.`);
  }
  return normalized;
}

const SupportedImageExtensionsByMediaType: Readonly<Record<SupportedImageMediaType, ReadonlyArray<string>>> = Object.freeze({
  "image/png": Object.freeze([".png"]),
  "image/jpeg": Object.freeze([".jpg", ".jpeg"]),
  "image/webp": Object.freeze([".webp"]),
  "image/gif": Object.freeze([".gif"]),
  "image/bmp": Object.freeze([".bmp"]),
  "image/tiff": Object.freeze([".tif", ".tiff"]),
  "image/avif": Object.freeze([".avif"]),
  "image/heic": Object.freeze([".heic"]),
  "image/heif": Object.freeze([".heif"]),
});

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeMediaType(value: string): SupportedImageMediaType {
  const normalized = normalizeRequired(value, "mediaType")
    .toLowerCase()
    .split(";")[0]
    ?.trim();
  if (!normalized || !SupportedImageMediaTypes.includes(normalized as SupportedImageMediaType)) {
    throw new ImageAssetCreationContractError(`mediaType '${value}' is not supported for image ingestion.`);
  }
  return normalized as SupportedImageMediaType;
}

function normalizeTimestamp(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ImageAssetCreationContractError("occurredAt must be a valid timestamp.");
  }
  return parsed.toISOString();
}

function normalizeSizeBytes(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new ImageAssetCreationContractError("sizeBytes must be an integer >= 1.");
  }
  return value;
}

function normalizeFilename(value: string, field: string): string {
  const normalized = normalizeRequired(value, field).normalize("NFKC").replace(/\s+/g, " ");
  if (normalized.length > 255) {
    throw new ImageAssetCreationContractError(`${field} must be 255 characters or fewer.`);
  }
  if (normalized.includes("/") || normalized.includes("\\")) {
    throw new ImageAssetCreationContractError(`${field} cannot include path separators.`);
  }
  if (/([\u0000-\u001f\u007f])/.test(normalized)) {
    throw new ImageAssetCreationContractError(`${field} cannot include control characters.`);
  }
  return normalized;
}

function extractExtension(filename: string): string | undefined {
  const normalized = filename.trim();
  const extensionIndex = normalized.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === normalized.length - 1) {
    return undefined;
  }
  return normalized.slice(extensionIndex).toLowerCase();
}

function assertExtensionMatchesMediaType(filename: string, mediaType: SupportedImageMediaType): string {
  const extension = extractExtension(filename);
  if (!extension) {
    throw new ImageAssetCreationContractError("originalFilename must include a supported file extension.");
  }
  const supportedExtensions = SupportedImageExtensionsByMediaType[mediaType];
  if (!supportedExtensions.includes(extension)) {
    throw new ImageAssetCreationContractError(
      `originalFilename extension '${extension}' is not supported for mediaType '${mediaType}'.`,
    );
  }
  return extension;
}

function deriveNormalizedFilename(sourceFilename: string, requiredExtension: string): string {
  const extensionless = sourceFilename.trim().toLowerCase().replace(/\.[^.]+$/, "");
  const source = extensionless.length > 0 ? extensionless : sourceFilename.trim().toLowerCase();
  const collapsed = source.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  const trimmed = collapsed.replace(/^-+/, "").replace(/-+$/, "");
  const fallbackBase = trimmed || "image-asset";
  const maxBaseLength = 255 - requiredExtension.length;
  const base = fallbackBase.length > maxBaseLength ? fallbackBase.slice(0, maxBaseLength) : fallbackBase;
  return `${base}${requiredExtension}`;
}

export function validateInitiateImageAssetCreationRequest(
  input: InitiateImageAssetCreationRequest,
): InitiateImageAssetCreationRequest {
  const mediaType = normalizeMediaType(input.mediaType);
  const originalFilename = normalizeFilename(input.originalFilename, "originalFilename");
  const extension = assertExtensionMatchesMediaType(originalFilename, mediaType);
  const requestedNormalizedFilename = normalizeOptional(input.normalizedFilename);
  const normalizedFilename = deriveNormalizedFilename(
    requestedNormalizedFilename ?? originalFilename,
    extension,
  );

  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    operationKey: normalizeRequired(input.operationKey, "operationKey"),
    assetId: normalizeOptional(input.assetId),
    ownerUserId: normalizeOptional(input.ownerUserId),
    storageInstanceId: normalizeOptional(input.storageInstanceId),
    mediaType,
    originalFilename,
    normalizedFilename,
    sizeBytes: normalizeSizeBytes(input.sizeBytes),
    fingerprint: Object.freeze({
      algorithm: input.fingerprint.algorithm,
      digest: normalizeRequired(input.fingerprint.digest, "fingerprint.digest").toLowerCase(),
    }),
    lineage: input.lineage,
    uploadArea: input.uploadArea,
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeTimestamp(input.occurredAt),
  });
}
