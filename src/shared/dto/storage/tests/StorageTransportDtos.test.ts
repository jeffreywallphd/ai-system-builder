import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageManagedActions,
  StoragePolicyRestrictedCapabilities,
  StorageReplicationModes,
  createStorageInstance,
} from "../../../../domain/storage/StorageDomain";
import { toStorageInstanceDetailDto } from "../../../contracts/storage/StorageTransportContracts";
import {
  toCreateStorageInstanceResponseDto,
  toStorageInternalInstanceDetailDto,
  toStorageInternalInstanceSummaryDto,
} from "../StorageTransportDtos";

describe("StorageTransportDtos", () => {
  it("serializes storage instance detail DTOs without leaking encryption key references", () => {
    const instance = createStorageInstance({
      id: "storage-managed-100",
      displayName: "Model Training Storage",
      backendType: StorageBackendTypes.objectStorage,
      ownership: {
        workspaceId: "workspace:alpha",
        ownerUserIdentityId: "user:owner-1",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      replication: {
        mode: StorageReplicationModes.asyncMirror,
        replicaStorageInstanceId: "storage-managed-101",
        syncIntervalSeconds: 60,
      },
      policy: {
        policyId: "policy:storage:100",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {
          role: "training",
        },
        encryption: {
          profileId: "enc:profile:default",
          keyReferenceId: "key-ref-should-not-leak",
          envelopeRequired: true,
        },
        security: {
          encryptionMode: "customer-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: true,
        },
      },
      lifecycleState: StorageLifecycleStates.active,
      createdBy: "user:owner-1",
      createdAt: "2026-04-06T10:00:00.000Z",
      lastCorrelationId: "corr:storage:100",
    });

    const detail = toStorageInternalInstanceDetailDto(instance, {
      description: "Authoritative managed storage for model artifacts.",
      replicationStatus: {
        lastSyncStatus: "healthy",
      },
      sensitive: {
        encryptionKeyReferenceId: "key-ref-should-not-leak",
      },
    });
    const adminSafe = toStorageInstanceDetailDto(detail);

    expect(detail.policy.hasEncryptionKeyReference).toBeTrue();
    expect(detail.policy.encryptionMode).toBe("customer-managed");
    expect(detail.policy.allowWorkerDecryption).toBeTrue();
    expect(detail.access.allowedActions).toEqual([]);
    expect(detail.access.effectivePermissions).toHaveLength(6);
    expect(detail.access.policyRestrictedCapabilities).toEqual([
      {
        capability: StoragePolicyRestrictedCapabilities.mutableWrites,
        restricted: false,
        reasonCode: undefined,
      },
      {
        capability: StoragePolicyRestrictedCapabilities.crossWorkspaceReads,
        restricted: true,
        reasonCode: "cross-workspace-reads-disabled",
      },
      {
        capability: StoragePolicyRestrictedCapabilities.previewDecryption,
        restricted: true,
        reasonCode: "preview-decryption-disabled",
      },
      {
        capability: StoragePolicyRestrictedCapabilities.workerDecryption,
        restricted: false,
        reasonCode: undefined,
      },
    ]);
    expect((detail.policy as unknown as { encryptionKeyReferenceId?: string }).encryptionKeyReferenceId).toBeUndefined();
    expect((adminSafe as unknown as { sensitive?: unknown }).sensitive).toBeUndefined();
    expect(adminSafe.sensitiveRedaction?.redactedFields[0]?.field).toBe("encryptionKeyReferenceId");
  });

  it("serializes summary DTOs with canonical display and lifecycle metadata", () => {
    const instance = createStorageInstance({
      id: "storage-managed-102",
      displayName: "Preview Cache Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownership: {
        workspaceId: "workspace:beta",
        ownerUserIdentityId: "user:owner-2",
      },
      access: {
        mode: StorageAccessModes.readOnly,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy:storage:102",
        immutableWrites: true,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryption: {
          profileId: "enc:profile:default",
          envelopeRequired: true,
        },
      },
      createdBy: "user:owner-2",
      createdAt: "2026-04-06T09:00:00.000Z",
      lastCorrelationId: "corr:storage:102",
    });

    const summary = toStorageInternalInstanceSummaryDto(instance, {
      description: "Preview cache for generated images.",
      tags: ["preview", "cache"],
      displayLabels: {
        workload: "preview",
      },
    });

    expect(summary.display.description).toBe("Preview cache for generated images.");
    expect(summary.display.tags).toEqual(["preview", "cache"]);
    expect(summary.lifecycle.state).toBe(StorageLifecycleStates.provisioning);
  });

  it("builds admin-safe create response DTOs from domain instances", () => {
    const instance = createStorageInstance({
      id: "storage-managed-103",
      displayName: "Published Models Storage",
      backendType: StorageBackendTypes.objectStorage,
      ownership: {
        workspaceId: "workspace:gamma",
        ownerUserIdentityId: "user:owner-3",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      replication: {
        mode: StorageReplicationModes.none,
      },
      policy: {
        policyId: "policy:storage:103",
        immutableWrites: false,
        allowCrossWorkspaceReads: true,
        labels: {},
        encryption: {
          profileId: "enc:profile:default",
          keyReferenceId: "key-ref-internal",
          envelopeRequired: true,
        },
        security: {
          encryptionMode: "customer-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
      },
      createdBy: "user:owner-3",
      createdAt: "2026-04-06T08:00:00.000Z",
      lastCorrelationId: "corr:storage:103",
    });

    const response = toCreateStorageInstanceResponseDto(instance, {
      sensitive: {
        encryptionKeyReferenceId: "key-ref-internal",
      },
    });
    expect(response.storage.storageInstanceId).toBe("storage-managed-103");
    expect((response.storage as unknown as { sensitive?: unknown }).sensitive).toBeUndefined();
    expect(response.storage.sensitiveRedaction?.redactedFields[0]?.field).toBe("encryptionKeyReferenceId");
  });

  it("maps authorization-driven access summaries into storage detail DTOs", () => {
    const instance = createStorageInstance({
      id: "storage-managed-104",
      displayName: "Asset Pipeline Storage",
      backendType: StorageBackendTypes.objectStorage,
      ownership: {
        workspaceId: "workspace:delta",
        ownerUserIdentityId: "user:owner-4",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy:storage:104",
        immutableWrites: true,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryption: {
          profileId: "enc:profile:default",
          envelopeRequired: true,
        },
      },
      createdBy: "user:owner-4",
      createdAt: "2026-04-06T08:30:00.000Z",
      lastCorrelationId: "corr:storage:104",
    });

    const detail = toStorageInternalInstanceDetailDto(instance, {
      accessSummary: {
        actorUserIdentityId: "user:operator-4",
        source: "authorization-policy",
        effectivePermissions: [
          { action: StorageManagedActions.view, effect: "allowed" },
          { action: StorageManagedActions.updateMetadata, effect: "denied", reasonCode: "requires-admin" },
          { action: StorageManagedActions.provision, effect: "allowed" },
          { action: StorageManagedActions.activate, effect: "denied", reasonCode: "lifecycle-lock" },
          { action: StorageManagedActions.deactivate, effect: "restricted", reasonCode: "policy-restricted" },
          { action: StorageManagedActions.useForAssets, effect: "allowed" },
        ],
      },
    });

    expect(detail.access.source).toBe("authorization-policy");
    expect(detail.access.isOwner).toBeFalse();
    expect(detail.access.allowedActions).toEqual([
      StorageManagedActions.view,
      StorageManagedActions.provision,
      StorageManagedActions.useForAssets,
    ]);
    expect(detail.access.effectivePermissions.find((item) => item.action === StorageManagedActions.activate)?.effect)
      .toBe("denied");
    expect(detail.access.policyRestrictedCapabilities.find(
      (item) => item.capability === StoragePolicyRestrictedCapabilities.mutableWrites,
    )?.restricted).toBeTrue();
  });
});
