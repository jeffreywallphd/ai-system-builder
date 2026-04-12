import type {
  ImageAsset,
  ImageAssetFingerprint,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";
import {
  ImageAssetFingerprintAlgorithms,
  SupportedImageMediaTypes,
} from "@domain/image-assets/ImageAssetDomain";
import type { ImageAssetStorageObjectReference } from "../ports/ImageAssetStoragePort";

export class ImageAssetUploadFinalizationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetUploadFinalizationContractError";
  }
}

export const ImageAssetUploadFinalizationErrorCodes = Object.freeze({
  invalidRequest: "image-asset-upload-finalize-invalid-request",
  accessDenied: "image-asset-upload-finalize-access-denied",
  notFound: "image-asset-upload-finalize-not-found",
  invalidState: "image-asset-upload-finalize-invalid-state",
  conflict: "image-asset-upload-finalize-conflict",
  internal: "image-asset-upload-finalize-internal",
});

export type ImageAssetUploadFinalizationErrorCode =
  typeof ImageAssetUploadFinalizationErrorCodes[keyof typeof ImageAssetUploadFinalizationErrorCodes];

export interface ImageAssetUploadFinalizationError {
  readonly code: ImageAssetUploadFinalizationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ImageAssetUploadFinalizationResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ImageAssetUploadFinalizationError;
  };

export interface FinalizeImageAssetUploadRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly operationKey: string;
  readonly storageReference: ImageAssetStorageObjectReference;
  readonly finalizedMediaType?: string;
  readonly expectedSizeBytes?: number;
  readonly expectedChecksumSha256?: string;
  readonly expectedFingerprint?: ImageAssetFingerprint;
  readonly cleanupOnFailure?: boolean;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface FinalizeImageAssetUploadSuccess {
  readonly imageAsset: ImageAsset;
  readonly upload: {
    readonly status: "finalized";
    readonly reference: ImageAssetStorageObjectReference;
    readonly finalizedAt: string;
    readonly observedSizeBytes: number;
    readonly observedChecksumSha256: string;
  };
}

export interface IFinalizeImageAssetUploadUseCase {
  execute(
    request: FinalizeImageAssetUploadRequest,
  ): Promise<ImageAssetUploadFinalizationResult<FinalizeImageAssetUploadSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetUploadFinalizationContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalMediaType(value: string | undefined): SupportedImageMediaType | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase().split(";")[0]?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!SupportedImageMediaTypes.includes(normalized as SupportedImageMediaType)) {
    throw new ImageAssetUploadFinalizationContractError(`finalizedMediaType '${value}' is not supported for image ingestion.`);
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
    throw new ImageAssetUploadFinalizationContractError("occurredAt must be a valid timestamp.");
  }
  return parsed.toISOString();
}

function normalizeOptionalSizeBytes(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new ImageAssetUploadFinalizationContractError("expectedSizeBytes must be an integer >= 1.");
  }
  return value;
}

function normalizeOptionalSha256Digest(value: string | undefined, field: string): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new ImageAssetUploadFinalizationContractError(`${field} must be a lowercase hexadecimal sha256 digest.`);
  }
  return normalized;
}

function normalizeExpectedFingerprint(
  fingerprint: FinalizeImageAssetUploadRequest["expectedFingerprint"],
): ImageAssetFingerprint | undefined {
  if (!fingerprint) {
    return undefined;
  }

  const digest = normalizeRequired(fingerprint.digest, "expectedFingerprint.digest").toLowerCase();
  if (!/^[a-f0-9]+$/.test(digest)) {
    throw new ImageAssetUploadFinalizationContractError("expectedFingerprint.digest must be lowercase hexadecimal.");
  }
  if (
    fingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha256
    && digest.length !== 64
  ) {
    throw new ImageAssetUploadFinalizationContractError("expectedFingerprint.digest must be 64 hex characters for sha256.");
  }
  if (
    fingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha512
    && digest.length !== 128
  ) {
    throw new ImageAssetUploadFinalizationContractError("expectedFingerprint.digest must be 128 hex characters for sha512.");
  }

  return Object.freeze({
    algorithm: fingerprint.algorithm,
    digest,
  });
}

export function validateFinalizeImageAssetUploadRequest(
  input: FinalizeImageAssetUploadRequest,
): FinalizeImageAssetUploadRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    assetId: normalizeRequired(input.assetId, "assetId"),
    operationKey: normalizeRequired(input.operationKey, "operationKey"),
    storageReference: Object.freeze({
      storageInstanceId: normalizeRequired(input.storageReference.storageInstanceId, "storageReference.storageInstanceId"),
      objectKey: normalizeRequired(input.storageReference.objectKey, "storageReference.objectKey"),
      objectVersionId: normalizeOptional(input.storageReference.objectVersionId),
      area: input.storageReference.area,
    }),
    finalizedMediaType: normalizeOptionalMediaType(input.finalizedMediaType),
    expectedSizeBytes: normalizeOptionalSizeBytes(input.expectedSizeBytes),
    expectedChecksumSha256: normalizeOptionalSha256Digest(input.expectedChecksumSha256, "expectedChecksumSha256"),
    expectedFingerprint: normalizeExpectedFingerprint(input.expectedFingerprint),
    cleanupOnFailure: input.cleanupOnFailure ?? true,
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeTimestamp(input.occurredAt),
  });
}
