import { describe, expect, it } from "bun:test";
import type {
  CreateImageAssetRequestDto,
  RequestImageAssetAccessResponseDto,
} from "../ImageAssetTransportDtos";

describe("ImageAssetTransportDtos", () => {
  it("captures create-image request DTOs with logical storage references", () => {
    const request: CreateImageAssetRequestDto = {
      contractVersion: "image-asset-transport/v1",
      actorUserId: "user:author",
      workspaceId: "workspace:image",
      originKind: "uploaded-source",
      visibility: "private",
      ownerUserId: "user:author",
      storage: {
        storageInstanceId: "storage-image-001",
        storageBindingReference: "storage-instance://storage-image-001/input",
      },
      mediaType: "image/png",
      originalFilename: "source.png",
      normalizedFilename: "source.png",
      sizeBytes: 1024,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
      sharingPolicy: {
        mode: "owner-only",
      },
    };

    expect(request.storage.storageBindingReference).toBe("storage-instance://storage-image-001/input");
  });

  it("keeps access responses tokenized and path-free", () => {
    const response: RequestImageAssetAccessResponseDto = {
      access: {
        contractVersion: "image-asset-transport/v1",
        assetId: "asset:100",
        workspaceId: "workspace:image",
        purpose: "export",
        mediaType: "image/webp",
        sizeBytes: 1024,
        token: "opaque-token",
        expiresAt: "2026-04-08T15:00:00.000Z",
      },
    };

    expect((response.access as unknown as { path?: string }).path).toBeUndefined();
    expect(response.access.token).toBe("opaque-token");
  });
});
