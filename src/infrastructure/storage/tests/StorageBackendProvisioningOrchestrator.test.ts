import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  createStorageInstance,
  type StorageBackendType,
} from "@domain/storage/StorageDomain";
import {
  StorageBackendHealthStatuses,
  type IStorageCapabilityInspectionPort,
} from "@application/storage/ports/StorageCapabilityInspectionPort";
import { StorageProvisioningOperationKinds } from "@application/storage/ports/StorageProvisioningPort";
import {
  StorageBackendAdapterRegistry,
  type StorageBackendAdapterRegistration,
} from "../StorageBackendAdapterRegistry";
import {
  StorageBackendProvisioningOrchestrator,
  StorageProvisioningOrchestrationReasonCodes,
} from "../StorageBackendProvisioningOrchestrator";

function buildStorage(backendType: StorageBackendType) {
  return createStorageInstance({
    id: `storage-${backendType.replace(/[^a-z0-9]/g, "-")}`,
    displayName: "Storage adapter orchestration test",
    backendType,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: "policy-storage",
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-backend-orchestrator",
  });
}

describe("StorageBackendProvisioningOrchestrator", () => {
  it("routes provisioning requests through the typed backend registry", async () => {
    const calls: string[] = [];
    const registration: StorageBackendAdapterRegistration = {
      backendType: StorageBackendTypes.managedFilesystem,
      provisioningPort: {
        async requestStorageProvisioning(input) {
          calls.push(input.storageInstance.backendType);
          return {
            status: "accepted",
            accepted: true,
            backendRequestId: "managed:storage-alpha",
            occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
            reasonCode: "managed-ok",
          } as const;
        },
      },
    };

    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([registration]),
    );

    const receipt = await orchestrator.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: buildStorage(StorageBackendTypes.managedFilesystem),
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:05:00.000Z",
    });

    expect(receipt.accepted).toBeTrue();
    expect(receipt.status).toBe("accepted");
    expect(receipt.reasonCode).toBe("managed-ok");
    expect(calls).toEqual([StorageBackendTypes.managedFilesystem]);
  });

  it("returns a stable rejected receipt when no backend adapter is configured", async () => {
    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([]),
    );

    const receipt = await orchestrator.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: buildStorage(StorageBackendTypes.objectStorage),
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:05:00.000Z",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(StorageProvisioningOrchestrationReasonCodes.backendNotConfigured);

    const capabilities = await orchestrator.inspectStorageBackendCapabilities({
      backendType: StorageBackendTypes.objectStorage,
      workspaceId: "workspace-alpha",
      occurredAt: "2026-04-06T12:05:00.000Z",
    });
    expect(capabilities.supportsManagedLifecycle).toBeFalse();
    expect(capabilities.health?.status).toBe("unsupported");
  });

  it("maps backend adapter exceptions to rejected receipts", async () => {
    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([
        {
          backendType: StorageBackendTypes.objectStorage,
          provisioningPort: {
            async requestStorageProvisioning() {
              throw new Error("provider unavailable");
            },
          },
        },
      ]),
    );

    const receipt = await orchestrator.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: buildStorage(StorageBackendTypes.objectStorage),
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:05:00.000Z",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(StorageProvisioningOrchestrationReasonCodes.backendOperationFailed);
    expect(receipt.message).toContain("provider unavailable");
  });

  it("falls back to provisioning adapter capability inspection when an explicit capability port is not registered", async () => {
    const provisioningPortWithCapabilityInspection:
      StorageBackendAdapterRegistration["provisioningPort"]
      & Pick<IStorageCapabilityInspectionPort, "inspectStorageBackendCapabilities"> = {
        async requestStorageProvisioning() {
          return {
            status: "accepted",
            accepted: true,
            occurredAt: "2026-04-06T12:00:00.000Z",
          } as const;
        },
        async inspectStorageBackendCapabilities(input) {
          return {
            backendType: input.backendType,
            supportsManagedLifecycle: true,
            supportsAsyncReplication: true,
            supportsSyncReplication: false,
            supportsReadOnlyActive: true,
            supportsCrossWorkspaceReads: false,
            notes: ["shared-capability-fallback"],
            health: {
              status: StorageBackendHealthStatuses.healthy,
              reasonCode: "shared-capability-healthy",
              checkedAt: "2026-04-06T12:10:00.000Z",
            },
          } as const;
        },
      };

    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([
        {
          backendType: StorageBackendTypes.networkShare,
          provisioningPort: provisioningPortWithCapabilityInspection,
        },
      ]),
    );

    const capabilities = await orchestrator.inspectStorageBackendCapabilities({
      backendType: StorageBackendTypes.networkShare,
      workspaceId: "workspace-alpha",
      occurredAt: "2026-04-06T12:10:00.000Z",
    });

    expect(capabilities.backendType).toBe(StorageBackendTypes.networkShare);
    expect(capabilities.supportsManagedLifecycle).toBeTrue();
    expect(capabilities.notes).toContain("shared-capability-fallback");
    expect(capabilities.health?.status).toBe(StorageBackendHealthStatuses.healthy);
  });

  it("maps backend capability inspection exceptions to deterministic unsupported snapshots", async () => {
    const provisioningPortWithFailingInspection:
      StorageBackendAdapterRegistration["provisioningPort"]
      & Pick<IStorageCapabilityInspectionPort, "inspectStorageBackendCapabilities"> = {
        async requestStorageProvisioning() {
          return {
            status: "accepted",
            accepted: true,
            occurredAt: "2026-04-06T12:00:00.000Z",
          } as const;
        },
        async inspectStorageBackendCapabilities() {
          throw new Error("capability probe timed out");
        },
      };

    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([
        {
          backendType: StorageBackendTypes.objectStorage,
          provisioningPort: provisioningPortWithFailingInspection,
        },
      ]),
    );

    const capabilities = await orchestrator.inspectStorageBackendCapabilities({
      backendType: StorageBackendTypes.objectStorage,
      workspaceId: "workspace-alpha",
      occurredAt: "2026-04-06T12:20:00.000Z",
    });

    expect(capabilities.health?.status).toBe(StorageBackendHealthStatuses.unsupported);
    expect(capabilities.health?.reasonCode).toBe(StorageProvisioningOrchestrationReasonCodes.capabilityInspectionUnavailable);
    expect(capabilities.notes?.[0]).toContain("capability-inspection-failed");
  });

  it("falls back from instance-level inspection to backend-level inspection when instance endpoint is unavailable", async () => {
    const observedRequests: string[] = [];
    const provisioningPortWithBackendInspection:
      StorageBackendAdapterRegistration["provisioningPort"]
      & Pick<IStorageCapabilityInspectionPort, "inspectStorageBackendCapabilities"> = {
        async requestStorageProvisioning() {
          return {
            status: "accepted",
            accepted: true,
            occurredAt: "2026-04-06T12:00:00.000Z",
          } as const;
        },
        async inspectStorageBackendCapabilities(input) {
          observedRequests.push(`${input.backendType}:${input.workspaceId}:${input.requestedReplicationMode ?? "none"}`);
          return {
            backendType: input.backendType,
            supportsManagedLifecycle: true,
            supportsAsyncReplication: true,
            supportsSyncReplication: true,
            supportsReadOnlyActive: true,
            supportsCrossWorkspaceReads: true,
            health: {
              status: StorageBackendHealthStatuses.healthy,
              reasonCode: "backend-capability-ok",
              checkedAt: "2026-04-06T12:30:00.000Z",
            },
          } as const;
        },
      };

    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([
        {
          backendType: StorageBackendTypes.objectStorage,
          provisioningPort: provisioningPortWithBackendInspection,
        },
      ]),
    );

    const capabilities = await orchestrator.inspectStorageInstanceCapabilities({
      storageInstance: buildStorage(StorageBackendTypes.objectStorage),
      occurredAt: "2026-04-06T12:30:00.000Z",
    });

    expect(capabilities.health?.status).toBe(StorageBackendHealthStatuses.healthy);
    expect(observedRequests).toEqual(["object-storage:workspace-alpha:none"]);
  });
});

