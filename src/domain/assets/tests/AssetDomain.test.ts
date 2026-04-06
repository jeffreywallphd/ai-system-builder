import { describe, expect, it } from "bun:test";
import {
  AssetDomainError,
  AssetKinds,
  AssetLifecycleStates,
  AssetLifecycleTransitionError,
  AssetStorageAreas,
  AssetVisibilities,
  addAssetVersion,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  transitionAssetLifecycle,
  updateAssetVisibility,
} from "../AssetDomain";

function createBaseContent() {
  return createContentDescriptor({
    mimeType: "image/png",
    sizeBytes: 1024,
    checksum: {
      algorithm: "sha256",
      digest: "a".repeat(64),
    },
    originalFileName: "preview.png",
  });
}

describe("AssetDomain", () => {
  it("creates user-private assets using logical storage references", () => {
    const storage = createStorageInstanceRef("storage-instance://workspace-primary");
    const ownership = createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    });

    const created = createAsset({
      id: "asset-image-001",
      kind: AssetKinds.uploadedFile,
      ownership,
      visibility: AssetVisibilities.private,
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-alpha/uploads/asset-image-001/v1",
          area: AssetStorageAreas.input,
        }),
        content: createBaseContent(),
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:00:00.000Z",
      }),
    });

    expect(created.ownership.workspaceId).toBe("workspace-alpha");
    expect(created.ownership.ownerUserId).toBe("user-owner");
    expect(created.visibility).toBe(AssetVisibilities.private);
    expect(created.storageBinding.uri).toBe("storage-instance://workspace-primary");
    expect(created.versions).toHaveLength(1);
  });

  it("supports workspace-owned assets with workspace visibility", () => {
    const storage = createStorageInstanceRef({ storageInstanceId: "workspace-shared-store" });
    const ownership = createAssetOwnershipMetadata({
      workspaceId: "workspace-shared",
      createdBy: "user-admin",
      createdAt: "2026-04-06T12:00:00.000Z",
    });

    const created = createAsset({
      id: "asset-output-001",
      kind: AssetKinds.generatedOutput,
      ownership,
      visibility: AssetVisibilities.workspace,
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-shared/outputs/asset-output-001/v1",
          area: AssetStorageAreas.output,
        }),
        content: createContentDescriptor({
          mimeType: "application/json",
          sizeBytes: 220,
          checksum: {
            algorithm: "sha256",
            digest: "b".repeat(64),
          },
        }),
        createdBy: "user-admin",
      }),
    });

    expect(created.ownership.ownerUserId).toBeUndefined();
    expect(created.visibility).toBe(AssetVisibilities.workspace);
    expect(created.sharingPolicyRef).toBeUndefined();
  });

  it("rejects invalid ownership and visibility combinations", () => {
    const storage = createStorageInstanceRef("storage-instance://workspace-private-store");
    const workspaceOwned = createAssetOwnershipMetadata({
      workspaceId: "workspace-private",
      createdBy: "user-admin",
    });

    expect(() => createAsset({
      id: "asset-invalid-private-001",
      kind: AssetKinds.uploadedFile,
      ownership: workspaceOwned,
      visibility: AssetVisibilities.private,
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-private/uploads/asset-invalid-private-001/v1",
          area: AssetStorageAreas.input,
        }),
        content: createBaseContent(),
        createdBy: "user-admin",
      }),
    })).toThrow(AssetDomainError);

    const privateOwned = createAssetOwnershipMetadata({
      workspaceId: "workspace-private",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
    });

    expect(() => createAsset({
      id: "asset-invalid-shared-001",
      kind: AssetKinds.preview,
      ownership: privateOwned,
      visibility: AssetVisibilities.shared,
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-private/previews/asset-invalid-shared-001/v1",
          area: AssetStorageAreas.preview,
        }),
        content: createBaseContent(),
        createdBy: "user-owner",
      }),
    })).toThrow(AssetDomainError);
  });

  it("rejects raw filesystem-like location references", () => {
    const storage = createStorageInstanceRef("storage-instance://workspace-primary");

    expect(() => createAssetLocationRef({
      storageInstance: storage,
      objectKey: "C:/Users/owner/Desktop/file.png",
      area: AssetStorageAreas.input,
    })).toThrow(AssetDomainError);

    expect(() => createAssetLocationRef({
      storageInstance: storage,
      objectKey: "workspace/../secret",
      area: AssetStorageAreas.input,
    })).toThrow(AssetDomainError);
  });

  it("enforces version sequencing and storage binding coherence", () => {
    const storage = createStorageInstanceRef("storage-instance://workspace-primary");
    const ownership = createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    });

    const created = createAsset({
      id: "asset-seq-001",
      kind: AssetKinds.generatedOutput,
      ownership,
      visibility: AssetVisibilities.private,
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-alpha/outputs/asset-seq-001/v1",
          area: AssetStorageAreas.output,
        }),
        content: createBaseContent(),
        createdBy: "user-owner",
      }),
    });

    const withSecondVersion = addAssetVersion(created, {
      versionId: "asset-version:2",
      location: createAssetLocationRef({
        storageInstance: storage,
        objectKey: "workspace-alpha/outputs/asset-seq-001/v2",
        area: AssetStorageAreas.output,
      }),
      content: createBaseContent(),
      actorUserId: "user-owner",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });

    expect(withSecondVersion.currentVersionId).toBe("asset-version:2");
    expect(withSecondVersion.versions).toHaveLength(2);

    expect(() => addAssetVersion(withSecondVersion, {
      versionId: "asset-version:3",
      location: createAssetLocationRef({
        storageInstance: "storage-instance://another-store",
        objectKey: "workspace-alpha/outputs/asset-seq-001/v3",
        area: AssetStorageAreas.output,
      }),
      content: createBaseContent(),
      actorUserId: "user-owner",
    })).toThrow(AssetDomainError);
  });

  it("enforces lifecycle transition rules and modification constraints", () => {
    const storage = createStorageInstanceRef("storage-instance://workspace-primary");
    const ownership = createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    });

    const created = createAsset({
      id: "asset-lifecycle-001",
      kind: AssetKinds.preview,
      ownership,
      visibility: AssetVisibilities.private,
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-alpha/previews/asset-lifecycle-001/v1",
          area: AssetStorageAreas.preview,
        }),
        content: createBaseContent(),
        createdBy: "user-owner",
      }),
    });

    const archived = transitionAssetLifecycle(created, AssetLifecycleStates.archived, {
      actorUserId: "user-owner",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });

    expect(archived.lifecycle.state).toBe(AssetLifecycleStates.archived);
    expect(archived.lifecycle.archivedBy).toBe("user-owner");

    const deleted = transitionAssetLifecycle(archived, AssetLifecycleStates.deleted, {
      actorUserId: "user-admin",
      occurredAt: "2026-04-06T14:00:00.000Z",
    });

    expect(deleted.lifecycle.state).toBe(AssetLifecycleStates.deleted);
    expect(deleted.lifecycle.deletedBy).toBe("user-admin");

    expect(() => updateAssetVisibility(deleted, {
      visibility: AssetVisibilities.workspace,
      actorUserId: "user-admin",
      occurredAt: "2026-04-06T14:01:00.000Z",
    })).toThrow(AssetDomainError);

    expect(() => transitionAssetLifecycle(deleted, AssetLifecycleStates.active, {
      actorUserId: "user-admin",
      occurredAt: "2026-04-06T15:00:00.000Z",
    })).toThrow(AssetLifecycleTransitionError);
  });
});
