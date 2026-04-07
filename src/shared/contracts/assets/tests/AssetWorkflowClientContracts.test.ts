import { describe, expect, it } from "bun:test";
import {
  AssetWorkflowTransportRoutes,
  AssetWorkflowClientContractVersions,
  buildAssetUploadSessionContentPath,
  buildAuthorizedAssetDownloadPath,
  toAssetWorkflowDetailQueryParams,
  toAssetWorkflowListQueryParams,
  toAssetWorkflowPreviewQueryParams,
} from "../AssetWorkflowClientContracts";

describe("AssetWorkflowClientContracts", () => {
  it("builds list query parameters with repeated filter keys", () => {
    const query = toAssetWorkflowListQueryParams({
      contractVersion: AssetWorkflowClientContractVersions.v1,
      workspaceId: " workspace-1 ",
      assetKinds: ["uploaded-file", "generated-output"],
      visibilities: ["workspace", "shared"],
      lifecycleStates: ["active"],
      limit: 25,
      offset: 5,
    });

    expect(query.toString()).toBe(
      "workspaceId=workspace-1&assetKind=uploaded-file&assetKind=generated-output&visibility=workspace&visibility=shared&lifecycleState=active&limit=25&offset=5",
    );
  });

  it("builds detail and preview query parameters", () => {
    const detailQuery = toAssetWorkflowDetailQueryParams({
      contractVersion: AssetWorkflowClientContractVersions.v1,
      workspaceId: "workspace-1",
      assetId: "asset-1",
      includeDeleted: true,
    });

    const previewQuery = toAssetWorkflowPreviewQueryParams({
      contractVersion: AssetWorkflowClientContractVersions.v1,
      workspaceId: "workspace-1",
      assetId: "asset-1",
      preferredMimeTypes: ["image/webp", "image/png"],
    });

    expect(detailQuery.toString()).toBe("workspaceId=workspace-1&includeDeleted=true");
    expect(previewQuery.toString()).toBe("workspaceId=workspace-1&preferredMimeType=image%2Fwebp&preferredMimeType=image%2Fpng");
  });

  it("builds authorized download paths without exposing storage object internals", () => {
    const path = buildAuthorizedAssetDownloadPath({
      workspaceId: "workspace-1",
      assetId: "asset:1",
      contentToken: "token-1",
    });

    expect(path).toBe("/api/v1/assets/asset%3A1/downloads/content?workspaceId=workspace-1&contentToken=token-1");
    expect(path).not.toContain("objectKey");
    expect(path).not.toContain("storageInstanceId");
  });

  it("defines canonical protected asset transfer routes", () => {
    expect(AssetWorkflowTransportRoutes.initiateUpload).toBe("/api/v1/assets/:assetId/uploads/initiate");
    expect(AssetWorkflowTransportRoutes.uploadSessionContent).toBe("/api/v1/assets/upload-sessions/:uploadSessionId/content");
    expect(AssetWorkflowTransportRoutes.authorizeDownload).toBe("/api/v1/assets/:assetId/downloads/authorize");
    expect(AssetWorkflowTransportRoutes.downloadContent).toBe("/api/v1/assets/:assetId/downloads/content");
    expect(AssetWorkflowTransportRoutes.resolvePreview).toBe("/api/v1/assets/:assetId/preview");
  });

  it("builds upload-session content paths without exposing storage object internals", () => {
    const path = buildAssetUploadSessionContentPath({
      workspaceId: "workspace-1",
      uploadSessionId: "session:1",
    });

    expect(path).toBe("/api/v1/assets/upload-sessions/session%3A1/content?workspaceId=workspace-1");
    expect(path).not.toContain("objectKey");
    expect(path).not.toContain("storageInstanceId");
  });
});
