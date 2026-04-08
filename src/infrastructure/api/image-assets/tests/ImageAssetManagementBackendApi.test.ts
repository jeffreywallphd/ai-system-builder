import { describe, expect, it } from "bun:test";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  SupportedImageMediaTypes,
} from "@domain/image-assets/ImageAssetDomain";
import { ResourceVisibilities, SharingPolicyModes } from "@domain/authorization/AuthorizationDomain";
import { ImageAssetStorageObjectAreas } from "@application/image-assets/ports/ImageAssetStoragePort";
import { ImageAssetManagementBackendApi } from "../ImageAssetManagementBackendApi";

const baseAsset = Object.freeze({
  assetId: "image-asset:001",
  workspaceId: "workspace-alpha",
  ownerUserId: "user-owner",
  originKind: ImageAssetOriginKinds.uploadedSource,
  mediaType: SupportedImageMediaTypes[0],
  originalFilename: "image.png",
  normalizedFilename: "image.png",
  sizeBytes: 4,
  fingerprint: Object.freeze({
    algorithm: ImageAssetFingerprintAlgorithms.sha256,
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
  createdAt: "2026-04-08T10:00:00.000Z",
  updatedAt: "2026-04-08T10:00:00.000Z",
});

describe("ImageAssetManagementBackendApi", () => {
  it("creates, ingests upload content, finalizes upload, gets detail, and lists assets", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: Object.freeze({
                ...baseAsset,
                lifecycle: Object.freeze({
                  status: ImageAssetStatuses.available,
                  ingestedAt: "2026-04-08T10:05:00.000Z",
                }),
              }),
              upload: Object.freeze({
                status: "finalized" as const,
                reference: Object.freeze({
                  storageInstanceId: "storage-alpha",
                  objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                  area: ImageAssetStorageObjectAreas.original,
                }),
                finalizedAt: "2026-04-08T10:05:00.000Z",
                observedSizeBytes: 4,
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
              asset: baseAsset,
            }),
          };
        },
      },
      listImageAssetMetadataUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              items: Object.freeze([baseAsset]),
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
              sizeBytes: 4,
              contentDisposition: "attachment" as const,
              contentDispositionFileName: "image.png",
              stream: (async function* bytes() {
                yield new Uint8Array([1, 2, 3, 4]);
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
            sizeBytes: 4,
            checksum: Object.freeze({
              algorithm: "sha256" as const,
              digest: "b".repeat(64),
            }),
            writtenAt: "2026-04-08T10:04:00.000Z",
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

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }
    expect(created.data.asset.assetId).toBe("image-asset:001");
    expect(created.data.upload.uploadEndpoint).toContain("/api/v1/image-assets/image-asset%3A001/uploads/");
    expect(created.data.upload.uploadSessionId.length).toBeGreaterThan(20);

    const uploadSessionId = created.data.upload.uploadSessionId;

    const ingested = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId,
      content: (async function* bytes() {
        yield new Uint8Array([1, 2, 3, 4]);
      })(),
    });
    expect(ingested.ok).toBeTrue();
    if (!ingested.ok || !ingested.data) {
      return;
    }
    expect(ingested.data.sizeBytes).toBe(4);

    const completed = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId,
    });
    expect(completed.ok).toBeTrue();
    if (!completed.ok || !completed.data) {
      return;
    }
    expect(completed.data.asset.lifecycle.status).toBe("available");
    expect(completed.data.finalizedAt).toBe("2026-04-08T10:05:00.000Z");

    const detail = await backend.getImageAssetMetadata({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok || !detail.data) {
      return;
    }
    expect(detail.data.asset.assetId).toBe("image-asset:001");

    const listed = await backend.listImageAssetMetadata({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok || !listed.data) {
      return;
    }
    expect(listed.data.items).toHaveLength(1);
    expect(listed.data.pagination.returned).toBe(1);
  });

  it("rejects invalid upload session tokens", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const response = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: "invalid",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });

  it("rejects upload session tokens with tampered signature length without throwing", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    const tokenParts = created.data.upload.uploadSessionId.split(".");
    const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.x`;

    const response = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: tamperedToken,
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });

  it("opens protected image-asset original content streams", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              mediaType: "image/png" as const,
              sizeBytes: 4,
              contentDisposition: "attachment" as const,
              contentDispositionFileName: "image.png",
              stream: (async function* bytes() {
                yield new Uint8Array([1, 2, 3, 4]);
              })(),
            }),
          };
        },
      },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const opened = await backend.openImageAssetOriginalContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(opened.ok).toBeTrue();
    if (!opened.ok || !opened.data) {
      return;
    }
    expect(opened.data.mimeType).toBe("image/png");
    expect(opened.data.contentDisposition).toBe("attachment");

    const chunks: number[] = [];
    for await (const chunk of opened.data.stream) {
      chunks.push(...chunk);
    }
    expect(chunks).toEqual([1, 2, 3, 4]);
  });
});
