import { describe, expect, it, mock } from "bun:test";
import { AssetWorkflowService } from "../AssetWorkflowService";
import type { AssetWorkflowClient } from "@shared/assets/AssetWorkflowClient";

describe("AssetWorkflowService", () => {
  it("delegates asset workflow operations to the shared client", async () => {
    const client: AssetWorkflowClient = {
      listAssets: mock(async () => ({ ok: true, data: {} as any })),
      getAssetDetail: mock(async () => ({ ok: true, data: {} as any })),
      initiateUpload: mock(async () => ({ ok: true, data: {} as any })),
      uploadContent: mock(async () => ({ ok: true, data: {} as any })),
      authorizeDownload: mock(async () => ({ ok: true, data: {} as any })),
      resolvePreview: mock(async () => ({ ok: true, data: {} as any })),
    };

    const service = new AssetWorkflowService(client);

    await service.listAssets({ workspaceId: "workspace-1" }, "token-1");
    await service.getAssetDetail({ workspaceId: "workspace-1", assetId: "asset-1" }, "token-2");
    await service.initiateUpload({
      workspaceId: "workspace-1",
      assetId: "asset-1",
      storageInstanceId: "storage-1",
      fileName: "a.png",
      mimeType: "image/png",
      sizeBytes: 10,
    }, "token-3");
    await service.uploadContent({
      workspaceId: "workspace-1",
      uploadSessionId: "asset-upload-session:test-1",
      contentType: "image/png",
    }, new Uint8Array([1, 2, 3]), "token-4");
    await service.authorizeDownload({ workspaceId: "workspace-1", assetId: "asset-1", purpose: "download" }, "token-5");
    await service.resolvePreview({ workspaceId: "workspace-1", assetId: "asset-1" }, "token-6");

    expect(client.listAssets).toHaveBeenCalledTimes(1);
    expect(client.getAssetDetail).toHaveBeenCalledTimes(1);
    expect(client.initiateUpload).toHaveBeenCalledTimes(1);
    expect(client.uploadContent).toHaveBeenCalledTimes(1);
    expect(client.authorizeDownload).toHaveBeenCalledTimes(1);
    expect(client.resolvePreview).toHaveBeenCalledTimes(1);
  });
});

