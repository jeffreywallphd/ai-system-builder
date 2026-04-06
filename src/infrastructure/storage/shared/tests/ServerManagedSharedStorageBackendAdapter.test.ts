import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
  ServerManagedSharedStorageBackendAdapter,
  SharedStorageProvisioningReasonCodes,
  type SharedStorageFilesystem,
} from "../ServerManagedSharedStorageBackendAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createNetworkShareStorage(
  storageInstanceId: string,
  overrides?: {
    readonly backendType?: StorageInstance["backendType"];
    readonly labels?: Readonly<Record<string, string>>;
    readonly accessMode?: StorageInstance["access"]["mode"];
    readonly allowCrossWorkspaceReads?: boolean;
    readonly replication?: StorageInstance["replication"];
    readonly maxObjectBytes?: number;
  },
): StorageInstance {
  return createStorageInstance({
    id: storageInstanceId,
    displayName: "Shared workspace storage",
    backendType: overrides?.backendType ?? StorageBackendTypes.networkShare,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: overrides?.accessMode ?? StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    replication: overrides?.replication ?? {
      mode: StorageReplicationModes.none,
    },
    policy: {
      policyId: "policy-storage-shared",
      allowCrossWorkspaceReads: overrides?.allowCrossWorkspaceReads ?? false,
      maxObjectBytes: overrides?.maxObjectBytes,
      labels: overrides?.labels,
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-managed-shared",
  });
}

describe("ServerManagedSharedStorageBackendAdapter", () => {
  it("binds managed network-share storage to a configured server-known target", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-success-"));
    createdRoots.push(root);
    const sharedTargetPath = path.join(root, "studio-share");
    mkdirSync(sharedTargetPath, { recursive: true });

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: sharedTargetPath,
          sharedPathStrategy: "none",
          compatibility: {
            supportsCrossWorkspaceReads: true,
            capabilityTags: ["smb", "low-latency"],
          },
        },
      ],
    });

    const storageInstance = createNetworkShareStorage("storage-shared-alpha", {
      labels: { sharedTargetId: "studio-share" },
    });

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance,
      actorUserIdentityId: "user-owner",
      correlationId: "corr-storage-shared-create",
      occurredAt: "2026-04-06T12:05:00.000Z",
    });

    expect(receipt.accepted).toBeTrue();
    expect(receipt.status).toBe("accepted");
    expect(receipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.bindingValidated);
    expect(receipt.backendRequestId).toContain("studio-share");

    const capability = await adapter.inspectStorageInstanceCapabilities({
      storageInstance,
    });
    expect(capability.supportsManagedLifecycle).toBeTrue();
    expect(capability.supportsCrossWorkspaceReads).toBeTrue();
    expect(capability.notes).toContain("binding-health:healthy");
    expect(capability.notes).toContain("binding-target:studio-share");
    expect(capability.health?.status).toBe("healthy");
    expect(capability.health?.reasonCode).toBe("binding-health-healthy");
  });

  it("returns explicit validation error when shared target binding is unspecified", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-unspecified-"));
    createdRoots.push(root);

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: path.join(root, "share"),
          sharedPathStrategy: "none",
          requiresExistingBindingPath: false,
        },
      ],
    });

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-unspecified"),
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.targetUnspecified);
  });

  it("returns explicit validation error when storage references an unknown shared target id", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-unknown-"));
    createdRoots.push(root);

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: path.join(root, "share"),
          sharedPathStrategy: "none",
          requiresExistingBindingPath: false,
        },
      ],
    });

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-unknown", {
        labels: { sharedTargetId: "other-share" },
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.targetUnknown);
  });

  it("creates missing binding path when target policy allows managed initialization", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-create-"));
    createdRoots.push(root);
    const sharedTargetPath = path.join(root, "managed-share");

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: sharedTargetPath,
          sharedPathStrategy: "none",
          requiresExistingBindingPath: true,
          createBindingPathIfMissing: true,
        },
      ],
    });

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-created", {
        labels: { sharedTargetId: "studio-share" },
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeTrue();
    expect(receipt.status).toBe("accepted");
    expect(receipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.bindingCreated);
  });

  it("rejects provisioning when the configured shared binding path is unreachable", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-missing-"));
    createdRoots.push(root);
    const missingPath = path.join(root, "missing-share");

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: missingPath,
          sharedPathStrategy: "none",
          requiresExistingBindingPath: true,
        },
      ],
    });

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-missing", {
        labels: { sharedTargetId: "studio-share" },
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.bindingMissing);
  });

  it("rejects write-required storage when runtime write permissions are unavailable", async () => {
    const permissionDeniedFs: SharedStorageFilesystem = {
      exists: () => true,
      isDirectory: () => true,
      ensureDirectory: () => undefined,
      canRead: () => true,
      canWrite: () => false,
    };

    const adapter = new ServerManagedSharedStorageBackendAdapter(
      {
        targetLabelKey: "sharedTargetId",
        targets: [
          {
            targetId: "studio-share",
            absolutePath: "C:/tmp/loom-storage-shared-permission",
            sharedPathStrategy: "none",
          },
        ],
      },
      permissionDeniedFs,
    );

    const receipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.activate,
      storageInstance: createNetworkShareStorage("storage-shared-permission", {
        labels: { sharedTargetId: "studio-share" },
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(receipt.accepted).toBeFalse();
    expect(receipt.status).toBe("rejected");
    expect(receipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.bindingPermissionDenied);
  });

  it("rejects incompatible storage policy and replication requirements for a target", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-compat-"));
    createdRoots.push(root);
    const sharedTargetPath = path.join(root, "studio-share");
    mkdirSync(sharedTargetPath, { recursive: true });

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: sharedTargetPath,
          sharedPathStrategy: "none",
          compatibility: {
            supportsCrossWorkspaceReads: false,
            supportsAsyncReplication: false,
            maxObjectBytesLimit: 1024,
          },
        },
      ],
    });

    const incompatiblePolicyReceipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-compat-policy", {
        labels: { sharedTargetId: "studio-share" },
        allowCrossWorkspaceReads: true,
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(incompatiblePolicyReceipt.accepted).toBeFalse();
    expect(incompatiblePolicyReceipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.compatibilityMismatch);

    const incompatibleReplicationReceipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.replicationSync,
      storageInstance: createNetworkShareStorage("storage-shared-compat-repl", {
        labels: { sharedTargetId: "studio-share" },
        replication: {
          mode: StorageReplicationModes.asyncMirror,
          replicaStorageInstanceId: "storage-replica",
          syncIntervalSeconds: 60,
        },
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(incompatibleReplicationReceipt.accepted).toBeFalse();
    expect(incompatibleReplicationReceipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.compatibilityMismatch);

    const incompatibleSizeReceipt = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-compat-size", {
        labels: { sharedTargetId: "studio-share" },
        maxObjectBytes: 4096,
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(incompatibleSizeReceipt.accepted).toBeFalse();
    expect(incompatibleSizeReceipt.reasonCode).toBe(SharedStorageProvisioningReasonCodes.compatibilityMismatch);
  });

  it("reports backend support posture and rejects unsupported backend types", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-shared-unsupported-"));
    createdRoots.push(root);
    const sharedTargetPath = path.join(root, "studio-share");
    mkdirSync(sharedTargetPath, { recursive: true });

    const adapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "studio-share",
          absolutePath: sharedTargetPath,
          sharedPathStrategy: "none",
        },
      ],
    });

    const unsupportedProvisioning = await adapter.requestStorageProvisioning({
      operationKind: StorageProvisioningOperationKinds.create,
      storageInstance: createNetworkShareStorage("storage-shared-unsupported", {
        backendType: StorageBackendTypes.managedFilesystem,
      }),
      actorUserIdentityId: "user-owner",
    });

    expect(unsupportedProvisioning.accepted).toBeFalse();
    expect(unsupportedProvisioning.reasonCode).toBe(SharedStorageProvisioningReasonCodes.backendUnsupported);

    const unsupportedCapabilities = await adapter.inspectStorageBackendCapabilities({
      backendType: StorageBackendTypes.managedFilesystem,
      workspaceId: "workspace-alpha",
    });
    expect(unsupportedCapabilities.supportsManagedLifecycle).toBeFalse();
    expect(unsupportedCapabilities.notes).toContain("backend-support:unsupported:managed-filesystem");
    expect(unsupportedCapabilities.health?.status).toBe("unsupported");

    const supportedCapabilities = await adapter.inspectStorageBackendCapabilities({
      backendType: StorageBackendTypes.networkShare,
      workspaceId: "workspace-alpha",
    });
    expect(supportedCapabilities.supportsManagedLifecycle).toBeTrue();
    expect(supportedCapabilities.notes).toContain("target-count:1");
    expect(supportedCapabilities.notes).toContain("target-label-key:sharedTargetId");
  });
});
