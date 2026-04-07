import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageManagedActions,
  StoragePolicyRestrictedCapabilities,
  StorageReplicationModes,
} from "@domain/storage/StorageDomain";
import {
  StorageSyncDeploymentAvailabilities,
  StorageSyncStatuses,
} from "../../../contracts/storage/StorageTransportContracts";
import {
  StorageTransportSchemaValidationError,
  parseCreateStorageInstanceRequestDto,
  parseCreateStorageInstanceResponseDto,
  parseGetStorageInstanceDetailResponseDto,
  parseListStorageInstancesRequestDto,
  parseListStorageInstancesResponseDto,
  parseUpdateStorageInstanceRequestDto,
} from "../StorageTransportSchemaContracts";

describe("StorageTransportSchemaContracts", () => {
  it("parses canonical create storage request payloads", () => {
    const parsed = parseCreateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-1",
      workspaceId: "workspace:alpha",
      operationKey: "op:storage:create:1",
      correlationId: "corr:storage:create:1",
      storageInstanceId: "storage-managed-201",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Shared Outputs",
        description: "Authoritative outputs for workspace.",
        tags: ["outputs", "publish"],
        labels: {
          workload: "render",
        },
      },
      ownerUserIdentityId: "user:owner-1",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      replication: {
        mode: StorageReplicationModes.asyncMirror,
        replicaStorageInstanceId: "storage-managed-202",
        syncIntervalSeconds: 60,
      },
      policy: {
        policyId: "policy:storage:201",
        retentionDays: 90,
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {
          role: "outputs",
        },
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "archive",
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: true,
      },
      createdAt: "2026-04-06T12:00:00.000Z",
      lifecycleState: StorageLifecycleStates.provisioning,
    });

    expect(parsed.storageInstanceId).toBe("storage-managed-201");
    expect(parsed.display.tags).toEqual(["outputs", "publish"]);
    expect(parsed.policy.retentionExpiryAction).toBe("archive");
  });

  it("rejects malformed replication payloads for create", () => {
    expect(() => parseCreateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-1",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage-managed-201",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Shared Outputs",
      },
      ownerUserIdentityId: "user:owner-1",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      replication: {
        mode: StorageReplicationModes.asyncMirror,
      },
      policy: {
        policyId: "policy:storage:201",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "none",
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: true,
      },
    })).toThrow(StorageTransportSchemaValidationError);
  });

  it("rejects unsafe metadata labels and unknown extra fields", () => {
    expect(() => parseCreateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-1",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage-managed-201",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Shared Outputs",
        labels: {
          api_key: "should-not-pass",
        },
      },
      ownerUserIdentityId: "user:owner-1",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy:storage:201",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "none",
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: true,
      },
      rawFilesystemPath: "C:\\sensitive\\path",
    })).toThrow(StorageTransportSchemaValidationError);
  });

  it("requires at least one mutable field in update payload", () => {
    expect(() => parseUpdateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-1",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage-managed-202",
    })).toThrow("at least one mutable field group");
  });

  it("parses list request and response payloads", () => {
    const listQuery = parseListStorageInstancesRequestDto({
      actorUserIdentityId: "user:storage-admin-1",
      workspaceId: "workspace:alpha",
      backendTypes: [StorageBackendTypes.objectStorage],
      lifecycleStates: [StorageLifecycleStates.active],
      limit: 20,
      offset: 0,
    });
    expect(listQuery.backendTypes).toEqual([StorageBackendTypes.objectStorage]);

    const listResponse = parseListStorageInstancesResponseDto({
      items: [{
        storageInstanceId: "storage-managed-203",
        workspaceId: "workspace:alpha",
        backendType: StorageBackendTypes.objectStorage,
        display: {
          displayName: "Shared Outputs",
        },
        lifecycle: {
          state: StorageLifecycleStates.active,
          createdAt: "2026-04-06T12:00:00.000Z",
          lastModifiedAt: "2026-04-06T12:10:00.000Z",
        },
      }],
    });
    expect(listResponse.items[0]?.storageInstanceId).toBe("storage-managed-203");
  });

  it("parses admin-safe detail responses and rejects leaked sensitive fields", () => {
    const parsed = parseGetStorageInstanceDetailResponseDto({
      storage: {
        storageInstanceId: "storage-managed-204",
        workspaceId: "workspace:alpha",
        backendType: StorageBackendTypes.objectStorage,
        display: {
          displayName: "Shared Outputs",
        },
        lifecycle: {
          state: StorageLifecycleStates.active,
          createdAt: "2026-04-06T12:00:00.000Z",
          lastModifiedAt: "2026-04-06T12:10:00.000Z",
        },
        ownerUserIdentityId: "user:owner-1",
        access: {
          workspaceId: "workspace:alpha",
          ownerUserIdentityId: "user:owner-1",
          actorUserIdentityId: "user:viewer-1",
          mode: StorageAccessModes.readOnly,
          scope: StorageAccessScopes.workspaceMembers,
          isOwner: false,
          source: "authorization-policy",
          effectivePermissions: [
            {
              action: StorageManagedActions.view,
              effect: "allowed",
            },
            {
              action: StorageManagedActions.updateMetadata,
              effect: "denied",
              reasonCode: "read-only-mode",
            },
            {
              action: StorageManagedActions.provision,
              effect: "denied",
              reasonCode: "requires-admin",
            },
            {
              action: StorageManagedActions.activate,
              effect: "denied",
              reasonCode: "requires-admin",
            },
            {
              action: StorageManagedActions.deactivate,
              effect: "denied",
              reasonCode: "requires-admin",
            },
            {
              action: StorageManagedActions.useForAssets,
              effect: "allowed",
            },
          ],
          allowedActions: [
            StorageManagedActions.view,
            StorageManagedActions.useForAssets,
          ],
          policyRestrictedCapabilities: [
            {
              capability: StoragePolicyRestrictedCapabilities.previewDecryption,
              restricted: true,
              reasonCode: "preview-decryption-disabled",
            },
          ],
        },
        policy: {
          policyId: "policy:storage:204",
          immutableWrites: false,
          allowCrossWorkspaceReads: false,
          labels: {},
          encryptionMode: "platform-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
          retentionExpiryAction: "none",
          encryptionProfileId: "enc:profile:default",
          envelopeRequired: true,
          hasEncryptionKeyReference: false,
        },
        replication: {
          mode: StorageReplicationModes.none,
          lastSyncStatus: StorageSyncStatuses.disabled,
          synchronization: {
            syncCapable: true,
            supportsReplicationSyncOperation: false,
            deploymentAvailability: StorageSyncDeploymentAvailabilities.configuredInactive,
            reasonCode: "sync-deployment-configured-inactive",
            evaluatedAt: "2026-04-06T12:09:00.000Z",
          },
        },
        sensitiveRedaction: {
          contractVersion: "storage-transport/v1",
          redactedFields: [{
            field: "encryptionKeyReferenceId",
            reason: "security-sensitive",
            strategy: "omitted",
          }],
        },
      },
    });

    expect(parsed.storage.policy.hasEncryptionKeyReference).toBeFalse();
    expect(parsed.storage.sensitiveRedaction?.redactedFields[0]?.field).toBe("encryptionKeyReferenceId");
    expect(parsed.storage.replication.synchronization?.deploymentAvailability).toBe("configured-inactive");

    expect(() => parseCreateStorageInstanceResponseDto({
      storage: {
        ...parsed.storage,
        sensitive: {
          encryptionKeyReferenceId: "leak",
        },
      },
    })).toThrow(StorageTransportSchemaValidationError);
  });

  it("rejects access summaries where allowedActions do not match effective permissions", () => {
    expect(() => parseGetStorageInstanceDetailResponseDto({
      storage: {
        storageInstanceId: "storage-managed-299",
        workspaceId: "workspace:alpha",
        backendType: StorageBackendTypes.objectStorage,
        display: {
          displayName: "Shared Outputs",
        },
        lifecycle: {
          state: StorageLifecycleStates.active,
          createdAt: "2026-04-06T12:00:00.000Z",
          lastModifiedAt: "2026-04-06T12:10:00.000Z",
        },
        ownerUserIdentityId: "user:owner-1",
        access: {
          workspaceId: "workspace:alpha",
          ownerUserIdentityId: "user:owner-1",
          mode: StorageAccessModes.readWrite,
          scope: StorageAccessScopes.workspaceMembers,
          isOwner: false,
          source: "authorization-policy",
          effectivePermissions: [{
            action: StorageManagedActions.view,
            effect: "denied",
          }],
          allowedActions: [StorageManagedActions.view],
          policyRestrictedCapabilities: [],
        },
        policy: {
          policyId: "policy:storage:299",
          immutableWrites: false,
          allowCrossWorkspaceReads: false,
          labels: {},
          encryptionMode: "platform-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
          retentionExpiryAction: "none",
          encryptionProfileId: "enc:profile:default",
          envelopeRequired: true,
          hasEncryptionKeyReference: false,
        },
        replication: {
          mode: StorageReplicationModes.none,
          lastSyncStatus: StorageSyncStatuses.disabled,
        },
      },
    })).toThrow(StorageTransportSchemaValidationError);
  });

  it("rejects contradictory synchronization metadata in detail responses", () => {
    expect(() => parseGetStorageInstanceDetailResponseDto({
      storage: {
        storageInstanceId: "storage-managed-300",
        workspaceId: "workspace:alpha",
        backendType: StorageBackendTypes.objectStorage,
        display: {
          displayName: "Shared Outputs",
        },
        lifecycle: {
          state: StorageLifecycleStates.active,
          createdAt: "2026-04-06T12:00:00.000Z",
          lastModifiedAt: "2026-04-06T12:10:00.000Z",
        },
        ownerUserIdentityId: "user:owner-1",
        access: {
          workspaceId: "workspace:alpha",
          ownerUserIdentityId: "user:owner-1",
          mode: StorageAccessModes.readWrite,
          scope: StorageAccessScopes.workspaceMembers,
          isOwner: true,
          source: "authorization-policy",
          effectivePermissions: [{
            action: StorageManagedActions.view,
            effect: "allowed",
          }],
          allowedActions: [StorageManagedActions.view],
          policyRestrictedCapabilities: [],
        },
        policy: {
          policyId: "policy:storage:300",
          immutableWrites: false,
          allowCrossWorkspaceReads: false,
          labels: {},
          encryptionMode: "platform-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
          retentionExpiryAction: "none",
          encryptionProfileId: "enc:profile:default",
          envelopeRequired: true,
          hasEncryptionKeyReference: false,
        },
        replication: {
          mode: StorageReplicationModes.none,
          lastSyncStatus: StorageSyncStatuses.disabled,
          synchronization: {
            syncCapable: true,
            supportsReplicationSyncOperation: true,
            deploymentAvailability: StorageSyncDeploymentAvailabilities.unavailable,
          },
        },
      },
    })).toThrow(StorageTransportSchemaValidationError);
  });

  it("applies deterministic defaults for create policy metadata", () => {
    const parsed = parseCreateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-2",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage-managed-205",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Defaulted Policy",
      },
      ownerUserIdentityId: "user:owner-2",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy:storage:205",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: true,
      },
    });

    expect(parsed.policy.encryptionMode).toBe("platform-managed");
    expect(parsed.policy.contentEncryptionRequired).toBeTrue();
    expect(parsed.policy.keyScope).toBe("workspace");
    expect(parsed.policy.allowPreviewDecryption).toBeFalse();
    expect(parsed.policy.allowWorkerDecryption).toBeFalse();
    expect(parsed.policy.retentionExpiryAction).toBe("none");
  });

  it("rejects contradictory create policy metadata combinations", () => {
    expect(() => parseCreateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-2",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage-managed-206",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Contradictory Policy",
      },
      ownerUserIdentityId: "user:owner-2",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy:storage:206",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryptionMode: "none",
        contentEncryptionRequired: true,
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: false,
      },
    })).toThrow(StorageTransportSchemaValidationError);

    expect(() => parseCreateStorageInstanceRequestDto({
      actorUserIdentityId: "user:storage-admin-2",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage-managed-207",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Retention Hook Without Retention",
      },
      ownerUserIdentityId: "user:owner-2",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy:storage:207",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        retentionExpiryAction: "delete",
        purgeGracePeriodDays: 2,
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: true,
      },
    })).toThrow(StorageTransportSchemaValidationError);
  });
});

