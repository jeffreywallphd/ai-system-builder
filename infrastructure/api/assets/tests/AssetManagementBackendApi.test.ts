import { describe, expect, it } from "bun:test";
import {
  AssetKinds,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  type Asset,
} from "../../../../src/domain/assets/AssetDomain";
import { AssetManagementBackendApi } from "../AssetManagementBackendApi";
import { AssetUploadInitiationService } from "../../../../src/application/assets/use-cases/AssetUploadInitiationService";
import { AssetUploadIngestionService } from "../../../../src/application/assets/use-cases/AssetUploadIngestionService";

class StubAssetUploadInitiationService {
  private readonly asset: Asset = createAsset({
    id: "asset-upload-001",
    kind: AssetKinds.uploadedFile,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
    visibility: AssetVisibilities.private,
    storageBinding: createStorageInstanceRef({
      storageInstanceId: "storage-alpha",
    }),
    initialVersion: createAssetVersion({
      versionId: "asset-upload-001:v1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/v1/image.png",
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 128,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });

  public async registerAsset() {
    return {
      ok: true as const,
      value: {
        asset: this.asset,
      },
    };
  }

  public async beginAssetUpload() {
    return {
      ok: true as const,
      value: {
        asset: this.asset,
        upload: {
          uploadSessionId: "asset-upload-session:test-001",
          assetId: this.asset.id,
          workspaceId: "workspace-alpha",
          storageInstanceId: "storage-alpha",
          objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/asset-upload-session-test-001/image.png",
          area: "input" as const,
          uploadEndpoint: "/api/v1/assets/upload-sessions/asset-upload-session%3Atest-001/content",
          uploadMethod: "POST" as const,
          expected: {
            fileName: "image.png",
            mimeType: "image/png",
            sizeBytes: 128,
          },
          expiresAt: "2026-04-06T12:15:00.000Z",
        },
      },
    };
  }
}

class StubAssetUploadIngestionService {
  private readonly asset: Asset = createAsset({
    id: "asset-upload-001",
    kind: AssetKinds.uploadedFile,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
    visibility: AssetVisibilities.private,
    storageBinding: createStorageInstanceRef({
      storageInstanceId: "storage-alpha",
    }),
    initialVersion: createAssetVersion({
      versionId: "asset-upload-001:v1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/v1/image.png",
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 128,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });

  public async ingestUploadContent() {
    return {
      ok: true as const,
      value: {
        asset: this.asset,
        uploadSessionId: "asset-upload-session:test-001",
        finalizedVersionId: "asset-upload-001:v2",
        content: {
          mimeType: "application/octet-stream",
          sizeBytes: 5,
          checksum: {
            algorithm: "sha256" as const,
            digest: "a".repeat(64),
          },
          originalFileName: "file.bin",
        },
      },
    };
  }
}

describe("AssetManagementBackendApi", () => {
  it("returns register and initiate upload DTOs for successful requests", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
    });

    const registered = await backendApi.registerAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      kind: "uploaded-file",
      ownerUserId: "user-owner",
      visibility: "private",
      storageInstanceId: "storage-alpha",
      initialVersion: {
        versionId: "asset-upload-001:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/v1/image.png",
        area: "input",
        content: {
          mimeType: "image/png",
          sizeBytes: 128,
          checksum: {
            algorithm: "sha256",
            digest: "a".repeat(64),
          },
        },
      },
    });
    expect(registered.ok).toBeTrue();
    if (!registered.ok || !registered.data) {
      return;
    }
    expect(registered.data.asset.assetId).toBe("asset-upload-001");

    const initiated = await backendApi.initiateAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      storageInstanceId: "storage-alpha",
      fileName: "image.png",
      mimeType: "image/png",
      sizeBytes: 128,
    });
    expect(initiated.ok).toBeTrue();
    if (!initiated.ok || !initiated.data) {
      return;
    }
    expect(initiated.data.upload.uploadEndpoint).toContain("/api/v1/assets/upload-sessions/");
    expect(initiated.data.upload.uploadMethod).toBe("POST");

    const ingested = await backendApi.ingestAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "application/octet-stream",
      content: (async function* payload() {
        yield Buffer.from("hello", "utf8");
      })(),
    });
    expect(ingested.ok).toBeTrue();
    if (!ingested.ok || !ingested.data) {
      return;
    }
    expect(ingested.data.finalizedVersionId).toBe("asset-upload-001:v2");
  });

  it("returns invalid-request for missing actor identity", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
    });

    const response = await backendApi.initiateAssetUpload({
      actorUserIdentityId: " ",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      storageInstanceId: "storage-alpha",
      fileName: "image.png",
      mimeType: "image/png",
      sizeBytes: 128,
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });
});
