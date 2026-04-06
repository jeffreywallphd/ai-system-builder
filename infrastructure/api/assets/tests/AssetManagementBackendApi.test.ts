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
import { AssetDiscoveryService } from "../../../../src/application/assets/use-cases/AssetDiscoveryService";
import { AssetDetailService } from "../../../../src/application/assets/use-cases/AssetDetailService";
import { AssetDownloadService } from "../../../../src/application/assets/use-cases/AssetDownloadService";

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

class StubAssetDiscoveryService {
  public async listAssets() {
    const asset = new StubAssetUploadInitiationService()["asset"];
    return {
      ok: true as const,
      value: {
        items: Object.freeze([asset]),
        pagination: Object.freeze({
          limit: 25,
          offset: 0,
          returned: 1,
          hasMore: false,
        }),
      },
    };
  }
}

class StubAssetDetailService {
  public deny = false;

  public async getAssetById() {
    if (this.deny) {
      return {
        ok: false as const,
        error: {
          code: "asset-not-found" as const,
          message: "Asset not found.",
        },
      };
    }

    const asset = new StubAssetUploadInitiationService()["asset"];
    return {
      ok: true as const,
      value: {
        asset,
        metadata: Object.freeze({
          isOwnedByActor: true,
          uploadState: "ready" as const,
          previewAvailable: true,
          previewMimeTypeHint: "image/png",
          allowedActions: Object.freeze({
            canInitiateUpload: true,
            canAuthorizeDownload: true,
            canResolvePreview: true,
            canArchive: true,
            canDelete: true,
          }),
          links: Object.freeze({
            self: "/api/v1/assets/asset-upload-001?workspaceId=workspace-alpha",
            list: "/api/v1/assets?workspaceId=workspace-alpha",
            initiateUpload: "/api/v1/assets/asset-upload-001/uploads/initiate?workspaceId=workspace-alpha",
            authorizeDownload: "/api/v1/assets/asset-upload-001/downloads/authorize?workspaceId=workspace-alpha",
            resolvePreview: "/api/v1/assets/asset-upload-001/preview?workspaceId=workspace-alpha",
            listGeneratedOutputsBySource: "/api/v1/assets?workspaceId=workspace-alpha&sourceAssetId=asset-upload-001",
          }),
          lineage: Object.freeze({
            sources: Object.freeze([]),
          }),
        }),
      },
    };
  }
}

class StubAssetDownloadService {
  public deny = false;

  public async authorizeAssetDownload() {
    if (this.deny) {
      return {
        ok: false as const,
        error: {
          code: "asset-access-denied" as const,
          message: "Download denied.",
        },
      };
    }
    return {
      ok: true as const,
      value: Object.freeze({
        assetId: "asset-upload-001",
        versionId: "asset-upload-001:v1",
        workspaceId: "workspace-alpha",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/v1/image.png",
        mimeType: "image/png",
        sizeBytes: 128,
        contentToken: "content-token-001",
        expiresAt: "2026-04-06T12:15:00.000Z",
        contentDispositionFileName: "image.png",
      }),
    };
  }

  public async openAuthorizedAssetDownloadStream() {
    return {
      ok: true as const,
      value: Object.freeze({
        assetId: "asset-upload-001",
        versionId: "asset-upload-001:v1",
        mimeType: "image/png",
        sizeBytes: 5,
        contentDisposition: "attachment" as const,
        contentDispositionFileName: "image.png",
        stream: (async function* chunks() {
          yield Buffer.from("hello", "utf8");
        })(),
      }),
    };
  }
}

describe("AssetManagementBackendApi", () => {
  it("returns register and initiate upload DTOs for successful requests", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
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

    const listed = await backendApi.listAssets({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      scope: "all",
      limit: 25,
      offset: 0,
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok || !listed.data) {
      return;
    }
    expect(listed.data.items[0]?.assetId).toBe("asset-upload-001");
    expect(listed.data.pagination.returned).toBe(1);

    const detail = await backendApi.getAssetDetail({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok || !detail.data) {
      return;
    }
    expect(detail.data.asset.assetId).toBe("asset-upload-001");
    expect(detail.data.asset.uploadState).toBe("ready");
    expect(detail.data.asset.allowedActions?.canInitiateUpload).toBeTrue();

    const downloadAuthorization = await backendApi.authorizeAssetDownload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      purpose: "download",
    });
    expect(downloadAuthorization.ok).toBeTrue();
    if (!downloadAuthorization.ok || !downloadAuthorization.data) {
      return;
    }
    expect(downloadAuthorization.data.authorization.contentToken).toBe("content-token-001");
    expect((downloadAuthorization.data.authorization as Record<string, unknown>).objectKey).toBeUndefined();

    const opened = await backendApi.openAuthorizedAssetDownloadStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      contentToken: "content-token-001",
    });
    expect(opened.ok).toBeTrue();
    if (!opened.ok || !opened.data) {
      return;
    }
    expect(opened.data.mimeType).toBe("image/png");
  });

  it("returns invalid-request for missing actor identity", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
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

    const listResponse = await backendApi.listAssets({
      actorUserIdentityId: " ",
      workspaceId: "workspace-alpha",
    });
    expect(listResponse.ok).toBeFalse();
    if (listResponse.ok || !listResponse.error) {
      return;
    }
    expect(listResponse.error.code).toBe("invalid-request");
  });

  it("maps detail not-found failures from service errors", async () => {
    const detailService = new StubAssetDetailService();
    detailService.deny = true;

    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: detailService as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
    });

    const response = await backendApi.getAssetDetail({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("not-found");
  });

  it("maps download authorization deny errors to forbidden", async () => {
    const downloadService = new StubAssetDownloadService();
    downloadService.deny = true;
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: downloadService as unknown as AssetDownloadService,
    });

    const response = await backendApi.authorizeAssetDownload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      purpose: "download",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("forbidden");
  });
});
