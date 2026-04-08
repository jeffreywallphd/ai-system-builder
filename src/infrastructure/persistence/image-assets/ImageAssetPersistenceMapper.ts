import type {
  ImageAsset,
  ImageAssetOriginKind,
  ImageAssetStatus,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";
import {
  rehydrateImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import type {
  ResourceVisibility,
  SharingPolicyMode,
} from "@domain/authorization/AuthorizationDomain";
import {
  normalizeImageAssetPersistenceOperationKey,
} from "@shared/dto/assets/ImageAssetPersistenceDtos";

export interface ImageAssetRecordRow {
  readonly asset_id: string;
  readonly workspace_id: string;
  readonly owner_user_id: string | null;
  readonly origin_kind: ImageAssetOriginKind;
  readonly visibility: ResourceVisibility;
  readonly sharing_policy_mode: SharingPolicyMode;
  readonly sharing_policy_id: string | null;
  readonly sharing_policy_version: string | null;
  readonly storage_instance_id: string;
  readonly storage_binding_reference: string | null;
  readonly media_type: SupportedImageMediaType;
  readonly original_filename: string;
  readonly normalized_filename: string;
  readonly size_bytes: number;
  readonly fingerprint_algorithm: "sha256" | "sha512" | "blake3";
  readonly fingerprint_digest: string;
  readonly lifecycle_status: ImageAssetStatus;
  readonly lifecycle_ingested_at: string | null;
  readonly lifecycle_failed_at: string | null;
  readonly lifecycle_failed_by: string | null;
  readonly lifecycle_failure_reason: string | null;
  readonly lifecycle_archived_at: string | null;
  readonly lifecycle_archived_by: string | null;
  readonly lifecycle_deleted_at: string | null;
  readonly lifecycle_deleted_by: string | null;
  readonly latest_object_key: string | null;
  readonly latest_object_version_id: string | null;
  readonly preview_asset_id: string | null;
  readonly preview_media_type: SupportedImageMediaType | null;
  readonly source_run_id: string | null;
  readonly generation_operation_id: string | null;
  readonly created_by: string;
  readonly last_modified_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly revision: number;
  readonly schema_version: number;
}

export interface ImageAssetLineageUpstreamRow {
  readonly asset_id: string;
  readonly upstream_asset_id: string;
  readonly ordinal: number;
}

export interface ImageAssetMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: string;
  readonly asset_id: string;
  readonly mutation_snapshot_json: string;
  readonly actor_user_id: string;
  readonly correlation_id: string | null;
  readonly reason: string | null;
  readonly occurred_at: string;
  readonly created_at: string;
}

export function normalizeImageAssetLookup(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeImageAssetOperationKey(operationKey: string): string {
  return normalizeImageAssetPersistenceOperationKey(operationKey);
}

export function mapImageAssetToRecordRowValues(input: {
  readonly imageAsset: ImageAsset;
  readonly revision: number;
  readonly schemaVersion: number;
}): readonly unknown[] {
  const { imageAsset } = input;
  return Object.freeze([
    imageAsset.assetId,
    imageAsset.workspaceId,
    imageAsset.ownerUserId ?? null,
    imageAsset.originKind,
    imageAsset.visibility,
    imageAsset.sharingPolicy.mode,
    imageAsset.sharingPolicy.policyId ?? null,
    imageAsset.sharingPolicy.policyVersion ?? null,
    imageAsset.storageInstanceId,
    imageAsset.storageBindingReference ?? null,
    imageAsset.mediaType,
    imageAsset.originalFilename,
    imageAsset.normalizedFilename,
    imageAsset.sizeBytes,
    imageAsset.fingerprint.algorithm,
    imageAsset.fingerprint.digest,
    imageAsset.lifecycle.status,
    imageAsset.lifecycle.ingestedAt ?? null,
    imageAsset.lifecycle.failedAt ?? null,
    imageAsset.lifecycle.failedBy ?? null,
    imageAsset.lifecycle.failureReason ?? null,
    imageAsset.lifecycle.archivedAt ?? null,
    imageAsset.lifecycle.archivedBy ?? null,
    imageAsset.lifecycle.deletedAt ?? null,
    imageAsset.lifecycle.deletedBy ?? null,
    null,
    null,
    null,
    null,
    imageAsset.lineage?.sourceRunId ?? null,
    imageAsset.lineage?.generationOperationId ?? null,
    imageAsset.createdBy,
    imageAsset.lastModifiedBy,
    imageAsset.createdAt,
    imageAsset.updatedAt,
    input.revision,
    input.schemaVersion,
  ]);
}

export function mapImageAssetRowToDomain(
  row: ImageAssetRecordRow,
  upstreamAssetIds: ReadonlyArray<string>,
): ImageAsset {
  return rehydrateImageAsset({
    assetId: row.asset_id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id ?? undefined,
    originKind: row.origin_kind,
    visibility: row.visibility,
    sharingPolicy: {
      mode: row.sharing_policy_mode,
      policyId: row.sharing_policy_id ?? undefined,
      policyVersion: row.sharing_policy_version ?? undefined,
    },
    storageInstanceId: row.storage_instance_id,
    storageBindingReference: row.storage_binding_reference ?? undefined,
    mediaType: row.media_type,
    originalFilename: row.original_filename,
    normalizedFilename: row.normalized_filename,
    sizeBytes: row.size_bytes,
    fingerprint: {
      algorithm: row.fingerprint_algorithm,
      digest: row.fingerprint_digest,
    },
    lifecycle: {
      status: row.lifecycle_status,
      ingestedAt: row.lifecycle_ingested_at ?? undefined,
      failedAt: row.lifecycle_failed_at ?? undefined,
      failedBy: row.lifecycle_failed_by ?? undefined,
      failureReason: row.lifecycle_failure_reason ?? undefined,
      archivedAt: row.lifecycle_archived_at ?? undefined,
      archivedBy: row.lifecycle_archived_by ?? undefined,
      deletedAt: row.lifecycle_deleted_at ?? undefined,
      deletedBy: row.lifecycle_deleted_by ?? undefined,
    },
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineage: upstreamAssetIds.length > 0 || row.source_run_id || row.generation_operation_id
      ? {
        upstreamAssetIds,
        sourceRunId: row.source_run_id ?? undefined,
        generationOperationId: row.generation_operation_id ?? undefined,
      }
      : undefined,
  });
}

export function parseImageAssetMutationReplayRow(
  row: ImageAssetMutationReplayRow,
): ImageAsset {
  const parsed = JSON.parse(row.mutation_snapshot_json) as Partial<ImageAsset>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Image asset mutation replay '${row.operation_key}' has invalid snapshot payload.`);
  }

  return rehydrateImageAsset({
    assetId: String(parsed.assetId ?? ""),
    workspaceId: String(parsed.workspaceId ?? ""),
    ownerUserId: parsed.ownerUserId,
    originKind: parsed.originKind as ImageAssetOriginKind,
    visibility: parsed.visibility as ResourceVisibility,
    sharingPolicy: {
      mode: parsed.sharingPolicy?.mode as SharingPolicyMode,
      policyId: parsed.sharingPolicy?.policyId,
      policyVersion: parsed.sharingPolicy?.policyVersion,
    },
    storageInstanceId: String(parsed.storageInstanceId ?? ""),
    storageBindingReference: parsed.storageBindingReference,
    mediaType: String(parsed.mediaType ?? ""),
    originalFilename: String(parsed.originalFilename ?? ""),
    normalizedFilename: String(parsed.normalizedFilename ?? ""),
    sizeBytes: Number(parsed.sizeBytes ?? 0),
    fingerprint: {
      algorithm: parsed.fingerprint?.algorithm as "sha256" | "sha512" | "blake3",
      digest: String(parsed.fingerprint?.digest ?? ""),
    },
    lifecycle: {
      status: parsed.lifecycle?.status as ImageAssetStatus,
      ingestedAt: parsed.lifecycle?.ingestedAt,
      failedAt: parsed.lifecycle?.failedAt,
      failedBy: parsed.lifecycle?.failedBy,
      failureReason: parsed.lifecycle?.failureReason,
      archivedAt: parsed.lifecycle?.archivedAt,
      archivedBy: parsed.lifecycle?.archivedBy,
      deletedAt: parsed.lifecycle?.deletedAt,
      deletedBy: parsed.lifecycle?.deletedBy,
    },
    createdBy: String(parsed.createdBy ?? ""),
    lastModifiedBy: String(parsed.lastModifiedBy ?? ""),
    createdAt: String(parsed.createdAt ?? ""),
    updatedAt: String(parsed.updatedAt ?? ""),
    lineage: parsed.lineage
      ? {
        upstreamAssetIds: Array.isArray(parsed.lineage.upstreamAssetIds)
          ? parsed.lineage.upstreamAssetIds.map((entry) => String(entry))
          : [],
        sourceRunId: parsed.lineage.sourceRunId,
        generationOperationId: parsed.lineage.generationOperationId,
      }
      : undefined,
  });
}
