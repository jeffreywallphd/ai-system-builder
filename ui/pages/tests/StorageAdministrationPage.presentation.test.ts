import { describe, expect, it } from "bun:test";
import type { GetStorageInstanceHealthApiResponse } from "../../../src/infrastructure/api/storage/sdk/PublicStorageManagementApiContract";
import { StorageLifecycleStates, StorageReplicationModes } from "../../../src/domain/storage/StorageDomain";
import { StorageSyncDeploymentAvailabilities, StorageSyncStatuses } from "../../../src/shared/contracts/storage/StorageTransportContracts";
import { StorageAdministrationPagePresentation } from "../StorageAdministrationPage";

describe("StorageAdministrationPage presentation", () => {
  it("renders healthy and sync-capable status summaries", () => {
    const health = createHealthResponse();

    expect(StorageAdministrationPagePresentation.deriveReadinessState(health)).toBe("healthy");
    expect(StorageAdministrationPagePresentation.summarizeHealthForList(health)).toBe("Healthy");
    expect(StorageAdministrationPagePresentation.summarizeUsabilityForList(health)).toBe("Ready");
    expect(StorageAdministrationPagePresentation.summarizeSyncForList(health)).toBe("Sync healthy");
    expect(StorageAdministrationPagePresentation.describeUsability(health)).toBe("Ready for managed workloads.");
    expect(StorageAdministrationPagePresentation.presentReadinessLabel("healthy")).toBe("Ready");
  });

  it("renders degraded state when synchronization is degraded", () => {
    const health = createHealthResponse({
      synchronizationStatus: StorageSyncStatuses.degraded,
    });

    expect(StorageAdministrationPagePresentation.deriveReadinessState(health)).toBe("degraded");
    expect(StorageAdministrationPagePresentation.summarizeHealthForList(health)).toBe("Degraded");
    expect(StorageAdministrationPagePresentation.summarizeUsabilityForList(health)).toBe("Limited");
    expect(StorageAdministrationPagePresentation.summarizeSyncForList(health)).toBe("Sync degraded");
  });

  it("renders inactive and unsupported states as not usable", () => {
    const inactive = createHealthResponse({
      operationalStatus: "inactive",
      lifecycleState: StorageLifecycleStates.suspended,
    });
    const unsupported = createHealthResponse({
      operationalStatus: "unsupported",
      reasonCode: "sync-capability-mismatch",
    });

    expect(StorageAdministrationPagePresentation.deriveReadinessState(inactive)).toBe("inactive");
    expect(StorageAdministrationPagePresentation.summarizeUsabilityForList(inactive)).toBe("Not usable");
    expect(StorageAdministrationPagePresentation.describeUsability(inactive)).toBe(
      "Not usable because the instance is inactive.",
    );

    expect(StorageAdministrationPagePresentation.deriveReadinessState(unsupported)).toBe("unhealthy");
    expect(StorageAdministrationPagePresentation.summarizeHealthForList(unsupported)).toBe("Unsupported");
    expect(StorageAdministrationPagePresentation.summarizeUsabilityForList(unsupported)).toBe("Blocked");
    expect(StorageAdministrationPagePresentation.describeUsability(unsupported)).toBe(
      "Not usable because this backend capability profile does not meet current storage requirements.",
    );
  });

  it("distinguishes non-sync-capable backends", () => {
    const health = createHealthResponse({
      synchronization: {
        syncCapable: false,
        supportsReplicationSyncOperation: false,
        deploymentAvailability: StorageSyncDeploymentAvailabilities.unavailable,
        reasonCode: "backend-sync-not-supported",
      },
      synchronizationStatus: StorageSyncStatuses.disabled,
    });

    expect(StorageAdministrationPagePresentation.summarizeSyncForList(health)).toBe("No sync support");
  });
});

function createHealthResponse(
  overrides: Partial<GetStorageInstanceHealthApiResponse> = {},
): GetStorageInstanceHealthApiResponse {
  return {
    storage: {
      storageInstanceId: "storage-images-1",
      workspaceId: "workspace-1",
      backendType: "object-storage",
      display: {
        displayName: "Storage Images",
      },
      lifecycle: {
        state: StorageLifecycleStates.active,
        createdAt: "2026-04-06T09:00:00.000Z",
        lastModifiedAt: "2026-04-06T09:30:00.000Z",
      },
      ownerUserIdentityId: "user-admin-1",
      access: {
        workspaceId: "workspace-1",
        ownerUserIdentityId: "user-admin-1",
        mode: "read-write",
        scope: "workspace-members",
        isOwner: true,
        source: "ownership-default",
        effectivePermissions: [],
        allowedActions: [],
        policyRestrictedCapabilities: [],
      },
      policy: {
        policyId: "policy-storage-1",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "none",
        encryptionProfileId: "enc-profile-1",
        envelopeRequired: true,
        hasEncryptionKeyReference: false,
      },
      replication: {
        mode: StorageReplicationModes.asyncMirror,
        replicaStorageInstanceId: "storage-images-replica-1",
        syncIntervalSeconds: 60,
        lastSyncStatus: StorageSyncStatuses.healthy,
      },
    },
    synchronization: {
      syncCapable: true,
      supportsReplicationSyncOperation: true,
      deploymentAvailability: StorageSyncDeploymentAvailabilities.active,
      evaluatedAt: "2026-04-06T09:55:00.000Z",
    },
    synchronizationStatus: StorageSyncStatuses.healthy,
    lifecycleState: StorageLifecycleStates.active,
    operationalStatus: "healthy",
    lastCheckedAt: "2026-04-06T10:00:00.000Z",
    reasonCode: "ok",
    operationalNotes: [],
    ...overrides,
  };
}
