import { describe, expect, it } from "bun:test";
import {
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageManagedActions,
  StoragePolicyRestrictedCapabilities,
} from "../../../../domain/storage/StorageDomain";
import {
  StorageSensitiveRedactionReasons,
  StorageTransportContractError,
  StorageTransportContractVersions,
  StorageTransportScopes,
  StorageSyncStatuses,
  toStorageInstanceDetailDto,
  toStorageInstanceSummaryDto,
} from "../StorageTransportContracts";

describe("StorageTransportContracts", () => {
  it("defines explicit admin and internal storage transport scopes", () => {
    expect(StorageTransportScopes.admin).toBe("admin");
    expect(StorageTransportScopes.internal).toBe("internal");
  });

  it("projects internal detail payloads to admin-safe detail DTOs", () => {
    const adminSafe = toStorageInstanceDetailDto({
      storageInstanceId: "storage-managed-001",
      workspaceId: "workspace:alpha",
      backendType: StorageBackendTypes.objectStorage,
      display: {
        displayName: "Shared Outputs",
        description: "Shared output storage.",
      },
      lifecycle: {
        state: StorageLifecycleStates.active,
        createdAt: "2026-04-06T12:00:00.000Z",
        lastModifiedAt: "2026-04-06T12:10:00.000Z",
        lastCorrelationId: "corr:storage:1",
      },
      ownerUserIdentityId: "user:owner-1",
      access: {
        workspaceId: "workspace:alpha",
        ownerUserIdentityId: "user:owner-1",
        actorUserIdentityId: "user:owner-1",
        mode: "read-write",
        scope: "workspace-members",
        isOwner: true,
        source: "authorization-policy",
        effectivePermissions: [
          {
            action: StorageManagedActions.view,
            effect: "allowed",
          },
          {
            action: StorageManagedActions.updateMetadata,
            effect: "allowed",
          },
          {
            action: StorageManagedActions.provision,
            effect: "allowed",
          },
          {
            action: StorageManagedActions.activate,
            effect: "allowed",
          },
          {
            action: StorageManagedActions.deactivate,
            effect: "allowed",
          },
          {
            action: StorageManagedActions.useForAssets,
            effect: "allowed",
          },
        ],
        allowedActions: [
          StorageManagedActions.view,
          StorageManagedActions.updateMetadata,
          StorageManagedActions.provision,
          StorageManagedActions.activate,
          StorageManagedActions.deactivate,
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
        policyId: "policy:storage:1",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {
          role: "outputs",
        },
        encryptionMode: "customer-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "none",
        encryptionProfileId: "enc:default",
        envelopeRequired: true,
        hasEncryptionKeyReference: true,
      },
      replication: {
        mode: "async-mirror",
        replicaStorageInstanceId: "storage-managed-002",
        syncIntervalSeconds: 60,
        lastSyncStatus: StorageSyncStatuses.healthy,
      },
      sensitive: {
        backendCredentialReferenceId: "secret:backend",
        infrastructureBindingReferenceId: "infra:binding",
      },
    });

    expect(adminSafe.storageInstanceId).toBe("storage-managed-001");
    expect(adminSafe.sensitiveRedaction?.contractVersion).toBe(StorageTransportContractVersions.v1);
    expect(adminSafe.sensitiveRedaction?.redactedFields).toEqual([
      {
        field: "backendCredentialReferenceId",
        reason: StorageSensitiveRedactionReasons.securitySensitive,
        strategy: "omitted",
      },
      {
        field: "infrastructureBindingReferenceId",
        reason: StorageSensitiveRedactionReasons.infrastructureInternal,
        strategy: "omitted",
      },
    ]);
    expect((adminSafe as unknown as { sensitive?: unknown }).sensitive).toBeUndefined();
  });

  it("projects summary DTOs without adding internal-only fields", () => {
    const summary = toStorageInstanceSummaryDto({
      storageInstanceId: "storage-managed-003",
      workspaceId: "workspace:beta",
      backendType: StorageBackendTypes.networkShare,
      display: {
        displayName: "Training Assets",
      },
      lifecycle: {
        state: StorageLifecycleStates.suspended,
        createdAt: "2026-04-06T11:00:00.000Z",
        lastModifiedAt: "2026-04-06T11:30:00.000Z",
      },
    });

    expect(summary.display.displayName).toBe("Training Assets");
    expect((summary as unknown as { policy?: unknown }).policy).toBeUndefined();
  });

  it("rejects detail projection when storage identifier is empty", () => {
    expect(() => toStorageInstanceDetailDto({
      storageInstanceId: " ",
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
        mode: "read-only",
        scope: "workspace-members",
        isOwner: false,
        source: "unknown",
        effectivePermissions: [{
          action: StorageManagedActions.view,
          effect: "allowed",
        }],
        allowedActions: [StorageManagedActions.view],
        policyRestrictedCapabilities: [],
      },
      policy: {
        policyId: "policy:storage:2",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "none",
        encryptionProfileId: "enc:default",
        envelopeRequired: true,
        hasEncryptionKeyReference: false,
      },
      replication: {
        mode: "none",
        lastSyncStatus: StorageSyncStatuses.disabled,
      },
    })).toThrow(StorageTransportContractError);
  });
});
