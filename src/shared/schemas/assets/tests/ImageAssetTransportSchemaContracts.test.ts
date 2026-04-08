import { describe, expect, it } from "bun:test";
import {
  ImageAssetTransportSchemaValidationError,
  parseCreateImageAssetRequestDto,
  parseListImageAssetEventsResponseDto,
  parseListImageAssetsResponseDto,
  parseRequestImageAssetAccessResponseDto,
} from "../ImageAssetTransportSchemaContracts";

describe("ImageAssetTransportSchemaContracts", () => {
  it("parses create-image-asset request payloads", () => {
    const parsed = parseCreateImageAssetRequestDto({
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
      sizeBytes: 2048,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
      sharingPolicy: {
        mode: "owner-only",
      },
      lineage: {
        upstreamAssetIds: ["asset:seed-1"],
      },
    });

    expect(parsed.storage.storageBindingReference).toBe("storage-instance://storage-image-001/input");
    expect(parsed.fingerprint.digest).toHaveLength(64);
  });

  it("rejects filesystem-path-like storage binding references", () => {
    expect(() => parseCreateImageAssetRequestDto({
      contractVersion: "image-asset-transport/v1",
      actorUserId: "user:author",
      workspaceId: "workspace:image",
      originKind: "uploaded-source",
      visibility: "private",
      ownerUserId: "user:author",
      storage: {
        storageInstanceId: "storage-image-001",
        storageBindingReference: "C:\\temp\\image.png",
      },
      mediaType: "image/png",
      originalFilename: "source.png",
      normalizedFilename: "source.png",
      sizeBytes: 2048,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    })).toThrow(ImageAssetTransportSchemaValidationError);
  });

  it("rejects non-logical response fields that leak raw path values", () => {
    expect(() => parseRequestImageAssetAccessResponseDto({
      access: {
        contractVersion: "image-asset-transport/v1",
        assetId: "asset:1",
        workspaceId: "workspace:image",
        purpose: "export",
        mediaType: "image/png",
        sizeBytes: 2048,
        token: "opaque-token",
        expiresAt: "2026-04-08T15:00:00.000Z",
        path: "C:\\leak\\asset.png",
      },
    })).toThrow(ImageAssetTransportSchemaValidationError);
  });

  it("parses list response payloads with pagination", () => {
    const parsed = parseListImageAssetsResponseDto({
      items: [{
        contractVersion: "image-asset-transport/v1",
        assetId: "asset:100",
        originKind: "generated-result",
        mediaType: "image/webp",
        normalizedFilename: "output.webp",
        sizeBytes: 1024,
        visibility: "workspace",
        ownership: {
          workspaceId: "workspace:image",
          createdBy: "user:author",
          lastModifiedBy: "user:author",
          createdAt: "2026-04-08T13:00:00.000Z",
          updatedAt: "2026-04-08T13:01:00.000Z",
        },
        storage: {
          storageInstanceId: "storage-image-001",
          storageBindingReference: "storage-instance://storage-image-001/output",
        },
        lifecycle: {
          status: "available",
          ingestedAt: "2026-04-08T13:01:00.000Z",
        },
        preview: {
          available: true,
          previewAssetId: "asset:preview-100",
          mediaType: "image/webp",
        },
      }],
      pagination: {
        limit: 25,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(parsed.items[0]?.assetId).toBe("asset:100");
    expect(parsed.pagination.returned).toBe(1);
  });

  it("parses event-list response payloads with contract-versioned events", () => {
    const parsed = parseListImageAssetEventsResponseDto({
      items: [{
        contractVersion: "image-asset-transport/v1",
        eventId: "event:100",
        kind: "upload-completed",
        occurredAt: "2026-04-08T13:02:00.000Z",
        workspaceId: "workspace:image",
        actorUserId: "user:author",
        assetId: "asset:100",
        lifecycleStatus: "available",
        uploadSessionId: "upload:100",
        details: {
          sizeBytes: 1024,
        },
      }],
      pagination: {
        limit: 50,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(parsed.items[0]?.kind).toBe("upload-completed");
    expect(parsed.items[0]?.uploadSessionId).toBe("upload:100");
  });
});
