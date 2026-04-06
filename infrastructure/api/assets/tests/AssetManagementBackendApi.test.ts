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
import { AssetGeneratedOutputRegistrationService } from "../../../../src/application/assets/use-cases/AssetGeneratedOutputRegistrationService";
import { AssetPreviewService } from "../../../../src/application/assets/use-cases/AssetPreviewService";
import { AssetLifecycleService } from "../../../../src/application/assets/use-cases/AssetLifecycleService";

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

class StubAssetGeneratedOutputRegistrationService {
  public async registerGeneratedOutput() {
    const asset = createAsset({
      id: "asset-generated-001",
      kind: AssetKinds.generatedOutput,
      ownership: createAssetOwnershipMetadata({
        workspaceId: "workspace-alpha",
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:00:00.000Z",
      }),
      visibility: AssetVisibilities.workspace,
      storageBinding: createStorageInstanceRef({
        storageInstanceId: "storage-alpha",
      }),
      initialVersion: createAssetVersion({
        versionId: "asset-generated-001:v1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: { storageInstanceId: "storage-alpha" },
          objectKey: "workspaces/workspace-alpha/assets/asset-generated-001/output/v1/output.json",
          area: "output",
        }),
        content: createContentDescriptor({
          mimeType: "application/json",
          sizeBytes: 80,
          checksum: {
            algorithm: "sha256",
            digest: "b".repeat(64),
          },
        }),
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:00:00.000Z",
      }),
    });

    return {
      ok: true as const,
      value: {
        asset,
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

class StubAssetPreviewService {
  public deny = false;

  public async resolveAssetPreview() {
    if (this.deny) {
      return {
        ok: false as const,
        error: {
          code: "asset-not-found" as const,
          message: "No preview available.",
        },
      };
    }

    return {
      ok: true as const,
      value: Object.freeze({
        assetId: "asset-upload-001",
        versionId: "asset-upload-001:v1",
        previewAssetId: "preview-asset-upload-001-main",
        previewVersionId: "preview-asset-upload-001-main:v1",
        previewMimeType: "image/webp",
        previewStorageInstanceId: "storage-alpha",
        previewObjectKey: "workspaces/workspace-alpha/assets/preview-asset-upload-001-main/preview/v1/preview.webp",
      }),
    };
  }
}

class StubAssetLifecycleService {
  public async archiveAsset() {
    const asset = new StubAssetUploadInitiationService()["asset"];
    return {
      ok: true as const,
      value: {
        asset,
      },
    };
  }

  public async deleteAsset() {
    const asset = new StubAssetUploadInitiationService()["asset"];
    return {
      ok: true as const,
      value: {
        asset,
      },
    };
  }
}

describe("AssetManagementBackendApi", () => {
  it("returns register and initiate upload DTOs for successful requests", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
      previewService: new StubAssetPreviewService() as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
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

    const generated = await backendApi.registerGeneratedOutput({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-generated-001",
      storageInstanceId: "storage-alpha",
      outputVersion: {
        versionId: "asset-generated-001:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-generated-001/output/v1/output.json",
        area: "output",
        content: {
          mimeType: "application/json",
          sizeBytes: 80,
          checksum: {
            algorithm: "sha256",
            digest: "b".repeat(64),
          },
        },
      },
      source: {
        producerType: "run",
        runId: "execution-run-001",
      },
      lineage: [],
    });
    expect(generated.ok).toBeTrue();
    if (!generated.ok || !generated.data) {
      return;
    }
    expect(generated.data.asset.assetId).toBe("asset-generated-001");
    expect(generated.data.asset.kind).toBe("generated-output");

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

    const preview = await backendApi.resolveAssetPreview({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      preferredMimeTypes: ["image/webp"],
    });
    expect(preview.ok).toBeTrue();
    if (!preview.ok || !preview.data) {
      return;
    }
    expect(preview.data.preview.previewAssetId).toBe("preview-asset-upload-001-main");
    expect(preview.data.preview.previewMimeType).toBe("image/webp");
  });

  it("returns invalid-request for missing actor identity", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
      previewService: new StubAssetPreviewService() as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
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
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: detailService as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
      previewService: new StubAssetPreviewService() as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
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
    expect(response.error.message).toBe("Requested asset resource was not found.");
  });

  it("maps download authorization deny errors to forbidden", async () => {
    const downloadService = new StubAssetDownloadService();
    downloadService.deny = true;
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: downloadService as unknown as AssetDownloadService,
      previewService: new StubAssetPreviewService() as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
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
    expect(response.error.message).toBe("Asset operation is not permitted for the current actor.");
  });

  it("maps preview-not-found failures from service errors", async () => {
    const previewService = new StubAssetPreviewService();
    previewService.deny = true;
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
      previewService: previewService as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
    });

    const response = await backendApi.resolveAssetPreview({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("not-found");
    expect(response.error.message).toBe("Requested asset resource was not found.");
  });

  it("returns archived and deleted asset DTOs for lifecycle mutations", async () => {
    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: new StubAssetDownloadService() as unknown as AssetDownloadService,
      previewService: new StubAssetPreviewService() as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
    });

    const archived = await backendApi.archiveAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
    });
    expect(archived.ok).toBeTrue();
    if (!archived.ok || !archived.data) {
      return;
    }
    expect(archived.data.asset.assetId).toBe("asset-upload-001");

    const deleted = await backendApi.deleteAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
    });
    expect(deleted.ok).toBeTrue();
    if (!deleted.ok || !deleted.data) {
      return;
    }
    expect(deleted.data.asset.assetId).toBe("asset-upload-001");
  });

  it("redacts sensitive error details and normalizes non-validation messages", async () => {
    const downloadService = {
      async authorizeAssetDownload() {
        return {
          ok: false as const,
          error: {
            code: "asset-policy-violation" as const,
            message: "Storage object 'workspaces/workspace-alpha/assets/private.bin' denied.",
            details: Object.freeze({
              objectKey: "workspaces/workspace-alpha/assets/private.bin",
              fileName: "private.bin",
              reasonCode: "policy-denied",
              nested: Object.freeze({
                path: "C:/sensitive/path/file.bin",
              }),
            }),
          },
        };
      },
      async openAuthorizedAssetDownloadStream() {
        return {
          ok: false as const,
          error: {
            code: "asset-access-denied" as const,
            message: "Denied.",
          },
        };
      },
    };

    const backendApi = new AssetManagementBackendApi({
      uploadInitiationService: new StubAssetUploadInitiationService() as unknown as AssetUploadInitiationService,
      generatedOutputRegistrationService: new StubAssetGeneratedOutputRegistrationService() as unknown as AssetGeneratedOutputRegistrationService,
      uploadIngestionService: new StubAssetUploadIngestionService() as unknown as AssetUploadIngestionService,
      discoveryService: new StubAssetDiscoveryService() as unknown as AssetDiscoveryService,
      detailService: new StubAssetDetailService() as unknown as AssetDetailService,
      downloadService: downloadService as unknown as AssetDownloadService,
      previewService: new StubAssetPreviewService() as unknown as AssetPreviewService,
      lifecycleService: new StubAssetLifecycleService() as unknown as AssetLifecycleService,
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
    expect(response.error.code).toBe("invalid-state");
    expect(response.error.message).toBe("Asset operation is not allowed in the current resource state.");
    expect(response.error.details?.objectKey).toBe("[REDACTED]");
    expect(response.error.details?.fileName).toBe("[REDACTED]");
    expect((response.error.details?.nested as Record<string, unknown>)?.path).toBe("[REDACTED]");
    expect(response.error.details?.reasonCode).toBe("policy-denied");
  });
});
