import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { AssetManagementBackendApi } from "../../../../api/assets/AssetManagementBackendApi";
import { AssetUploadInitiationService } from "@application/assets/use-cases/AssetUploadInitiationService";
import { AssetUploadIngestionService } from "@application/assets/use-cases/AssetUploadIngestionService";
import { AssetDiscoveryService } from "@application/assets/use-cases/AssetDiscoveryService";
import { AssetDetailService } from "@application/assets/use-cases/AssetDetailService";
import { AssetDownloadService } from "@application/assets/use-cases/AssetDownloadService";
import { AssetGeneratedOutputRegistrationService } from "@application/assets/use-cases/AssetGeneratedOutputRegistrationService";
import { AssetPreviewService } from "@application/assets/use-cases/AssetPreviewService";
import { AssetLifecycleService } from "@application/assets/use-cases/AssetLifecycleService";
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
} from "@domain/assets/AssetDomain";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
});

class StubAssetUploadInitiationService {
  public readonly asset: Asset = createAsset({
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

  public denyUploads = false;
  public hideDetails = false;

  public async registerAsset() {
    return {
      ok: true as const,
      value: {
        asset: this.asset,
      },
    };
  }

  public async beginAssetUpload() {
    if (this.denyUploads) {
      return {
        ok: false as const,
        error: {
          code: "asset-access-denied" as const,
          message: "Forbidden upload.",
        },
      };
    }
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

  public async listAssets() {
    return {
      ok: true as const,
      value: {
        items: Object.freeze([this.asset]),
        pagination: Object.freeze({
          limit: 25,
          offset: 0,
          returned: 1,
          hasMore: false,
        }),
      },
    };
  }

  public async getAssetById() {
    if (this.hideDetails) {
      return {
        ok: false as const,
        error: {
          code: "asset-not-found" as const,
          message: "Asset was not found for the workspace.",
        },
      };
    }
    return {
      ok: true as const,
      value: {
        asset: this.asset,
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

class StubAssetUploadIngestionService {
  public reject = false;

  public async ingestUploadContent() {
    if (this.reject) {
      return {
        ok: false as const,
        error: {
          code: "asset-invalid-state" as const,
          message: "Upload rejected.",
        },
      };
    }
    return {
      ok: true as const,
      value: {
        asset: new StubAssetUploadInitiationService()["asset"],
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
          sizeBytes: 128,
          checksum: {
            algorithm: "sha256",
            digest: "d".repeat(64),
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

class StubAssetDownloadService {
  public denyAuthorization = false;
  public failStreamOpen = false;

  public async authorizeAssetDownload() {
    if (this.denyAuthorization) {
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
        sizeBytes: 5,
        contentToken: "download-token-001",
        expiresAt: "2026-04-06T12:30:00.000Z",
        contentDispositionFileName: "image.png",
      }),
    };
  }

  public async openAuthorizedAssetDownloadStream(input: { readonly contentToken: string }) {
    if (input.contentToken !== "download-token-001") {
      return {
        ok: false as const,
        error: {
          code: "asset-access-denied" as const,
          message: "Invalid token.",
        },
      };
    }
    if (this.failStreamOpen) {
      return {
        ok: true as const,
        value: Object.freeze({
          assetId: "asset-upload-001",
          versionId: "asset-upload-001:v1",
          mimeType: "image/png",
          sizeBytes: 5,
          contentDisposition: "attachment" as const,
          contentDispositionFileName: "image.png",
          stream: (async function* payload() {
            throw new Error("stream failed for objectKey workspaces/workspace-alpha/assets/private.bin");
            yield Buffer.from([]);
          })(),
        }),
      };
    }

    return {
      ok: true as const,
      value: Object.freeze({
        assetId: "asset-upload-001",
        versionId: "asset-upload-001:v1",
        mimeType: "image/png",
        sizeBytes: 5,
        contentDisposition: "attachment" as const,
        contentDispositionFileName: "image.png",
        stream: (async function* payload() {
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
          message: "No preview found.",
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
    return {
      ok: true as const,
      value: {
        asset: new StubAssetUploadInitiationService()["asset"],
      },
    };
  }

  public async deleteAsset() {
    return {
      ok: true as const,
      value: {
        asset: new StubAssetUploadInitiationService()["asset"],
      },
    };
  }
}

async function startServer(
  initiationService: StubAssetUploadInitiationService,
  ingestionService = new StubAssetUploadIngestionService(),
  downloadService = new StubAssetDownloadService(),
  generatedOutputService = new StubAssetGeneratedOutputRegistrationService(),
  previewService = new StubAssetPreviewService(),
  lifecycleService = new StubAssetLifecycleService(),
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const assetManagementBackendApi = new AssetManagementBackendApi({
    uploadInitiationService: initiationService as unknown as AssetUploadInitiationService,
    generatedOutputRegistrationService: generatedOutputService as unknown as AssetGeneratedOutputRegistrationService,
    uploadIngestionService: ingestionService as unknown as AssetUploadIngestionService,
    discoveryService: initiationService as unknown as AssetDiscoveryService,
    detailService: initiationService as unknown as AssetDetailService,
    downloadService: downloadService as unknown as AssetDownloadService,
    previewService: previewService as unknown as AssetPreviewService,
    lifecycleService: lifecycleService as unknown as AssetLifecycleService,
  });

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    assetManagementBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function registerAndLogin(baseUrl: string, username: string): Promise<string> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();
  return loginBody.data.sessionToken as string;
}

describe("IdentityHttpServer asset management routes", () => {
  it("enforces shared auth and workspace guard semantics for converged asset routes", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.guard.1");

    const unauthenticatedResponse = await fetch(`${baseUrl}/api/v1/assets`);
    expect(unauthenticatedResponse.status).toBe(401);
    const unauthenticatedBody = await unauthenticatedResponse.json();
    expect(unauthenticatedBody.ok).toBe(false);
    expect(unauthenticatedBody.error.code).toBe("authentication-failed");

    const missingWorkspaceResponse = await fetch(`${baseUrl}/api/v1/assets`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(missingWorkspaceResponse.status).toBe(400);
    const missingWorkspaceBody = await missingWorkspaceResponse.json();
    expect(missingWorkspaceBody.ok).toBe(false);
    expect(missingWorkspaceBody.error.code).toBe("invalid-request");
  });

  it("serves authenticated register and upload initiation flows", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner");

    const registerResponse = await fetch(`${baseUrl}/api/v1/assets/register?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
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
      }),
    });
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    expect(registerBody.ok).toBe(true);
    expect(registerBody.data.asset.assetId).toBe("asset-upload-001");

    const initiateResponse = await fetch(`${baseUrl}/api/v1/assets/asset-upload-001/uploads/initiate?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storageInstanceId: "storage-alpha",
        fileName: "image.png",
        mimeType: "image/png",
        sizeBytes: 128,
      }),
    });
    expect(initiateResponse.status).toBe(200);
    const initiateBody = await initiateResponse.json();
    expect(initiateBody.ok).toBe(true);
    expect(initiateBody.data.upload.uploadMethod).toBe("POST");
    expect(initiateBody.data.upload.uploadEndpoint).toContain("/api/v1/assets/upload-sessions/");

    const ingestResponse = await fetch(`${baseUrl}/api/v1/assets/upload-sessions/asset-upload-session%3Atest-001/content?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
      },
      body: Buffer.from("hello", "utf8"),
    });
    expect(ingestResponse.status).toBe(200);
    const ingestBody = await ingestResponse.json();
    expect(ingestBody.ok).toBe(true);
    expect(ingestBody.data.finalizedVersionId).toBe("asset-upload-001:v2");
  });

  it("registers generated outputs through authenticated asset routes", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.generated");

    const response = await fetch(`${baseUrl}/api/v1/assets/generated-outputs/register?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assetId: "asset-generated-001",
        storageInstanceId: "storage-alpha",
        outputVersion: {
          versionId: "asset-generated-001:v1",
          storageInstanceId: "storage-alpha",
          objectKey: "workspaces/workspace-alpha/assets/asset-generated-001/output/v1/output.json",
          area: "output",
          content: {
            mimeType: "application/json",
            sizeBytes: 128,
            checksum: {
              algorithm: "sha256",
              digest: "d".repeat(64),
            },
          },
        },
        source: {
          producerType: "run",
          runId: "execution-run-001",
        },
        lineage: [
          {
            sourceAssetId: "asset-upload-001",
            relation: "generated-from",
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.asset.assetId).toBe("asset-generated-001");
    expect(body.data.asset.kind).toBe("generated-output");
  });

  it("maps authorization failures to forbidden responses", async () => {
    const service = new StubAssetUploadInitiationService();
    service.denyUploads = true;

    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.2");

    const response = await fetch(`${baseUrl}/api/v1/assets/asset-upload-001/uploads/initiate?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storageInstanceId: "storage-alpha",
        fileName: "image.png",
        mimeType: "image/png",
        sizeBytes: 128,
      }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("maps ingestion failures to invalid-state responses", async () => {
    const service = new StubAssetUploadInitiationService();
    const ingestion = new StubAssetUploadIngestionService();
    ingestion.reject = true;

    const baseUrl = await startServer(service, ingestion);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.3");

    const response = await fetch(`${baseUrl}/api/v1/assets/upload-sessions/asset-upload-session%3Atest-001/content?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
      },
      body: Buffer.from("hello", "utf8"),
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid-state");
  });

  it("supports authenticated scoped asset listing", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.4");

    const response = await fetch(
      `${baseUrl}/api/v1/assets?workspaceId=workspace-alpha&scope=all&limit=10&offset=0`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]?.assetId).toBe("asset-upload-001");
    expect(body.data.pagination.returned).toBe(1);
  });

  it("accepts canonical repeated filter parameter names for asset list retrieval", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.4b");

    const response = await fetch(
      `${baseUrl}/api/v1/assets?workspaceId=workspace-alpha&assetKind=uploaded-file&visibility=private&lifecycleState=active&limit=10&offset=0`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it("supports authenticated asset detail retrieval", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.5");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001?workspaceId=workspace-alpha`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.asset.assetId).toBe("asset-upload-001");
    expect(body.data.asset.uploadState).toBe("ready");
    expect(body.data.asset.links.self).toContain("/api/v1/assets/asset-upload-001");
  });

  it("returns safe not-found behavior for unauthorized detail retrieval", async () => {
    const service = new StubAssetUploadInitiationService();
    service.hideDetails = true;
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.6");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001?workspaceId=workspace-alpha`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not-found");
  });

  it("authorizes and streams asset downloads through protected endpoints", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.7");

    const authorizeResponse = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/downloads/authorize?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purpose: "download",
        }),
      },
    );
    expect(authorizeResponse.status).toBe(200);
    const authorizeBody = await authorizeResponse.json();
    expect(authorizeBody.ok).toBe(true);
    expect(authorizeBody.data.authorization.contentToken).toBe("download-token-001");
    expect(authorizeBody.data.authorization.objectKey).toBeUndefined();

    const downloadResponse = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/downloads/content?workspaceId=workspace-alpha&contentToken=download-token-001`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-type")).toBe("image/png");
    expect(downloadResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(downloadResponse.headers.get("cache-control")).toBe("private, no-store");
    const payload = await downloadResponse.text();
    expect(payload).toBe("hello");
  });

  it("blocks unauthorized tokenized download streams", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.8");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/downloads/content?workspaceId=workspace-alpha&contentToken=invalid-token`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("fails download stream opens with internal non-leaky responses", async () => {
    const service = new StubAssetUploadInitiationService();
    const downloadService = new StubAssetDownloadService();
    downloadService.failStreamOpen = true;
    const baseUrl = await startServer(service, new StubAssetUploadIngestionService(), downloadService);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.8b");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/downloads/content?workspaceId=workspace-alpha&contentToken=download-token-001`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("internal");
    expect(body.error.message).toBe("Download content stream could not be completed.");
  });

  it("blocks download authorization when policy denies access", async () => {
    const service = new StubAssetUploadInitiationService();
    const downloadService = new StubAssetDownloadService();
    downloadService.denyAuthorization = true;
    const baseUrl = await startServer(service, new StubAssetUploadIngestionService(), downloadService);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.9");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/downloads/authorize?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purpose: "download",
        }),
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("resolves protected preview metadata without exposing public URLs", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.10");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/preview?workspaceId=workspace-alpha&preferredMimeType=image/webp`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.preview.previewAssetId).toBe("preview-asset-upload-001-main");
    expect(body.data.preview.previewMimeType).toBe("image/webp");
  });

  it("maps missing preview resolution to not-found", async () => {
    const service = new StubAssetUploadInitiationService();
    const previewService = new StubAssetPreviewService();
    previewService.deny = true;
    const baseUrl = await startServer(
      service,
      new StubAssetUploadIngestionService(),
      new StubAssetDownloadService(),
      new StubAssetGeneratedOutputRegistrationService(),
      previewService,
    );
    const token = await registerAndLogin(baseUrl, "asset.http.owner.11");

    const response = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/preview?workspaceId=workspace-alpha`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not-found");
  });

  it("archives and deletes assets through authenticated lifecycle routes", async () => {
    const service = new StubAssetUploadInitiationService();
    const baseUrl = await startServer(service);
    const token = await registerAndLogin(baseUrl, "asset.http.owner.12");

    const archiveResponse = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/archive?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(archiveResponse.status).toBe(200);
    const archiveBody = await archiveResponse.json();
    expect(archiveBody.ok).toBe(true);
    expect(archiveBody.data.asset.assetId).toBe("asset-upload-001");

    const deleteResponse = await fetch(
      `${baseUrl}/api/v1/assets/asset-upload-001/delete?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.ok).toBe(true);
    expect(deleteBody.data.asset.assetId).toBe("asset-upload-001");
  });
});

