import type {
  ResourceVisibility,
  SharingPolicyMode,
} from "@domain/authorization/AuthorizationDomain";
import type {
  ImageAssetFingerprintAlgorithm,
  ImageAssetOriginKind,
  ImageAssetStatus,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";

export class ImageAssetTransportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetTransportContractError";
  }
}

export const ImageAssetTransportContractVersions = Object.freeze({
  v1: "image-asset-transport/v1",
});

export type ImageAssetTransportContractVersion =
  typeof ImageAssetTransportContractVersions[keyof typeof ImageAssetTransportContractVersions];

export const ImageAssetTransportRoutes = Object.freeze({
  createImageAsset: "/api/v1/image-assets",
  listImageAssets: "/api/v1/image-assets",
  getImageAsset: "/api/v1/image-assets/:assetId",
  initiateUpload: "/api/v1/image-assets/:assetId/uploads/initiate",
  completeUpload: "/api/v1/image-assets/:assetId/uploads/:uploadSessionId/complete",
  requestPreview: "/api/v1/image-assets/:assetId/preview",
  requestAccess: "/api/v1/image-assets/:assetId/access",
  getOriginalContent: "/api/v1/image-assets/:assetId/original",
  listEvents: "/api/v1/image-assets/events",
} as const);

export const ImageAssetAccessPurposes = Object.freeze({
  downloadOriginal: "download-original",
  inlinePreview: "inline-preview",
  export: "export",
} as const);

export type ImageAssetAccessPurpose =
  typeof ImageAssetAccessPurposes[keyof typeof ImageAssetAccessPurposes];

export const ImageAssetUploadSessionStatuses = Object.freeze({
  pending: "pending",
  uploaded: "uploaded",
  finalized: "finalized",
  expired: "expired",
  canceled: "canceled",
} as const);

export type ImageAssetUploadSessionStatus =
  typeof ImageAssetUploadSessionStatuses[keyof typeof ImageAssetUploadSessionStatuses];

export const ImageAssetEventKinds = Object.freeze({
  created: "created",
  uploadInitiated: "upload-initiated",
  uploadCompleted: "upload-completed",
  lifecycleStatusChanged: "lifecycle-status-changed",
  metadataUpdated: "metadata-updated",
  previewRequested: "preview-requested",
  accessGranted: "access-granted",
  deleted: "deleted",
} as const);

export type ImageAssetEventKind = typeof ImageAssetEventKinds[keyof typeof ImageAssetEventKinds];

export interface ImageAssetOwnershipDto {
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImageAssetSharingPolicyDto {
  readonly mode: SharingPolicyMode;
  readonly policyId?: string;
  readonly policyVersion?: string;
}

export interface ImageAssetStorageReferenceDto {
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
}

export interface ImageAssetFingerprintDto {
  readonly algorithm: ImageAssetFingerprintAlgorithm;
  readonly digest: string;
}

export interface ImageAssetLifecycleDto {
  readonly status: ImageAssetStatus;
  readonly ingestedAt?: string;
  readonly failedAt?: string;
  readonly failedBy?: string;
  readonly failureReason?: string;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface ImageAssetLineageDto {
  readonly upstreamAssetIds: ReadonlyArray<string>;
  readonly sourceRunId?: string;
  readonly generationOperationId?: string;
}

export interface ImageAssetPreviewAvailabilityDto {
  readonly available: boolean;
  readonly previewAssetId?: string;
  readonly mediaType?: SupportedImageMediaType;
}

export interface ImageAssetSummaryDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly assetId: string;
  readonly originKind: ImageAssetOriginKind;
  readonly mediaType: SupportedImageMediaType;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly visibility: ResourceVisibility;
  readonly ownership: ImageAssetOwnershipDto;
  readonly storage: ImageAssetStorageReferenceDto;
  readonly lifecycle: ImageAssetLifecycleDto;
  readonly preview: ImageAssetPreviewAvailabilityDto;
}

export interface ImageAssetDetailDto extends ImageAssetSummaryDto {
  readonly originalFilename: string;
  readonly fingerprint: ImageAssetFingerprintDto;
  readonly sharingPolicy: ImageAssetSharingPolicyDto;
  readonly lineage?: ImageAssetLineageDto;
}

export interface ImageAssetUploadSessionDto {
  readonly uploadSessionId: string;
  readonly assetId: string;
  readonly workspaceId: string;
  readonly status: ImageAssetUploadSessionStatus;
  readonly uploadEndpoint: string;
  readonly uploadMethod: "POST";
  readonly expected: {
    readonly fileName: string;
    readonly mediaType: SupportedImageMediaType;
    readonly sizeBytes: number;
  };
  readonly expiresAt: string;
}

export interface ImageAssetAccessGrantDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly assetId: string;
  readonly workspaceId: string;
  readonly purpose: ImageAssetAccessPurpose;
  readonly mediaType: SupportedImageMediaType;
  readonly sizeBytes: number;
  readonly token: string;
  readonly expiresAt: string;
  readonly suggestedFileName?: string;
}

export interface ImageAssetEventDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly eventId: string;
  readonly kind: ImageAssetEventKind;
  readonly occurredAt: string;
  readonly workspaceId: string;
  readonly actorUserId?: string;
  readonly assetId: string;
  readonly lifecycleStatus?: ImageAssetStatus;
  readonly uploadSessionId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageAssetListQueryFilters {
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly originKinds?: ReadonlyArray<ImageAssetOriginKind>;
  readonly statuses?: ReadonlyArray<ImageAssetStatus>;
  readonly visibilities?: ReadonlyArray<ResourceVisibility>;
  readonly mediaTypes?: ReadonlyArray<SupportedImageMediaType>;
  readonly storageInstanceIds?: ReadonlyArray<string>;
  readonly search?: string;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetTransportContractError(`${field} is required.`);
  }
  return normalized;
}

function appendOptional(query: URLSearchParams, key: string, value?: string): void {
  const normalized = value?.trim();
  if (normalized) {
    query.set(key, normalized);
  }
}

function appendOptionalList(query: URLSearchParams, key: string, values?: ReadonlyArray<string>): void {
  for (const entry of values ?? []) {
    const normalized = entry.trim();
    if (normalized) {
      query.append(key, normalized);
    }
  }
}

export function toImageAssetListQueryParams(input: {
  readonly workspaceId: string;
  readonly filters?: ImageAssetListQueryFilters;
}): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(input.workspaceId, "workspaceId"));
  appendOptionalList(query, "ownerUserId", input.filters?.ownerUserIds);
  appendOptionalList(query, "originKind", input.filters?.originKinds);
  appendOptionalList(query, "status", input.filters?.statuses);
  appendOptionalList(query, "visibility", input.filters?.visibilities);
  appendOptionalList(query, "mediaType", input.filters?.mediaTypes);
  appendOptionalList(query, "storageInstanceId", input.filters?.storageInstanceIds);
  appendOptional(query, "search", input.filters?.search);
  appendOptional(query, "createdAfter", input.filters?.createdAfter);
  appendOptional(query, "createdBefore", input.filters?.createdBefore);
  appendOptional(query, "updatedAfter", input.filters?.updatedAfter);
  appendOptional(query, "updatedBefore", input.filters?.updatedBefore);
  if (typeof input.filters?.limit === "number") {
    query.set("limit", String(input.filters.limit));
  }
  if (typeof input.filters?.offset === "number") {
    query.set("offset", String(input.filters.offset));
  }
  return query;
}

export function buildImageAssetRoutePath(params: {
  readonly assetId: string;
}): string {
  const assetId = encodeURIComponent(normalizeRequired(params.assetId, "assetId"));
  return ImageAssetTransportRoutes.getImageAsset.replace(":assetId", assetId);
}

export function buildImageAssetUploadCompletionPath(params: {
  readonly assetId: string;
  readonly uploadSessionId: string;
}): string {
  const assetId = encodeURIComponent(normalizeRequired(params.assetId, "assetId"));
  const uploadSessionId = encodeURIComponent(normalizeRequired(params.uploadSessionId, "uploadSessionId"));
  return ImageAssetTransportRoutes.completeUpload
    .replace(":assetId", assetId)
    .replace(":uploadSessionId", uploadSessionId);
}

export function buildImageAssetAccessPath(params: {
  readonly assetId: string;
}): string {
  const assetId = encodeURIComponent(normalizeRequired(params.assetId, "assetId"));
  return ImageAssetTransportRoutes.requestAccess.replace(":assetId", assetId);
}

export function buildImageAssetOriginalContentPath(params: {
  readonly assetId: string;
}): string {
  const assetId = encodeURIComponent(normalizeRequired(params.assetId, "assetId"));
  return ImageAssetTransportRoutes.getOriginalContent.replace(":assetId", assetId);
}
