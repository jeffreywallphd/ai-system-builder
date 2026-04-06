import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { AssetManagementBackendApi } from "../../../../api/assets/AssetManagementBackendApi";
import { AssetUploadInitiationService } from "../../../../../src/application/assets/use-cases/AssetUploadInitiationService";
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
} from "../../../../../src/domain/assets/AssetDomain";

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

  public denyUploads = false;

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
}

async function startServer(service: StubAssetUploadInitiationService): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const assetManagementBackendApi = new AssetManagementBackendApi({
    uploadInitiationService: service as unknown as AssetUploadInitiationService,
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
});
