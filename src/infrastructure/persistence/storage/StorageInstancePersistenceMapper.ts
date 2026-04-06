import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageEncryptionKeyScopes,
  StorageEncryptionModes,
  StorageLifecycleStates,
  StorageReplicationModes,
  StorageRetentionExpiryActions,
  createStorageInstance,
  type StorageAccessMode,
  type StorageAccessScope,
  type StorageBackendType,
  type StorageEncryptionKeyScope,
  type StorageEncryptionMode,
  type StorageInstance,
  type StorageLifecycleState,
  type StorageReplicationMode,
  type StorageRetentionExpiryAction,
} from "../../../domain/storage/StorageDomain";

export interface StorageInstanceRow {
  readonly storage_instance_id: string;
  readonly display_name: string;
  readonly backend_type: StorageBackendType;
  readonly lifecycle_state: StorageLifecycleState;
  readonly workspace_id: string;
  readonly owner_user_identity_id: string;
  readonly access_mode: StorageAccessMode;
  readonly access_scope: StorageAccessScope;
  readonly replication_mode: StorageReplicationMode;
  readonly replica_storage_instance_id: string | null;
  readonly sync_interval_seconds: number | null;
  readonly policy_id: string;
  readonly policy_max_object_bytes: number | null;
  readonly policy_retention_days: number | null;
  readonly policy_immutable_writes: number;
  readonly policy_allow_cross_workspace_reads: number;
  readonly policy_labels_json: string;
  readonly policy_encryption_profile_id: string;
  readonly policy_encryption_key_reference_id: string | null;
  readonly policy_encryption_envelope_required: number;
  readonly policy_security_encryption_mode: StorageEncryptionMode;
  readonly policy_security_content_encryption_required: number;
  readonly policy_security_key_scope: StorageEncryptionKeyScope;
  readonly policy_security_allow_preview_decryption: number;
  readonly policy_security_allow_worker_decryption: number;
  readonly policy_lifecycle_retention_expiry_action: StorageRetentionExpiryAction;
  readonly policy_lifecycle_purge_grace_period_days: number | null;
  readonly backend_binding_reference_id: string | null;
  readonly provisioning_reference_id: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly last_modified_by: string;
  readonly last_modified_at: string;
  readonly last_correlation_id: string;
}

export interface StorageInstanceMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: "create-storage-instance" | "save-storage-instance";
  readonly storage_instance_id: string;
  readonly mutation_snapshot_json: string;
  readonly actor_user_identity_id: string;
  readonly correlation_id: string | null;
  readonly occurred_at: string;
  readonly created_at: string;
}

export function mapStorageInstanceRowToDomain(row: StorageInstanceRow): StorageInstance {
  return createStorageInstance({
    id: row.storage_instance_id,
    displayName: row.display_name,
    backendType: assertStorageBackendType(row.backend_type),
    lifecycleState: assertStorageLifecycleState(row.lifecycle_state),
    ownership: {
      workspaceId: row.workspace_id,
      ownerUserIdentityId: row.owner_user_identity_id,
    },
    access: {
      mode: assertStorageAccessMode(row.access_mode),
      scope: assertStorageAccessScope(row.access_scope),
    },
    replication: {
      mode: assertStorageReplicationMode(row.replication_mode),
      replicaStorageInstanceId: row.replica_storage_instance_id ?? undefined,
      syncIntervalSeconds: row.sync_interval_seconds ?? undefined,
    },
    policy: {
      policyId: row.policy_id,
      maxObjectBytes: row.policy_max_object_bytes ?? undefined,
      retentionDays: row.policy_retention_days ?? undefined,
      immutableWrites: toBoolean(row.policy_immutable_writes),
      allowCrossWorkspaceReads: toBoolean(row.policy_allow_cross_workspace_reads),
      labels: parseLabelsJson(row.policy_labels_json),
      encryption: {
        profileId: row.policy_encryption_profile_id,
        keyReferenceId: row.policy_encryption_key_reference_id ?? undefined,
        envelopeRequired: toBoolean(row.policy_encryption_envelope_required),
      },
      security: {
        encryptionMode: assertStorageEncryptionMode(row.policy_security_encryption_mode),
        contentEncryptionRequired: toBoolean(row.policy_security_content_encryption_required),
        keyScope: assertStorageEncryptionKeyScope(row.policy_security_key_scope),
        allowPreviewDecryption: toBoolean(row.policy_security_allow_preview_decryption),
        allowWorkerDecryption: toBoolean(row.policy_security_allow_worker_decryption),
      },
      lifecycle: {
        retentionExpiryAction: assertStorageRetentionExpiryAction(row.policy_lifecycle_retention_expiry_action),
        purgeGracePeriodDays: row.policy_lifecycle_purge_grace_period_days ?? undefined,
      },
    },
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastModifiedBy: row.last_modified_by,
    lastModifiedAt: row.last_modified_at,
    lastCorrelationId: row.last_correlation_id,
  });
}

export function mapStorageInstanceToRowValues(storageInstance: StorageInstance): ReadonlyArray<unknown> {
  return Object.freeze([
    storageInstance.id,
    storageInstance.displayName,
    storageInstance.backendType,
    storageInstance.lifecycleState,
    storageInstance.ownership.workspaceId,
    storageInstance.ownership.ownerUserIdentityId,
    storageInstance.access.mode,
    storageInstance.access.scope,
    storageInstance.replication.mode,
    storageInstance.replication.replicaStorageInstanceId ?? null,
    storageInstance.replication.syncIntervalSeconds ?? null,
    storageInstance.policy.policyId,
    storageInstance.policy.maxObjectBytes ?? null,
    storageInstance.policy.retentionDays ?? null,
    toSqliteBoolean(storageInstance.policy.immutableWrites),
    toSqliteBoolean(storageInstance.policy.allowCrossWorkspaceReads),
    JSON.stringify(storageInstance.policy.labels),
    storageInstance.policy.encryption.profileId,
    storageInstance.policy.encryption.keyReferenceId ?? null,
    toSqliteBoolean(storageInstance.policy.encryption.envelopeRequired),
    storageInstance.policy.security.encryptionMode,
    toSqliteBoolean(storageInstance.policy.security.contentEncryptionRequired),
    storageInstance.policy.security.keyScope,
    toSqliteBoolean(storageInstance.policy.security.allowPreviewDecryption),
    toSqliteBoolean(storageInstance.policy.security.allowWorkerDecryption),
    storageInstance.policy.lifecycle.retentionExpiryAction,
    storageInstance.policy.lifecycle.purgeGracePeriodDays ?? null,
    null,
    null,
    storageInstance.createdBy,
    storageInstance.createdAt,
    storageInstance.lastModifiedBy,
    storageInstance.lastModifiedAt,
    storageInstance.lastCorrelationId,
  ]);
}

export function parseStorageMutationReplayRecord(row: StorageInstanceMutationReplayRow): StorageInstance {
  const parsed = JSON.parse(row.mutation_snapshot_json) as StorageInstance;
  return createStorageInstance(parsed);
}

export function normalizeStorageLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseLabelsJson(value: string): Readonly<Record<string, string>> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Object.freeze({});
    }

    const labels: Record<string, string> = {};
    for (const [key, labelValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof labelValue !== "string") {
        continue;
      }
      labels[key] = labelValue;
    }

    return Object.freeze(labels);
  } catch {
    return Object.freeze({});
  }
}

function toSqliteBoolean(value: boolean): number {
  return value ? 1 : 0;
}

function toBoolean(value: number): boolean {
  return value === 1;
}

function assertStorageBackendType(value: string): StorageBackendType {
  if (Object.values(StorageBackendTypes).includes(value as StorageBackendType)) {
    return value as StorageBackendType;
  }
  throw new Error(`Persisted storage backend type '${value}' is invalid.`);
}

function assertStorageLifecycleState(value: string): StorageLifecycleState {
  if (Object.values(StorageLifecycleStates).includes(value as StorageLifecycleState)) {
    return value as StorageLifecycleState;
  }
  throw new Error(`Persisted storage lifecycle state '${value}' is invalid.`);
}

function assertStorageAccessMode(value: string): StorageAccessMode {
  if (Object.values(StorageAccessModes).includes(value as StorageAccessMode)) {
    return value as StorageAccessMode;
  }
  throw new Error(`Persisted storage access mode '${value}' is invalid.`);
}

function assertStorageAccessScope(value: string): StorageAccessScope {
  if (Object.values(StorageAccessScopes).includes(value as StorageAccessScope)) {
    return value as StorageAccessScope;
  }
  throw new Error(`Persisted storage access scope '${value}' is invalid.`);
}

function assertStorageReplicationMode(value: string): StorageReplicationMode {
  if (Object.values(StorageReplicationModes).includes(value as StorageReplicationMode)) {
    return value as StorageReplicationMode;
  }
  throw new Error(`Persisted storage replication mode '${value}' is invalid.`);
}

function assertStorageEncryptionMode(value: string): StorageEncryptionMode {
  if (Object.values(StorageEncryptionModes).includes(value as StorageEncryptionMode)) {
    return value as StorageEncryptionMode;
  }
  throw new Error(`Persisted storage encryption mode '${value}' is invalid.`);
}

function assertStorageEncryptionKeyScope(value: string): StorageEncryptionKeyScope {
  if (Object.values(StorageEncryptionKeyScopes).includes(value as StorageEncryptionKeyScope)) {
    return value as StorageEncryptionKeyScope;
  }
  throw new Error(`Persisted storage key scope '${value}' is invalid.`);
}

function assertStorageRetentionExpiryAction(value: string): StorageRetentionExpiryAction {
  if (Object.values(StorageRetentionExpiryActions).includes(value as StorageRetentionExpiryAction)) {
    return value as StorageRetentionExpiryAction;
  }
  throw new Error(`Persisted storage retentionExpiryAction '${value}' is invalid.`);
}
