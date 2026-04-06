import type { Asset } from "../../../domain/assets/AssetDomain";
import type { AssetAuditEvent } from "../../../application/assets/ports/AssetAuditPort";
import type {
  AssetDownloadAuthorization,
  AssetPreviewResolution,
} from "../../../application/assets/use-cases/AssetServiceContracts";

export class AssetTransportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetTransportContractError";
  }
}

export const AssetTransportContractVersions = Object.freeze({
  v1: "asset-transport/v1",
});

export type AssetTransportContractVersion =
  typeof AssetTransportContractVersions[keyof typeof AssetTransportContractVersions];

export interface AssetVersionSummaryDto {
  readonly versionId: string;
  readonly revision: number;
  readonly area: Asset["versions"][number]["location"]["area"];
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumAlgorithm: Asset["versions"][number]["content"]["checksum"]["algorithm"];
  readonly checksumDigest: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface AssetSummaryDto {
  readonly contractVersion: AssetTransportContractVersion;
  readonly assetId: string;
  readonly kind: Asset["kind"];
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly visibility: Asset["visibility"];
  readonly lifecycleState: Asset["lifecycle"]["state"];
  readonly currentVersionId: string;
  readonly currentVersion: AssetVersionSummaryDto;
  readonly storageInstanceId: string;
  readonly sharingPolicyRef?: {
    readonly policyId: string;
    readonly policyVersion?: string;
  };
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface AssetDetailDto extends AssetSummaryDto {
  readonly versions: ReadonlyArray<AssetVersionSummaryDto>;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface AssetDownloadAuthorizationDto {
  readonly contractVersion: AssetTransportContractVersion;
  readonly assetId: string;
  readonly versionId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentToken: string;
  readonly expiresAt: string;
  readonly contentDispositionFileName?: string;
}

export interface AssetPreviewResolutionDto {
  readonly contractVersion: AssetTransportContractVersion;
  readonly assetId: string;
  readonly versionId: string;
  readonly previewAssetId?: string;
  readonly previewVersionId?: string;
  readonly previewMimeType?: string;
  readonly previewStorageInstanceId?: string;
  readonly previewObjectKey?: string;
}

export interface AssetAuditEventPayloadDto {
  readonly contractVersion: AssetTransportContractVersion;
  readonly type: string;
  readonly occurredAt: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly correlationId?: string;
  readonly operationKey?: string;
  readonly asset: {
    readonly assetId: string;
    readonly kind?: string;
    readonly visibility?: string;
    readonly lifecycleState?: string;
    readonly versionId?: string;
  };
  readonly details?: Readonly<Record<string, unknown>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AssetTransportContractError(`${field} is required.`);
  }
  return normalized;
}

function assertPathSafeObjectKey(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  if (
    normalized.startsWith("/")
    || normalized.includes("\\")
    || /^[a-zA-Z]:\//.test(normalized)
    || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new AssetTransportContractError(`${field} must be a logical object key, not a filesystem path.`);
  }
  return normalized;
}

function toAssetVersionSummaryDto(version: Asset["versions"][number]): AssetVersionSummaryDto {
  return Object.freeze({
    versionId: version.versionId,
    revision: version.revision,
    area: version.location.area,
    mimeType: version.content.mimeType,
    sizeBytes: version.content.sizeBytes,
    checksumAlgorithm: version.content.checksum.algorithm,
    checksumDigest: version.content.checksum.digest,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
  });
}

function resolveCurrentAssetVersion(asset: Asset): Asset["versions"][number] {
  const current = asset.versions.find((entry) => entry.versionId === asset.currentVersionId);
  if (!current) {
    throw new AssetTransportContractError(
      `Asset '${asset.id}' currentVersionId '${asset.currentVersionId}' does not resolve.`,
    );
  }
  return current;
}

export function toAssetSummaryDto(asset: Asset): AssetSummaryDto {
  const currentVersion = resolveCurrentAssetVersion(asset);
  return Object.freeze({
    contractVersion: AssetTransportContractVersions.v1,
    assetId: asset.id,
    kind: asset.kind,
    workspaceId: asset.ownership.workspaceId,
    ownerUserId: asset.ownership.ownerUserId,
    visibility: asset.visibility,
    lifecycleState: asset.lifecycle.state,
    currentVersionId: asset.currentVersionId,
    currentVersion: toAssetVersionSummaryDto(currentVersion),
    storageInstanceId: asset.storageBinding.storageInstanceId,
    sharingPolicyRef: asset.sharingPolicyRef
      ? Object.freeze({
        policyId: asset.sharingPolicyRef.policyId,
        policyVersion: asset.sharingPolicyRef.policyVersion,
      })
      : undefined,
    createdAt: asset.ownership.createdAt,
    createdBy: asset.ownership.createdBy,
    lastModifiedAt: asset.ownership.lastModifiedAt,
    lastModifiedBy: asset.ownership.lastModifiedBy,
  });
}

export function toAssetDetailDto(asset: Asset): AssetDetailDto {
  return Object.freeze({
    ...toAssetSummaryDto(asset),
    versions: Object.freeze(asset.versions.map((version) => toAssetVersionSummaryDto(version))),
    archivedAt: asset.lifecycle.archivedAt,
    archivedBy: asset.lifecycle.archivedBy,
    deletedAt: asset.lifecycle.deletedAt,
    deletedBy: asset.lifecycle.deletedBy,
  });
}

export function toAssetDownloadAuthorizationDto(
  authorization: AssetDownloadAuthorization,
): AssetDownloadAuthorizationDto {
  return Object.freeze({
    contractVersion: AssetTransportContractVersions.v1,
    assetId: normalizeRequired(authorization.assetId, "assetId"),
    versionId: normalizeRequired(authorization.versionId, "versionId"),
    workspaceId: normalizeRequired(authorization.workspaceId, "workspaceId"),
    storageInstanceId: normalizeRequired(authorization.storageInstanceId, "storageInstanceId"),
    objectKey: assertPathSafeObjectKey(authorization.objectKey, "objectKey"),
    objectVersionId: authorization.objectVersionId?.trim() || undefined,
    mimeType: normalizeRequired(authorization.mimeType, "mimeType").toLowerCase(),
    sizeBytes: authorization.sizeBytes,
    contentToken: normalizeRequired(authorization.contentToken, "contentToken"),
    expiresAt: normalizeRequired(authorization.expiresAt, "expiresAt"),
    contentDispositionFileName: authorization.contentDispositionFileName?.trim() || undefined,
  });
}

export function toAssetPreviewResolutionDto(resolution: AssetPreviewResolution): AssetPreviewResolutionDto {
  return Object.freeze({
    contractVersion: AssetTransportContractVersions.v1,
    assetId: normalizeRequired(resolution.assetId, "assetId"),
    versionId: normalizeRequired(resolution.versionId, "versionId"),
    previewAssetId: resolution.previewAssetId?.trim() || undefined,
    previewVersionId: resolution.previewVersionId?.trim() || undefined,
    previewMimeType: resolution.previewMimeType?.trim().toLowerCase() || undefined,
    previewStorageInstanceId: resolution.previewStorageInstanceId?.trim() || undefined,
    previewObjectKey: resolution.previewObjectKey
      ? assertPathSafeObjectKey(resolution.previewObjectKey, "previewObjectKey")
      : undefined,
  });
}

export function toAssetAuditEventPayloadDto(event: AssetAuditEvent): AssetAuditEventPayloadDto {
  return Object.freeze({
    contractVersion: AssetTransportContractVersions.v1,
    type: event.type,
    occurredAt: event.occurredAt,
    workspaceId: event.workspaceId,
    actorUserId: event.actorUserId,
    correlationId: event.correlationId,
    operationKey: event.operationKey,
    asset: Object.freeze({
      assetId: event.asset.assetId,
      kind: event.asset.kind,
      visibility: event.asset.visibility,
      lifecycleState: event.asset.lifecycleState,
      versionId: event.asset.versionId,
    }),
    details: event.details,
  });
}

