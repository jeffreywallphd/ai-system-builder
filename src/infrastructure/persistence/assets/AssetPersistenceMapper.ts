import {
  AssetContentEncryptionFormats,
  AssetContentEncryptionKeyScopes,
  AssetChecksumAlgorithms,
  AssetKinds,
  AssetLifecycleStates,
  AssetStorageAreas,
  AssetVisibilities,
  createAssetVersion,
  rehydrateAsset,
  type Asset,
  type AssetChecksumAlgorithm,
  type AssetKind,
  type AssetLifecycleState,
  type AssetStorageArea,
  type AssetVisibility,
} from "@domain/assets/AssetDomain";

export const AssetLineageRelations = Object.freeze({
  derivedFrom: "derived-from",
  generatedFrom: "generated-from",
  previewOf: "preview-of",
  transformedFrom: "transformed-from",
});

export type AssetLineageRelation = typeof AssetLineageRelations[keyof typeof AssetLineageRelations];

export interface AssetRecordRow {
  readonly asset_id: string;
  readonly workspace_id: string;
  readonly owner_user_id: string | null;
  readonly storage_instance_id: string;
  readonly storage_uri: string;
  readonly kind: AssetKind;
  readonly visibility: AssetVisibility;
  readonly sharing_policy_id: string | null;
  readonly sharing_policy_version: string | null;
  readonly lifecycle_state: AssetLifecycleState;
  readonly archived_at: string | null;
  readonly archived_by: string | null;
  readonly deleted_at: string | null;
  readonly deleted_by: string | null;
  readonly display_name: string | null;
  readonly current_version_id: string;
  readonly created_by: string;
  readonly created_at: string;
  readonly last_modified_by: string;
  readonly last_modified_at: string;
}

export interface AssetVersionRow {
  readonly asset_id: string;
  readonly version_id: string;
  readonly revision: number;
  readonly storage_instance_id: string;
  readonly storage_uri: string;
  readonly object_key: string;
  readonly object_version_id: string | null;
  readonly storage_area: AssetStorageArea;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly checksum_algorithm: AssetChecksumAlgorithm;
  readonly checksum_digest: string;
  readonly original_file_name: string | null;
  readonly content_encryption_descriptor: string | null;
  readonly created_by: string;
  readonly created_at: string;
}

export interface AssetLineageLinkRow {
  readonly asset_id: string;
  readonly source_asset_id: string;
  readonly source_asset_version_id: string | null;
  readonly relation: AssetLineageRelation;
  readonly created_at: string;
}

export function mapAssetRowsToDomain(
  assetRow: AssetRecordRow,
  versionRows: ReadonlyArray<AssetVersionRow>,
): Asset {
  return rehydrateAsset({
    id: assetRow.asset_id,
    kind: assertAssetKind(assetRow.kind),
    ownership: {
      workspaceId: assetRow.workspace_id,
      ownerUserId: assetRow.owner_user_id ?? undefined,
      createdBy: assetRow.created_by,
      createdAt: assetRow.created_at,
      lastModifiedBy: assetRow.last_modified_by,
      lastModifiedAt: assetRow.last_modified_at,
    },
    visibility: assertAssetVisibility(assetRow.visibility),
    sharingPolicyRef: assetRow.sharing_policy_id
      ? {
        policyId: assetRow.sharing_policy_id,
        policyVersion: assetRow.sharing_policy_version ?? undefined,
      }
      : undefined,
    storageBinding: {
      storageInstanceId: assetRow.storage_instance_id,
      uri: assetRow.storage_uri,
    },
    versions: versionRows
      .map((row) => mapAssetVersionRowToDomain(row))
      .sort((left, right) => left.revision - right.revision),
    currentVersionId: assetRow.current_version_id,
    lifecycle: {
      state: assertAssetLifecycleState(assetRow.lifecycle_state),
      archivedAt: assetRow.archived_at ?? undefined,
      archivedBy: assetRow.archived_by ?? undefined,
      deletedAt: assetRow.deleted_at ?? undefined,
      deletedBy: assetRow.deleted_by ?? undefined,
    },
  });
}

export function mapAssetRecordToRowValues(asset: Asset): ReadonlyArray<unknown> {
  const latestVersion = asset.versions.find((version) => version.versionId === asset.currentVersionId);

  return Object.freeze([
    asset.id,
    asset.ownership.workspaceId,
    asset.ownership.ownerUserId ?? null,
    asset.storageBinding.storageInstanceId,
    asset.storageBinding.uri,
    asset.kind,
    asset.visibility,
    asset.sharingPolicyRef?.policyId ?? null,
    asset.sharingPolicyRef?.policyVersion ?? null,
    asset.lifecycle.state,
    asset.lifecycle.archivedAt ?? null,
    asset.lifecycle.archivedBy ?? null,
    asset.lifecycle.deletedAt ?? null,
    asset.lifecycle.deletedBy ?? null,
    latestVersion?.content.originalFileName ?? null,
    asset.currentVersionId,
    asset.ownership.createdBy,
    asset.ownership.createdAt,
    asset.ownership.lastModifiedBy,
    asset.ownership.lastModifiedAt,
  ]);
}

export function mapAssetVersionToRowValues(asset: Asset): ReadonlyArray<ReadonlyArray<unknown>> {
  return Object.freeze(asset.versions
    .map((version) => Object.freeze([
      asset.id,
      version.versionId,
      version.revision,
      version.location.storageInstance.storageInstanceId,
      version.location.storageInstance.uri,
      version.location.objectKey,
      version.location.objectVersionId ?? null,
      version.location.area,
      version.content.mimeType,
      version.content.sizeBytes,
      version.content.checksum.algorithm,
      version.content.checksum.digest,
      version.content.originalFileName ?? null,
      version.content.encryption ? JSON.stringify(version.content.encryption) : null,
      version.createdBy,
      version.createdAt,
    ])));
}

export function mapLineageRowToLink(row: AssetLineageLinkRow): {
  readonly sourceAssetId: string;
  readonly sourceAssetVersionId?: string;
  readonly relation: AssetLineageRelation;
} {
  return Object.freeze({
    sourceAssetId: row.source_asset_id,
    sourceAssetVersionId: row.source_asset_version_id ?? undefined,
    relation: assertLineageRelation(row.relation),
  });
}

export function normalizeAssetLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function normalizeLineageRelation(value?: string): AssetLineageRelation {
  const normalized = value?.trim() as AssetLineageRelation | undefined;
  if (!normalized) {
    return AssetLineageRelations.derivedFrom;
  }
  return assertLineageRelation(normalized);
}

function mapAssetVersionRowToDomain(row: AssetVersionRow) {
  return createAssetVersion({
    versionId: row.version_id,
    revision: row.revision,
    location: {
      storageInstance: {
        storageInstanceId: row.storage_instance_id,
        uri: row.storage_uri,
      },
      objectKey: row.object_key,
      objectVersionId: row.object_version_id ?? undefined,
      area: assertStorageArea(row.storage_area),
    },
    content: {
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      checksum: {
        algorithm: assertChecksumAlgorithm(row.checksum_algorithm),
        digest: row.checksum_digest,
      },
      originalFileName: row.original_file_name ?? undefined,
      encryption: parseContentEncryptionDescriptor(row.content_encryption_descriptor),
    },
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

function assertAssetKind(value: string): AssetKind {
  if (Object.values(AssetKinds).includes(value as AssetKind)) {
    return value as AssetKind;
  }
  throw new Error(`Persisted asset kind '${value}' is invalid.`);
}

function assertAssetVisibility(value: string): AssetVisibility {
  if (Object.values(AssetVisibilities).includes(value as AssetVisibility)) {
    return value as AssetVisibility;
  }
  throw new Error(`Persisted asset visibility '${value}' is invalid.`);
}

function assertAssetLifecycleState(value: string): AssetLifecycleState {
  if (Object.values(AssetLifecycleStates).includes(value as AssetLifecycleState)) {
    return value as AssetLifecycleState;
  }
  throw new Error(`Persisted asset lifecycle state '${value}' is invalid.`);
}

function assertStorageArea(value: string): AssetStorageArea {
  if (Object.values(AssetStorageAreas).includes(value as AssetStorageArea)) {
    return value as AssetStorageArea;
  }
  throw new Error(`Persisted asset storage area '${value}' is invalid.`);
}

function assertChecksumAlgorithm(value: string): AssetChecksumAlgorithm {
  if (Object.values(AssetChecksumAlgorithms).includes(value as AssetChecksumAlgorithm)) {
    return value as AssetChecksumAlgorithm;
  }
  throw new Error(`Persisted asset checksum algorithm '${value}' is invalid.`);
}

function assertLineageRelation(value: string): AssetLineageRelation {
  if (Object.values(AssetLineageRelations).includes(value as AssetLineageRelation)) {
    return value as AssetLineageRelation;
  }
  throw new Error(`Persisted asset lineage relation '${value}' is invalid.`);
}

function parseContentEncryptionDescriptor(serialized: string | null): {
  readonly format: "asset-content/aes-256-gcm/v1";
  readonly algorithm: "aes-256-gcm";
  readonly keyReferenceId: string;
  readonly keyId: string;
  readonly keyVersion?: string;
  readonly keyScope: "server" | "workspace" | "storage-instance";
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly ivBase64: string;
  readonly authTagBase64: string;
  readonly aad: string;
  readonly encryptedAt: string;
} | undefined {
  if (!serialized) {
    return undefined;
  }

  const parsed = JSON.parse(serialized) as Partial<{
    readonly format: string;
    readonly algorithm: string;
    readonly keyReferenceId: string;
    readonly keyId: string;
    readonly keyVersion?: string;
    readonly keyScope: string;
    readonly workspaceId?: string;
    readonly storageInstanceId?: string;
    readonly ivBase64: string;
    readonly authTagBase64: string;
    readonly aad: string;
    readonly encryptedAt: string;
  }>;

  if (parsed.format !== AssetContentEncryptionFormats.aes256GcmV1) {
    throw new Error(`Persisted asset content encryption format '${String(parsed.format)}' is invalid.`);
  }
  if (parsed.algorithm !== "aes-256-gcm") {
    throw new Error(`Persisted asset content encryption algorithm '${String(parsed.algorithm)}' is invalid.`);
  }
  if (!parsed.keyReferenceId?.trim() || !parsed.keyId?.trim()) {
    throw new Error("Persisted asset content encryption key metadata is invalid.");
  }
  if (!Object.values(AssetContentEncryptionKeyScopes).includes(parsed.keyScope as "server")) {
    throw new Error(`Persisted asset content encryption keyScope '${String(parsed.keyScope)}' is invalid.`);
  }
  if (!parsed.ivBase64?.trim() || !parsed.authTagBase64?.trim() || !parsed.aad?.trim() || !parsed.encryptedAt?.trim()) {
    throw new Error("Persisted asset content encryption descriptor is incomplete.");
  }

  return Object.freeze({
    format: AssetContentEncryptionFormats.aes256GcmV1,
    algorithm: "aes-256-gcm",
    keyReferenceId: parsed.keyReferenceId.trim(),
    keyId: parsed.keyId.trim(),
    keyVersion: parsed.keyVersion?.trim() || undefined,
    keyScope: parsed.keyScope as "server" | "workspace" | "storage-instance",
    workspaceId: parsed.workspaceId?.trim() || undefined,
    storageInstanceId: parsed.storageInstanceId?.trim() || undefined,
    ivBase64: parsed.ivBase64.trim(),
    authTagBase64: parsed.authTagBase64.trim(),
    aad: parsed.aad.trim(),
    encryptedAt: parsed.encryptedAt.trim(),
  });
}

