import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageReplicationModes,
  createStorageInstance,
  type StorageBackendType,
  type StorageInstance,
} from "../../../../domain/storage/StorageDomain";
import {
  ServerManagedStorageSynchronizationAdapter,
  StorageSyncDeploymentAvailabilities,
  StorageSynchronizationReasonCodes,
} from "../ServerManagedStorageSynchronizationAdapter";
import { toStorageSynchronizationMetadataDto } from "../StorageSynchronizationTransportMapper";

function createStorage(
  backendType: StorageBackendType,
  replication: StorageInstance["replication"],
): StorageInstance {
  return createStorageInstance({
    id: "storage-sync-seam-test",
    displayName: "Sync seam test storage",
    backendType,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    replication,
    policy: {
      policyId: "policy-sync-seam",
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-sync-seam",
  });
}

describe("ServerManagedStorageSynchronizationAdapter", () => {
  it("reports sync-capable eligibility as configured-inactive when deployment profile is inactive", () => {
    const adapter = new ServerManagedStorageSynchronizationAdapter({
      availability: StorageSyncDeploymentAvailabilities.configuredInactive,
    });
    const storageInstance = createStorage(StorageBackendTypes.networkShare, {
      mode: StorageReplicationModes.asyncMirror,
      replicaStorageInstanceId: "storage-sync-replica",
      syncIntervalSeconds: 60,
    });

    const eligibility = adapter.assessSynchronizationEligibility({
      storageInstance,
      occurredAt: "2026-04-06T12:05:00.000Z",
    });
    const state = adapter.inspectSynchronizationState({
      storageInstance,
      occurredAt: "2026-04-06T12:05:00.000Z",
    });
    const metadata = toStorageSynchronizationMetadataDto(state);

    expect(eligibility.syncCapable).toBeTrue();
    expect(eligibility.reasonCode).toBe(StorageSynchronizationReasonCodes.deploymentConfiguredInactive);
    expect(state.status).toBe("disabled");
    expect(state.deploymentAvailability).toBe(StorageSyncDeploymentAvailabilities.configuredInactive);
    expect(metadata.deploymentAvailability).toBe("configured-inactive");
    expect(metadata.syncCapable).toBeTrue();
  });

  it("reports unavailable deployment profile as non-sync-capable even for replication-enabled storage", () => {
    const adapter = new ServerManagedStorageSynchronizationAdapter({
      availability: StorageSyncDeploymentAvailabilities.unavailable,
    });
    const storageInstance = createStorage(StorageBackendTypes.objectStorage, {
      mode: StorageReplicationModes.syncMirror,
      replicaStorageInstanceId: "storage-sync-replica",
    });

    const eligibility = adapter.assessSynchronizationEligibility({
      storageInstance,
      occurredAt: "2026-04-06T12:10:00.000Z",
    });
    const state = adapter.inspectSynchronizationState({
      storageInstance,
      occurredAt: "2026-04-06T12:10:00.000Z",
    });

    expect(eligibility.syncCapable).toBeFalse();
    expect(eligibility.reasonCode).toBe(StorageSynchronizationReasonCodes.deploymentUnavailable);
    expect(state.status).toBe("disabled");
    expect(state.reasonCode).toBe(StorageSynchronizationReasonCodes.deploymentUnavailable);
  });

  it("distinguishes non-sync-capable local storage from sync-capable shared/object backends", () => {
    const adapter = new ServerManagedStorageSynchronizationAdapter({
      availability: StorageSyncDeploymentAvailabilities.active,
    });

    const localEligibility = adapter.assessSynchronizationEligibility({
      storageInstance: createStorage(StorageBackendTypes.managedFilesystem, {
        mode: StorageReplicationModes.none,
      }),
    });
    const sharedEligibility = adapter.assessSynchronizationEligibility({
      storageInstance: createStorage(StorageBackendTypes.networkShare, {
        mode: StorageReplicationModes.none,
      }),
    });

    expect(localEligibility.syncCapable).toBeFalse();
    expect(localEligibility.reasonCode).toBe(StorageSynchronizationReasonCodes.backendNotSyncCapable);
    expect(sharedEligibility.syncCapable).toBeTrue();
    expect(sharedEligibility.reasonCode).toBe(StorageSynchronizationReasonCodes.replicationNotConfigured);
  });

  it("uses backend capability snapshots to report unsupported replication-mode sync operations", () => {
    const adapter = new ServerManagedStorageSynchronizationAdapter({
      availability: StorageSyncDeploymentAvailabilities.active,
    });
    const storageInstance = createStorage(StorageBackendTypes.networkShare, {
      mode: StorageReplicationModes.syncMirror,
      replicaStorageInstanceId: "storage-sync-replica",
    });

    const state = adapter.inspectSynchronizationState({
      storageInstance,
      backendCapabilities: {
        backendType: StorageBackendTypes.networkShare,
        supportsManagedLifecycle: true,
        supportsAsyncReplication: true,
        supportsSyncReplication: false,
        supportsReadOnlyActive: true,
        supportsCrossWorkspaceReads: false,
      },
      occurredAt: "2026-04-06T12:15:00.000Z",
    });

    expect(state.syncCapable).toBeTrue();
    expect(state.supportsReplicationSyncOperation).toBeFalse();
    expect(state.status).toBe("degraded");
    expect(state.reasonCode).toBe(StorageSynchronizationReasonCodes.replicationModeUnsupported);
  });
});
