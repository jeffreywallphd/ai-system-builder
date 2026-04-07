import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageBackendType,
  StorageEncryptionKeyScope,
  StorageEncryptionMode,
  StorageLifecycleState,
  StorageReplicationMode,
  StorageRetentionExpiryAction,
} from "@domain/storage/StorageDomain";
import type {
  PersistenceAuditStamp,
  PersistenceMutationResult,
  PersistenceTenancyMetadata,
  PersistenceVersionMetadata,
} from "../persistence/PersistenceBoundaryDtos";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export interface StoragePersistenceWriteContext {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StoragePersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: StoragePersistenceWriteContext;
}

export interface StorageOwnershipPersistenceRecord {
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
}

export interface StorageAccessPersistenceRecord {
  readonly mode: StorageAccessMode;
  readonly scope: StorageAccessScope;
}

export interface StorageReplicationPersistenceRecord {
  readonly mode: StorageReplicationMode;
  readonly replicaStorageInstanceId?: string;
  readonly syncIntervalSeconds?: number;
}

export interface StoragePolicyPersistenceRecord {
  readonly policyId: string;
  readonly maxObjectBytes?: number;
  readonly retentionDays?: number;
  readonly immutableWrites: boolean;
  readonly allowCrossWorkspaceReads: boolean;
  readonly labels: Readonly<Record<string, string>>;
  readonly encryption: {
    readonly profileId: string;
    readonly keyReferenceId?: string;
    readonly envelopeRequired: boolean;
  };
  readonly security: {
    readonly encryptionMode: StorageEncryptionMode;
    readonly contentEncryptionRequired: boolean;
    readonly keyScope: StorageEncryptionKeyScope;
    readonly allowPreviewDecryption: boolean;
    readonly allowWorkerDecryption: boolean;
  };
  readonly lifecycle: {
    readonly retentionExpiryAction: StorageRetentionExpiryAction;
    readonly purgeGracePeriodDays?: number;
  };
}

export interface StorageInstancePersistenceRecord extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly storageInstanceId: string;
  readonly displayName: string;
  readonly backendType: StorageBackendType;
  readonly lifecycleState: StorageLifecycleState;
  readonly ownership: StorageOwnershipPersistenceRecord;
  readonly access: StorageAccessPersistenceRecord;
  readonly replication: StorageReplicationPersistenceRecord;
  readonly policy: StoragePolicyPersistenceRecord;
  readonly tenancy: PersistenceTenancyMetadata;
  readonly lastCorrelationId: string;
}

export interface StorageInstancePersistenceLookupQuery {
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly storageInstanceIds?: ReadonlyArray<string>;
  readonly backendTypes?: ReadonlyArray<StorageBackendType>;
  readonly lifecycleStates?: ReadonlyArray<StorageLifecycleState>;
  readonly accessModes?: ReadonlyArray<StorageAccessMode>;
  readonly accessScopes?: ReadonlyArray<StorageAccessScope>;
  readonly limit?: number;
  readonly offset?: number;
}

export type StoragePersistenceMutationResult<TRecord> = PersistenceMutationResult<TRecord>;

export function normalizeStorageMutationOperationKey(operationKey: string): string {
  return normalizePersistenceOperationKey(operationKey);
}

