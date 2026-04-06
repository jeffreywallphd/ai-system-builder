import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageReplicationModes,
  createStorageInstance,
} from "../../../../domain/storage/StorageDomain";
import {
  mapStorageInstanceRowToDomain,
  mapStorageInstanceToRowValues,
  normalizeStorageLookup,
  parseStorageMutationReplayRecord,
  type StorageInstanceMutationReplayRow,
  type StorageInstanceRow,
} from "../StorageInstancePersistenceMapper";

describe("StorageInstancePersistenceMapper", () => {
  it("maps storage instance rows to canonical domain model", () => {
    const row: StorageInstanceRow = {
      storage_instance_id: "storage-alpha",
      display_name: "Storage Alpha",
      backend_type: StorageBackendTypes.objectStorage,
      lifecycle_state: StorageLifecycleStates.active,
      workspace_id: "workspace-alpha",
      owner_user_identity_id: "user-owner",
      access_mode: StorageAccessModes.readOnly,
      access_scope: StorageAccessScopes.workspaceMembers,
      replication_mode: StorageReplicationModes.syncMirror,
      replica_storage_instance_id: "storage-replica",
      sync_interval_seconds: null,
      policy_id: "policy-alpha",
      policy_max_object_bytes: 1024,
      policy_retention_days: 30,
      policy_immutable_writes: 1,
      policy_allow_cross_workspace_reads: 1,
      policy_labels_json: JSON.stringify({ tier: "gold" }),
      policy_encryption_profile_id: "profile-default",
      policy_encryption_key_reference_id: "keyref-alpha",
      policy_encryption_envelope_required: 1,
      policy_security_encryption_mode: "customer-managed",
      policy_security_content_encryption_required: 1,
      policy_security_key_scope: "storage-instance",
      policy_security_allow_preview_decryption: 1,
      policy_security_allow_worker_decryption: 0,
      policy_lifecycle_retention_expiry_action: "delete",
      policy_lifecycle_purge_grace_period_days: 7,
      backend_binding_reference_id: null,
      provisioning_reference_id: null,
      created_by: "user-owner",
      created_at: "2026-04-06T12:00:00.000Z",
      last_modified_by: "user-owner",
      last_modified_at: "2026-04-06T12:00:00.000Z",
      last_correlation_id: "corr-storage-alpha",
    };

    const mapped = mapStorageInstanceRowToDomain(row);
    expect(mapped.id).toBe("storage-alpha");
    expect(mapped.policy.labels.tier).toBe("gold");
    expect(mapped.policy.security.encryptionMode).toBe("customer-managed");
    expect(mapped.policy.lifecycle.purgeGracePeriodDays).toBe(7);
    expect(mapped.replication.mode).toBe(StorageReplicationModes.syncMirror);
  });

  it("maps domain storage instances to ordered row values and parses replay snapshots", () => {
    const storage = createStorageInstance({
      id: "storage-beta",
      displayName: "Storage Beta",
      backendType: StorageBackendTypes.managedFilesystem,
      ownership: {
        workspaceId: "workspace-beta",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-beta",
        labels: {
          region: "us-east",
        },
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:10:00.000Z",
      lastCorrelationId: "corr-storage-beta",
    });

    const values = mapStorageInstanceToRowValues(storage);
    expect(values[0]).toBe("storage-beta");
    expect(values[1]).toBe("Storage Beta");
    expect(values[6]).toBe(StorageAccessModes.readWrite);

    const replayRow: StorageInstanceMutationReplayRow = {
      operation_key: "op-storage-beta",
      mutation_kind: "create-storage-instance",
      storage_instance_id: "storage-beta",
      mutation_snapshot_json: JSON.stringify(storage),
      actor_user_identity_id: "user-owner",
      correlation_id: "corr-storage-beta",
      occurred_at: "2026-04-06T12:10:00.000Z",
      created_at: "2026-04-06T12:10:00.000Z",
    };

    const replay = parseStorageMutationReplayRecord(replayRow);
    expect(replay.id).toBe("storage-beta");
    expect(normalizeStorageLookup("  storage-beta ")).toBe("storage-beta");
    expect(normalizeStorageLookup("   ")).toBeUndefined();
  });
});
