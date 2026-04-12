import { describe, expect, it } from "bun:test";
import {
  toAuthorizeAssetDownloadRequest,
  toGetAssetByIdQuery,
  toListAssetsQuery,
  toResolveAssetPreviewQuery,
} from "../AssetTransportDtos";

describe("AssetTransportDtos", () => {
  it("normalizes list-query DTOs into application-safe query contracts", () => {
    const query = toListAssetsQuery({
      actorUserId: " user-owner ",
      workspaceId: " workspace-a ",
      ownerUserId: " user-owner ",
      limit: 5,
      offset: 0,
    });

    expect(query.actorUserId).toBe("user-owner");
    expect(query.workspaceId).toBe("workspace-a");
    expect(query.ownerUserId).toBe("user-owner");
    expect(Object.isFrozen(query)).toBeTrue();
  });

  it("validates download authorization DTOs through application validators", () => {
    expect(() => toAuthorizeAssetDownloadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      assetId: "asset-1",
      purpose: "download",
      expiresInSeconds: 0,
    })).toThrow("expiresInSeconds");
  });

  it("normalizes preview request DTOs", () => {
    const query = toResolveAssetPreviewQuery({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      assetId: "asset-1",
      preferredMimeTypes: ["IMAGE/PNG", "image/jpeg"],
    });

    expect(query.preferredMimeTypes).toEqual(["image/png", "image/jpeg"]);
  });

  it("normalizes get-asset-detail DTOs", () => {
    const query = toGetAssetByIdQuery({
      actorUserId: " user-owner ",
      workspaceId: " workspace-a ",
      assetId: " asset-1 ",
      includeDeleted: true,
    });

    expect(query.actorUserId).toBe("user-owner");
    expect(query.workspaceId).toBe("workspace-a");
    expect(query.assetId).toBe("asset-1");
    expect(query.includeDeleted).toBeTrue();
  });
});

