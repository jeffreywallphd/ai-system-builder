import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  createStorageInstance,
  type StorageBackendType,
} from "../../../domain/storage/StorageDomain";
import { StorageProvisioningOperationKinds } from "../../../application/storage/ports/StorageProvisioningPort";
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
});
