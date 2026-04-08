import { describe, expect, it } from "bun:test";
import {
  ImageAssetTransportRoutes,
  buildImageAssetAccessPath,
  buildImageAssetOriginalContentPath,
  buildImageAssetRoutePath,
  buildImageAssetUploadCompletionPath,
  toImageAssetListQueryParams,
} from "../ImageAssetTransportContracts";

describe("ImageAssetTransportContracts", () => {
  it("builds image-asset list query params with repeated filter keys", () => {
    const query = toImageAssetListQueryParams({
      workspaceId: "workspace:img",
      filters: {
        ownerUserIds: ["user:1", "user:2"],
        originKinds: ["uploaded-source", "generated-result"],
        statuses: ["available"],
        visibilities: ["workspace"],
        mediaTypes: ["image/png", "image/webp"],
        storageInstanceIds: ["storage-a"],
        limit: 10,
        offset: 5,
      },
    });

    expect(query.toString()).toBe(
      "workspaceId=workspace%3Aimg&ownerUserId=user%3A1&ownerUserId=user%3A2&originKind=uploaded-source&originKind=generated-result&status=available&visibility=workspace&mediaType=image%2Fpng&mediaType=image%2Fwebp&storageInstanceId=storage-a&limit=10&offset=5",
    );
  });

  it("builds canonical route helpers for detail, completion, and access", () => {
    expect(buildImageAssetRoutePath({ assetId: "asset:1" })).toBe("/api/v1/image-assets/asset%3A1");
    expect(
      buildImageAssetUploadCompletionPath({ assetId: "asset:1", uploadSessionId: "upload:1" }),
    ).toBe("/api/v1/image-assets/asset%3A1/uploads/upload%3A1/complete");
    expect(buildImageAssetAccessPath({ assetId: "asset:1" })).toBe("/api/v1/image-assets/asset%3A1/access");
    expect(buildImageAssetOriginalContentPath({ assetId: "asset:1" })).toBe("/api/v1/image-assets/asset%3A1/original");
  });

  it("exposes canonical image-asset API routes", () => {
    expect(ImageAssetTransportRoutes.createImageAsset).toBe("/api/v1/image-assets");
    expect(ImageAssetTransportRoutes.getImageAsset).toBe("/api/v1/image-assets/:assetId");
    expect(ImageAssetTransportRoutes.initiateUpload).toBe("/api/v1/image-assets/:assetId/uploads/initiate");
    expect(ImageAssetTransportRoutes.requestPreview).toBe("/api/v1/image-assets/:assetId/preview");
    expect(ImageAssetTransportRoutes.requestAccess).toBe("/api/v1/image-assets/:assetId/access");
    expect(ImageAssetTransportRoutes.getOriginalContent).toBe("/api/v1/image-assets/:assetId/original");
    expect(ImageAssetTransportRoutes.listEvents).toBe("/api/v1/image-assets/events");
  });
});
