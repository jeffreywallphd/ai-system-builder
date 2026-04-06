import { z } from "zod";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageEncryptionKeyScopes,
  StorageEncryptionModes,
  StorageLifecycleStates,
  StorageReplicationModes,
  StorageRetentionExpiryActions,
} from "../../../domain/storage/StorageDomain";
import {
  PersistenceAuditStampSchema,
  PersistenceIdentifierSchema,
  PersistenceTenancyMetadataSchema,
  PersistenceVersionMetadataSchema,
  parsePersistenceSchema,
} from "../persistence/PersistenceSchemaPrimitives";

const StorageBackendTypeSchema = z.enum([
  StorageBackendTypes.objectStorage,
  StorageBackendTypes.managedFilesystem,
  StorageBackendTypes.nasShare,
]);

const StorageLifecycleStateSchema = z.enum([
  StorageLifecycleStates.provisioning,
  StorageLifecycleStates.active,
  StorageLifecycleStates.degraded,
  StorageLifecycleStates.readOnly,
  StorageLifecycleStates.offline,
  StorageLifecycleStates.retired,
]);

const StorageAccessModeSchema = z.enum([
  StorageAccessModes.readOnly,
  StorageAccessModes.readWrite,
  StorageAccessModes.appendOnly,
]);

const StorageAccessScopeSchema = z.enum([
  StorageAccessScopes.ownerOnly,
  StorageAccessScopes.workspaceMembers,
  StorageAccessScopes.sharedReadOnly,
]);

const StorageReplicationModeSchema = z.enum([
  StorageReplicationModes.none,
  StorageReplicationModes.asyncMirror,
  StorageReplicationModes.syncMirror,
]);

const StorageEncryptionModeSchema = z.enum([
  StorageEncryptionModes.none,
  StorageEncryptionModes.platformManaged,
  StorageEncryptionModes.customerManaged,
]);

const StorageEncryptionKeyScopeSchema = z.enum([
  StorageEncryptionKeyScopes.platform,
  StorageEncryptionKeyScopes.workspace,
  StorageEncryptionKeyScopes.storageInstance,
]);

const StorageRetentionExpiryActionSchema = z.enum([
  StorageRetentionExpiryActions.delete,
  StorageRetentionExpiryActions.archive,
  StorageRetentionExpiryActions.quarantine,
]);

const StorageOwnershipSchema = z.object({
  workspaceId: PersistenceIdentifierSchema,
  ownerUserIdentityId: PersistenceIdentifierSchema,
});

const StorageAccessSchema = z.object({
  mode: StorageAccessModeSchema,
  scope: StorageAccessScopeSchema,
});

const StorageReplicationSchema = z.object({
  mode: StorageReplicationModeSchema,
  replicaStorageInstanceId: PersistenceIdentifierSchema.optional(),
  syncIntervalSeconds: z.number().int().positive().optional(),
});

const StoragePolicySchema = z.object({
  policyId: PersistenceIdentifierSchema,
  maxObjectBytes: z.number().int().positive().optional(),
  retentionDays: z.number().int().positive().optional(),
  immutableWrites: z.boolean(),
  allowCrossWorkspaceReads: z.boolean(),
  labels: z.record(z.string()),
  encryption: z.object({
    profileId: PersistenceIdentifierSchema,
    keyReferenceId: PersistenceIdentifierSchema.optional(),
    envelopeRequired: z.boolean(),
  }),
  security: z.object({
    encryptionMode: StorageEncryptionModeSchema,
    contentEncryptionRequired: z.boolean(),
    keyScope: StorageEncryptionKeyScopeSchema,
    allowPreviewDecryption: z.boolean(),
    allowWorkerDecryption: z.boolean(),
  }),
  lifecycle: z.object({
    retentionExpiryAction: StorageRetentionExpiryActionSchema,
    purgeGracePeriodDays: z.number().int().nonnegative().optional(),
  }),
});

export const StorageInstancePersistenceRecordSchema = z.object({
  storageInstanceId: PersistenceIdentifierSchema,
  displayName: z.string().trim().min(1).max(120),
  backendType: StorageBackendTypeSchema,
  lifecycleState: StorageLifecycleStateSchema,
  ownership: StorageOwnershipSchema,
  access: StorageAccessSchema,
  replication: StorageReplicationSchema,
  policy: StoragePolicySchema,
  tenancy: PersistenceTenancyMetadataSchema,
  lastCorrelationId: PersistenceIdentifierSchema,
}).merge(PersistenceAuditStampSchema).merge(PersistenceVersionMetadataSchema);

export type StorageInstancePersistenceRecordPayload = z.infer<typeof StorageInstancePersistenceRecordSchema>;

export function parseStorageInstancePersistenceRecord(payload: unknown): StorageInstancePersistenceRecordPayload {
  return parsePersistenceSchema(
    "StorageInstancePersistenceRecord",
    StorageInstancePersistenceRecordSchema,
    payload,
  );
}
