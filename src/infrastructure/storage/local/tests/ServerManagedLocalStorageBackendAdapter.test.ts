import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageReplicationModes,
  createStorageInstance,
  type StorageInstance,
} from "../../../../domain/storage/StorageDomain";
import { StorageProvisioningOperationKinds } from "../../../../application/storage/ports/StorageProvisioningPort";
import {
  LocalStorageProvisioningReasonCodes,
  ServerManagedLocalStorageBackendAdapter,
  type LocalStorageFilesystem,
} from "../ServerManagedLocalStorageBackendAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createManagedFilesystemStorage(
  storageInstanceId: string,
  backendType: StorageInstance["backendType"] = StorageBackendTypes.managedFilesystem,
): StorageInstance {
  return createStorageInstance({
    id: storageInstanceId,
    displayName: "Workspace storage",
    backendType,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    replication: {
      mode: StorageReplicationModes.none,
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
    lastCorrelationId: "corr-storage-managed-local",
  });
}

describe("ServerManagedLocalStorageBackendAdapter", () => {
  it("provisions managed local storage through server-owned directories", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-local-success-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageBackendAdapter({
      managedStorageRootPath: root,
      initialization: {
        managedSubdirectories: ["input", "output", "intermediate", "cache"],
      },
    });

    const storageInstance = createManagedFilesystemStorage("storage-alpha");
    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance,
      actorUserIdentityId: "user-owner",
      correlationId: "corr-storage-local-create",
      occurredAt: "2026-04-06T12:05:00.000Z",
    });

    expect(receipt.accepted).toBeTrue();
    expect(receipt.status).toBe("accepted");
    expect(receipt.reasonCode).toBe(LocalStorageProvisioningReasonCodes.bindingProvisioned);

    const workspaceRoot = path.join(root, "workspaces");
    expect(readdirSync(workspaceRoot).length).toBe(1);

    const capability = await adapter.inspectStorageInstanceCapabilities({
      storageInstance,
    });
    expect(capability.supportsManagedLifecycle).toBeTrue();
    expect(capability.notes).toContain("binding-health:healthy");
    expect(capability.notes).toContain("root-health:healthy");
    expect(capability.health?.status).toBe("healthy");
    expect(capability.health?.reasonCode).toBe("binding-health-healthy");
  });

  it("returns already-applied when managed local storage has already been provisioned", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-local-replay-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageBackendAdapter({
      managedStorageRootPath: root,
    });
    const storageInstance = createManagedFilesystemStorage("storage-replay");

    const first = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance,
      actorUserIdentityId: "user-owner",
      correlationId: "corr-storage-local-replay-1",
    });
    const second = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance,
      actorUserIdentityId: "user-owner",
      correlationId: "corr-storage-local-replay-2",
    });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("already-applied");
    expect(second.accepted).toBeTrue();
    expect(second.reasonCode).toBe(LocalStorageProvisioningReasonCodes.bindingAlreadyProvisioned);
  });

  it("rejects provisioning requests for unsupported backend types", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-local-unsupported-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageBackendAdapter({
      managedStorageRootPath: root,
    });
    const storageInstance = createManagedFilesystemStorage("storage-unsupported", StorageBackendTypes.objectStorage);

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance,
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(LocalStorageProvisioningReasonCodes.backendUnsupported);
  });

  it("returns explicit filesystem failures when server directory initialization fails", async () => {
    const failingFilesystem: LocalStorageFilesystem = {
      exists: () => false,
      isDirectory: () => false,
      ensureDirectory: () => {
        throw new Error("disk unavailable");
      },
    };
    const adapter = new ServerManagedLocalStorageBackendAdapter(
      {
        managedStorageRootPath: "C:/tmp/loom-storage-local-failure",
      },
      failingFilesystem,
    );

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createManagedFilesystemStorage("storage-failure"),
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(LocalStorageProvisioningReasonCodes.filesystemFailure);
    expect(receipt.message).toContain("disk unavailable");
  });

  it("reports instance capability health for missing and present bindings", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-local-health-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageBackendAdapter({
      managedStorageRootPath: root,
      supportsCrossWorkspaceReads: false,
      supportsReadOnlyActive: true,
    });
    const storageInstance = createManagedFilesystemStorage("storage-health");

    const beforeProvisioning = await adapter.inspectStorageInstanceCapabilities({
      storageInstance,
    });
    expect(beforeProvisioning.notes).toContain("binding-health:missing");
    expect(beforeProvisioning.health?.status).toBe("unhealthy");
    expect(beforeProvisioning.health?.reasonCode).toBe("binding-missing");

    await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance,
      actorUserIdentityId: "user-owner",
    });

    const afterProvisioning = await adapter.inspectStorageInstanceCapabilities({
      storageInstance,
    });
    expect(afterProvisioning.notes).toContain("binding-health:healthy");
    expect(afterProvisioning.supportsSyncReplication).toBeFalse();
    expect(afterProvisioning.supportsAsyncReplication).toBeFalse();
    expect(afterProvisioning.health?.status).toBe("healthy");
  });
});
