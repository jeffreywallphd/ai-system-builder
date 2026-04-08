import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";
import type {
  ImageAsset,
  ImageAssetFingerprint,
  ImageAssetLineageMetadata,
  ImageAssetOriginKind,
  ImageAssetSharingPolicy,
} from "@domain/image-assets/ImageAssetDomain";
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

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
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
  const normalized = normalizeRequired(value, field);
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

function deriveNormalizedFilename(originalFilename: string): string {
  const source = originalFilename.trim().toLowerCase();
  const collapsed = source.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  const trimmed = collapsed.replace(/^-+/, "").replace(/-+$/, "");
  const fallback = trimmed || "image-asset";
  return fallback.length > 255 ? fallback.slice(0, 255) : fallback;
}

export function validateInitiateImageAssetCreationRequest(
  input: InitiateImageAssetCreationRequest,
): InitiateImageAssetCreationRequest {
  const originalFilename = normalizeFilename(input.originalFilename, "originalFilename");

  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    operationKey: normalizeRequired(input.operationKey, "operationKey"),
    assetId: normalizeOptional(input.assetId),
    ownerUserId: normalizeOptional(input.ownerUserId),
    storageInstanceId: normalizeOptional(input.storageInstanceId),
    mediaType: normalizeRequired(input.mediaType, "mediaType").toLowerCase(),
    originalFilename,
    normalizedFilename: normalizeOptional(input.normalizedFilename)
      ?? deriveNormalizedFilename(originalFilename),
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
