import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageReplicationModes,
} from "../../../../domain/storage/StorageDomain";
import { StorageSyncStatuses } from "../../../contracts/storage/StorageTransportContracts";
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
        encryptionProfileId: "enc:profile:default",
        envelopeRequired: true,
      },
      createdAt: "2026-04-06T12:00:00.000Z",
      lifecycleState: StorageLifecycleStates.provisioning,
    });

    expect(parsed.storageInstanceId).toBe("storage-managed-201");
    expect(parsed.display.tags).toEqual(["outputs", "publish"]);
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
          mode: StorageAccessModes.readOnly,
          scope: StorageAccessScopes.workspaceMembers,
          canRead: true,
          canWrite: false,
          canDelete: true,
          canManagePolicy: true,
          canManageLifecycle: true,
        },
        policy: {
          policyId: "policy:storage:204",
          immutableWrites: false,
          allowCrossWorkspaceReads: false,
          labels: {},
          encryptionProfileId: "enc:profile:default",
          envelopeRequired: true,
          hasEncryptionKeyReference: true,
        },
        replication: {
          mode: StorageReplicationModes.none,
          lastSyncStatus: StorageSyncStatuses.disabled,
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

    expect(parsed.storage.policy.hasEncryptionKeyReference).toBeTrue();
    expect(parsed.storage.sensitiveRedaction?.redactedFields[0]?.field).toBe("encryptionKeyReferenceId");

    expect(() => parseCreateStorageInstanceResponseDto({
      storage: {
        ...parsed.storage,
        sensitive: {
          encryptionKeyReferenceId: "leak",
        },
      },
    })).toThrow(StorageTransportSchemaValidationError);
  });
});
