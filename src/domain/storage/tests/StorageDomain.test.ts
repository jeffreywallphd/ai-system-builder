import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageDomainError,
  StorageLifecycleStates,
  StorageLifecycleTransitionError,
  StorageReplicationModes,
  assertStorageInstanceActive,
  createStorageAttribution,
  createStorageInstance,
  createStorageReplicationPolicy,
  transitionStorageLifecycle,
  updateStoragePolicy,
} from "../StorageDomain";

describe("StorageDomain", () => {
  it("creates managed storage instances with normalized contracts", () => {
    const instance = createStorageInstance({
      id: "storage-primary-01",
      displayName: "Primary Workspace Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownership: {
        workspaceId: "workspace-1",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspace,
      },
      policy: {
        policyId: "storage-policy-1",
        immutableWrites: true,
        retentionDays: 30,
        maxObjectBytes: 10_000_000,
        labels: {
          tier: "standard",
        },
        encryption: {
          profileId: "encryption-profile:workspace-default",
          keyReferenceId: "kek:workspace-1",
          envelopeRequired: true,
        },
      },
      lifecycleState: StorageLifecycleStates.active,
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "audit.storage.create.1",
    });

    expect(instance.id).toBe("storage-primary-01");
    expect(instance.lifecycleState).toBe(StorageLifecycleStates.active);
    expect(instance.policy.retentionDays).toBe(30);
    expect(instance.policy.encryption.profileId).toBe("encryption-profile:workspace-default");
  });

  it("enforces replication policy invariants", () => {
    expect(() => createStorageReplicationPolicy({
      mode: StorageReplicationModes.none,
      replicaStorageInstanceId: "storage-replica-1",
    })).toThrow(StorageDomainError);

    expect(() => createStorageReplicationPolicy({
      mode: StorageReplicationModes.asyncMirror,
      replicaStorageInstanceId: "storage-replica-1",
    })).toThrow(StorageDomainError);

    expect(() => createStorageReplicationPolicy({
      mode: StorageReplicationModes.syncMirror,
      replicaStorageInstanceId: "storage-replica-1",
      syncIntervalSeconds: 60,
    })).toThrow(StorageDomainError);

    const validAsync = createStorageReplicationPolicy({
      mode: StorageReplicationModes.asyncMirror,
      replicaStorageInstanceId: "storage-replica-1",
      syncIntervalSeconds: 60,
    });
    expect(validAsync.mode).toBe(StorageReplicationModes.asyncMirror);
    expect(validAsync.syncIntervalSeconds).toBe(60);
  });

  it("rejects invalid active state combinations", () => {
    expect(() => createStorageInstance({
      id: "storage-readonly-1",
      displayName: "Read Only Mirror",
      backendType: StorageBackendTypes.objectStorage,
      ownership: {
        workspaceId: "workspace-2",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readOnly,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "storage-policy-2",
        immutableWrites: false,
        encryption: {
          profileId: "encryption-profile:workspace-default",
          envelopeRequired: true,
        },
      },
      lifecycleState: StorageLifecycleStates.active,
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "audit.storage.create.2",
    })).toThrow(StorageDomainError);
  });

  it("enforces lifecycle transitions and active-state assertions", () => {
    const created = createStorageInstance({
      id: "storage-transition-1",
      displayName: "Transition Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownership: {
        workspaceId: "workspace-3",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspace,
      },
      policy: {
        policyId: "storage-policy-3",
        immutableWrites: false,
        encryption: {
          profileId: "encryption-profile:workspace-default",
          envelopeRequired: true,
        },
      },
      lifecycleState: StorageLifecycleStates.provisioning,
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "audit.storage.create.3",
    });

    expect(() => assertStorageInstanceActive(created)).toThrow(StorageDomainError);

    const activated = transitionStorageLifecycle(
      created,
      StorageLifecycleStates.active,
      createStorageAttribution({
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-06T12:02:00.000Z",
        correlationId: "audit.storage.transition.1",
      }),
    );

    expect(activated.lifecycleState).toBe(StorageLifecycleStates.active);
    expect(() => assertStorageInstanceActive(activated)).not.toThrow();

    expect(() => transitionStorageLifecycle(
      activated,
      StorageLifecycleStates.provisioning,
      createStorageAttribution({
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-06T12:03:00.000Z",
        correlationId: "audit.storage.transition.2",
      }),
    )).toThrow(StorageLifecycleTransitionError);
  });

  it("enforces audit and timestamp attribution invariants", () => {
    expect(() => createStorageAttribution({
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:02:00.000Z",
      correlationId: "bad",
    })).toThrow(StorageDomainError);

    expect(() => createStorageInstance({
      id: "storage-timestamp-1",
      displayName: "Timestamp Test",
      backendType: StorageBackendTypes.objectStorage,
      ownership: {
        workspaceId: "workspace-4",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "storage-policy-4",
        immutableWrites: false,
        encryption: {
          profileId: "encryption-profile:workspace-default",
          envelopeRequired: true,
        },
      },
      lifecycleState: StorageLifecycleStates.provisioning,
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:05:00.000Z",
      lastModifiedAt: "2026-04-06T12:04:00.000Z",
      lastCorrelationId: "audit.storage.create.4",
    })).toThrow(StorageDomainError);
  });

  it("updates storage policy with immutable domain-safe APIs", () => {
    const created = createStorageInstance({
      id: "storage-policy-update-1",
      displayName: "Policy Update Storage",
      backendType: StorageBackendTypes.networkShare,
      ownership: {
        workspaceId: "workspace-5",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "storage-policy-5",
        immutableWrites: false,
        retentionDays: 7,
        encryption: {
          profileId: "encryption-profile:workspace-default",
          envelopeRequired: true,
        },
      },
      lifecycleState: StorageLifecycleStates.active,
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "audit.storage.create.5",
    });

    const updated = updateStoragePolicy(
      created,
      {
        retentionDays: 30,
        immutableWrites: true,
        labels: {
          purpose: "assets",
        },
      },
      createStorageAttribution({
        actorUserIdentityId: "user-admin",
        occurredAt: "2026-04-06T13:00:00.000Z",
        correlationId: "audit.storage.policy.1",
      }),
    );

    expect(updated.policy.retentionDays).toBe(30);
    expect(updated.policy.immutableWrites).toBeTrue();
    expect(updated.lastModifiedBy).toBe("user-admin");
    expect(updated.lastCorrelationId).toBe("audit.storage.policy.1");
  });
});
