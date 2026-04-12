import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";
import type {
  ImageAsset,
  ImageAssetOriginKind,
  ImageAssetStatus,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";

export class ImageAssetMetadataReadContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetMetadataReadContractError";
  }
}

export const ImageAssetMetadataReadErrorCodes = Object.freeze({
  invalidRequest: "image-asset-metadata-read-invalid-request",
  accessDenied: "image-asset-metadata-read-access-denied",
  notFound: "image-asset-metadata-read-not-found",
  internal: "image-asset-metadata-read-internal",
});

export type ImageAssetMetadataReadErrorCode =
  typeof ImageAssetMetadataReadErrorCodes[keyof typeof ImageAssetMetadataReadErrorCodes];

export interface ImageAssetMetadataReadError {
  readonly code: ImageAssetMetadataReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ImageAssetMetadataReadResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ImageAssetMetadataReadError;
  };

export interface ImageAssetMetadataAvailability {
  readonly isReadyForUse: boolean;
  readonly isPreviewable: boolean;
  readonly isDownloadable: boolean;
  readonly isArchived: boolean;
  readonly isDeleted: boolean;
}

export interface ImageAssetMetadataSummary {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly originKind: ImageAssetOriginKind;
  readonly mediaType: SupportedImageMediaType;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly visibility: ResourceVisibility;
  readonly lifecycle: ImageAsset["lifecycle"];
  readonly storage: {
    readonly storageInstanceId: string;
    readonly storageBindingReference?: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly availability: ImageAssetMetadataAvailability;
}

export interface ImageAssetMetadataDetail extends ImageAssetMetadataSummary {
  readonly originalFilename: string;
  readonly fingerprint: ImageAsset["fingerprint"];
  readonly sharingPolicy: ImageAsset["sharingPolicy"];
  readonly lineage?: ImageAsset["lineage"];
  readonly createdBy: string;
  readonly lastModifiedBy: string;
}

export interface GetImageAssetMetadataRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly includeDeleted?: boolean;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetImageAssetMetadataSuccess {
  readonly asset: ImageAssetMetadataDetail;
}

export interface IGetImageAssetMetadataUseCase {
  execute(
    request: GetImageAssetMetadataRequest,
  ): Promise<ImageAssetMetadataReadResult<GetImageAssetMetadataSuccess>>;
}

export interface ListImageAssetMetadataRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly originKinds?: ReadonlyArray<ImageAssetOriginKind>;
  readonly lifecycleStatuses?: ReadonlyArray<ImageAssetStatus>;
  readonly visibilities?: ReadonlyArray<ResourceVisibility>;
  readonly mediaTypes?: ReadonlyArray<SupportedImageMediaType>;
  readonly storageInstanceIds?: ReadonlyArray<string>;
  readonly sourceRunIds?: ReadonlyArray<string>;
  readonly generationOperationIds?: ReadonlyArray<string>;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly includeDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ListImageAssetMetadataSuccess {
  readonly items: ReadonlyArray<ImageAssetMetadataSummary>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface IListImageAssetMetadataUseCase {
  execute(
    request: ListImageAssetMetadataRequest,
  ): Promise<ImageAssetMetadataReadResult<ListImageAssetMetadataSuccess>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetMetadataReadContractError(`${field} is required.`);
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
    throw new ImageAssetMetadataReadContractError(`${field} must be a valid timestamp.`);
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
    throw new ImageAssetMetadataReadContractError(`${field} must be an integer >= ${String(minimum)}.`);
  }
  return value;
}

function normalizeOptionalLookupList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  const normalized = [...new Set(values
    .map((value) => value.trim())
    .filter((value) => value.length > 0))];
  if (normalized.length < 1) {
    return undefined;
  }
  return Object.freeze(normalized);
}

function assertTimestampRange(
  start: string | undefined,
  end: string | undefined,
  label: string,
): void {
  if (!start || !end) {
    return;
  }
  if (new Date(end).getTime() < new Date(start).getTime()) {
    throw new ImageAssetMetadataReadContractError(`${label} range is invalid: end must be >= start.`);
  }
}

export function mapImageAssetMetadataAvailability(
  imageAsset: Pick<ImageAsset, "lifecycle">,
): ImageAssetMetadataAvailability {
  const status = imageAsset.lifecycle.status;
  const isReadyForUse = status === "available";
  const isArchived = status === "archived";
  const isDeleted = status === "deleted";
  return Object.freeze({
    isReadyForUse,
    isPreviewable: isReadyForUse || isArchived,
    isDownloadable: isReadyForUse || isArchived,
    isArchived,
    isDeleted,
  });
}

export function toImageAssetMetadataSummary(imageAsset: ImageAsset): ImageAssetMetadataSummary {
  return Object.freeze({
    assetId: imageAsset.assetId,
    workspaceId: imageAsset.workspaceId,
    ownerUserId: imageAsset.ownerUserId,
    originKind: imageAsset.originKind,
    mediaType: imageAsset.mediaType,
    normalizedFilename: imageAsset.normalizedFilename,
    sizeBytes: imageAsset.sizeBytes,
    visibility: imageAsset.visibility,
    lifecycle: imageAsset.lifecycle,
    storage: Object.freeze({
      storageInstanceId: imageAsset.storageInstanceId,
      storageBindingReference: imageAsset.storageBindingReference,
    }),
    createdAt: imageAsset.createdAt,
    updatedAt: imageAsset.updatedAt,
    availability: mapImageAssetMetadataAvailability(imageAsset),
  });
}

export function toImageAssetMetadataDetail(imageAsset: ImageAsset): ImageAssetMetadataDetail {
  return Object.freeze({
    ...toImageAssetMetadataSummary(imageAsset),
    originalFilename: imageAsset.originalFilename,
    fingerprint: imageAsset.fingerprint,
    sharingPolicy: imageAsset.sharingPolicy,
    lineage: imageAsset.lineage,
    createdBy: imageAsset.createdBy,
    lastModifiedBy: imageAsset.lastModifiedBy,
  });
}

export function validateGetImageAssetMetadataRequest(
  input: GetImageAssetMetadataRequest,
): GetImageAssetMetadataRequest {
  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    assetId: normalizeRequired(input.assetId, "assetId"),
    includeDeleted: input.includeDeleted ?? false,
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}

export function validateListImageAssetMetadataRequest(
  input: ListImageAssetMetadataRequest,
): ListImageAssetMetadataRequest {
  const createdAfter = normalizeOptionalTimestamp(input.createdAfter, "createdAfter");
  const createdBefore = normalizeOptionalTimestamp(input.createdBefore, "createdBefore");
  const updatedAfter = normalizeOptionalTimestamp(input.updatedAfter, "updatedAfter");
  const updatedBefore = normalizeOptionalTimestamp(input.updatedBefore, "updatedBefore");
  assertTimestampRange(createdAfter, createdBefore, "createdAt");
  assertTimestampRange(updatedAfter, updatedBefore, "updatedAt");

  return Object.freeze({
    ...input,
    actorUserId: normalizeRequired(input.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(input.workspaceId, "workspaceId"),
    ownerUserIds: normalizeOptionalLookupList(input.ownerUserIds),
    originKinds: input.originKinds,
    lifecycleStatuses: input.lifecycleStatuses,
    visibilities: input.visibilities,
    mediaTypes: input.mediaTypes,
    storageInstanceIds: normalizeOptionalLookupList(input.storageInstanceIds),
    sourceRunIds: normalizeOptionalLookupList(input.sourceRunIds),
    generationOperationIds: normalizeOptionalLookupList(input.generationOperationIds),
    createdAfter,
    createdBefore,
    updatedAfter,
    updatedBefore,
    includeDeleted: input.includeDeleted ?? false,
    limit: normalizeOptionalPositiveInteger(input.limit, "limit", 1),
    offset: normalizeOptionalPositiveInteger(input.offset, "offset", 0),
    correlationId: normalizeOptional(input.correlationId),
    occurredAt: normalizeOptionalTimestamp(input.occurredAt, "occurredAt"),
  });
}
