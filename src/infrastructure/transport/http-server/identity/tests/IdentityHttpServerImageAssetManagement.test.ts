import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { ImageAssetManagementBackendApi } from "../../../../api/image-assets/ImageAssetManagementBackendApi";
import { ImageAssetStatuses } from "@domain/image-assets/ImageAssetDomain";
import { ResourceVisibilities, SharingPolicyModes } from "@domain/authorization/AuthorizationDomain";
import { ImageAssetStorageObjectAreas } from "@application/image-assets/ports/ImageAssetStoragePort";

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

class ImageAssetStateStore {
  public state = Object.freeze({
    assetId: "image-asset:001",
    workspaceId: "workspace-alpha",
    ownerUserId: "user-owner",
    originKind: "uploaded-source" as const,
    mediaType: "image/png" as const,
    originalFilename: "image.png",
    normalizedFilename: "image.png",
    sizeBytes: 5,
    fingerprint: Object.freeze({
      algorithm: "sha256" as const,
      digest: "a".repeat(64),
    }),
    visibility: ResourceVisibilities.private,
    sharingPolicy: Object.freeze({
      mode: SharingPolicyModes.ownerOnly,
    }),
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
    lifecycle: Object.freeze({
      status: ImageAssetStatuses.ingesting,
    }),
    createdBy: "user-owner",
    lastModifiedBy: "user-owner",
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
  });
}

async function startServer(): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const store = new ImageAssetStateStore();

  const imageAssetManagementBackendApi = new ImageAssetManagementBackendApi({
    uploadSessionTokenSecret: "image-asset-http-server-test-secret",
    initiateImageAssetCreationUseCase: {
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            imageAsset: store.state,
            upload: Object.freeze({
              status: "upload-pending" as const,
              reservation: Object.freeze({
                reservationId: "reservation-001",
                reference: Object.freeze({
                  storageInstanceId: "storage-alpha",
                  objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                  area: ImageAssetStorageObjectAreas.original,
                }),
                expiresAt: "2026-04-08T12:20:00.000Z",
              }),
            }),
          }),
        };
      },
    },
    finalizeImageAssetUploadUseCase: {
      async execute() {
        store.state = Object.freeze({
          ...store.state,
          lifecycle: Object.freeze({
            status: ImageAssetStatuses.available,
            ingestedAt: "2026-04-08T12:05:00.000Z",
          }),
          updatedAt: "2026-04-08T12:05:00.000Z",
        });
        return {
          ok: true as const,
          value: Object.freeze({
            imageAsset: store.state,
            upload: Object.freeze({
              status: "finalized" as const,
              reference: Object.freeze({
                storageInstanceId: "storage-alpha",
                objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                area: ImageAssetStorageObjectAreas.original,
              }),
              finalizedAt: "2026-04-08T12:05:00.000Z",
              observedSizeBytes: 5,
              observedChecksumSha256: "b".repeat(64),
            }),
          }),
        };
      },
    },
    getImageAssetMetadataUseCase: {
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            asset: store.state,
          }),
        };
      },
    },
    listImageAssetMetadataUseCase: {
      async execute(request) {
        expect(request.ownerUserIds).toContain("user-owner");
        return {
          ok: true as const,
          value: Object.freeze({
            items: Object.freeze([store.state]),
            pagination: Object.freeze({
              limit: 25,
              offset: 0,
              returned: 1,
              hasMore: false,
            }),
          }),
        };
      },
    },
    getImageAssetOriginalContentUseCase: {
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            assetId: "image-asset:001",
            workspaceId: "workspace-alpha",
            mediaType: "image/png" as const,
            sizeBytes: 5,
            contentDisposition: "attachment" as const,
            contentDispositionFileName: "image.png",
            stream: (async function* stream() {
              yield Buffer.from("hello", "utf8");
            })(),
          }),
        };
      },
    },
    requestImageAssetPreviewContentUseCase: {
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            assetId: "image-asset:001",
            workspaceId: "workspace-alpha",
            representation: "gallery" as const,
            status: "available" as const,
            mediaType: "image/png" as const,
            resolvedFrom: "original-fallback" as const,
            access: Object.freeze({
              previewToken: "preview-token-http-001",
              expiresAt: "2026-04-08T12:10:00.000Z",
            }),
          }),
        };
      },
    },
    openImageAssetPreviewContentUseCase: {
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            assetId: "image-asset:001",
            workspaceId: "workspace-alpha",
            mediaType: "image/png" as const,
            sizeBytes: 5,
            contentDisposition: "inline" as const,
            contentDispositionFileName: "image.png",
            stream: (async function* stream() {
              yield Buffer.from("hello", "utf8");
            })(),
          }),
        };
      },
    },
    imageAssetStoragePort: {
      async reserveStorageLocation() {
        throw new Error("not used");
      },
      async writeObject() {
        return Object.freeze({
          reference: Object.freeze({
            storageInstanceId: "storage-alpha",
            objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
            area: ImageAssetStorageObjectAreas.original,
          }),
          sizeBytes: 5,
          checksum: Object.freeze({
            algorithm: "sha256" as const,
            digest: "b".repeat(64),
          }),
          writtenAt: "2026-04-08T12:04:00.000Z",
        });
      },
      async openReadStream() {
        throw new Error("not used");
      },
      async createAccessHandle() {
        throw new Error("not used");
      },
      async resolveAccessHandle() {
        throw new Error("not used");
      },
      async deleteObject() {
        throw new Error("not used");
      },
    },
  });

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    imageAssetManagementBackendApi,
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

describe("IdentityHttpServer image asset management routes", () => {
  it("enforces auth/workspace guards and serves create/upload/finalize/get/list flows", async () => {
    const baseUrl = await startServer();
    const token = await registerAndLogin(baseUrl, "image.asset.http.owner");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`);
    expect(unauthenticated.status).toBe(401);
    const unauthenticatedOriginal = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/original?workspaceId=workspace-alpha`);
    expect(unauthenticatedOriginal.status).toBe(401);

    const created = await fetch(`${baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mediaType: "image/png",
        originalFilename: "image.png",
        sizeBytes: 5,
        fingerprint: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
    });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.ok).toBe(true);
    const uploadEndpoint = createdBody.data.upload.uploadEndpoint as string;
    expect(uploadEndpoint).toContain("/api/v1/image-assets/image-asset%3A001/uploads/");

    const uploaded = await fetch(`${baseUrl}${uploadEndpoint}?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "image/png",
      },
      body: Buffer.from("hello", "utf8"),
    });
    expect(uploaded.status).toBe(200);
    const uploadedBody = await uploaded.json();
    expect(uploadedBody.ok).toBe(true);
    expect(uploadedBody.data.sizeBytes).toBe(5);

    const completeEndpoint = uploadEndpoint.replace("/content", "/complete");
    const finalized = await fetch(`${baseUrl}${completeEndpoint}?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(finalized.status).toBe(200);
    const finalizedBody = await finalized.json();
    expect(finalizedBody.ok).toBe(true);
    expect(finalizedBody.data.asset.lifecycle.status).toBe("available");

    const detail = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.asset.assetId).toBe("image-asset:001");

    const listed = await fetch(`${baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha&status=available&ownerUserId=user-owner`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.ok).toBe(true);
    expect(listedBody.data.items).toHaveLength(1);

    const original = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/original?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe("image/png");
    expect(original.headers.get("content-disposition")).toContain("attachment");
    expect(await original.text()).toBe("hello");

    const preview = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/preview?workspaceId=workspace-alpha&representation=gallery&preferredMediaType=image%2Fpng`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(preview.status).toBe(200);
    const previewBody = await preview.json();
    expect(previewBody.ok).toBe(true);
    expect(previewBody.data.preview.status).toBe("available");
    expect(previewBody.data.preview.access.previewToken).toBe("preview-token-http-001");

    const previewContent = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/preview/content?workspaceId=workspace-alpha&previewToken=preview-token-http-001`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(previewContent.status).toBe(200);
    expect(previewContent.headers.get("content-type")).toBe("image/png");
    expect(previewContent.headers.get("content-disposition")).toContain("inline");
    expect(await previewContent.text()).toBe("hello");
  });
});
