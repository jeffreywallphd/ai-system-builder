import { describe, expect, it } from "bun:test";
import { EncryptedAssetDownloadGrantAdapter } from "../EncryptedAssetDownloadGrantAdapter";

describe("EncryptedAssetDownloadGrantAdapter", () => {
  it("issues opaque grants and resolves them only for matching actor/workspace/asset", async () => {
    const adapter = new EncryptedAssetDownloadGrantAdapter({
      secret: "asset-download-secret-for-tests",
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const issued = await adapter.issueDownloadGrant({
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      assetId: "asset-download-001",
      versionId: "asset-download-001:v1",
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/assets/asset-download-001/output/v1/file.png",
      area: "output",
      mimeType: "image/png",
      sizeBytes: 5,
      purpose: "download",
      expiresInSeconds: 120,
    });

    expect(issued.contentToken.startsWith("assetdlv1.")).toBeTrue();
    expect(issued.contentToken.includes("workspaces/workspace-alpha")).toBeFalse();

    const resolved = await adapter.resolveDownloadGrant({
      contentToken: issued.contentToken,
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      assetId: "asset-download-001",
      occurredAt: "2026-04-06T12:00:30.000Z",
    });

    expect(resolved?.assetId).toBe("asset-download-001");
    expect(resolved?.objectKey).toContain("workspaces/workspace-alpha/assets");

    const wrongActor = await adapter.resolveDownloadGrant({
      contentToken: issued.contentToken,
      workspaceId: "workspace-alpha",
      actorUserId: "user-other",
      assetId: "asset-download-001",
      occurredAt: "2026-04-06T12:00:30.000Z",
    });
    expect(wrongActor).toBeUndefined();
  });

  it("rejects expired grants", async () => {
    const adapter = new EncryptedAssetDownloadGrantAdapter({
      secret: "asset-download-secret-for-tests",
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });
    const issued = await adapter.issueDownloadGrant({
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      assetId: "asset-download-001",
      versionId: "asset-download-001:v1",
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/assets/asset-download-001/output/v1/file.png",
      area: "output",
      mimeType: "image/png",
      sizeBytes: 5,
      purpose: "download",
      expiresInSeconds: 1,
    });

    const resolved = await adapter.resolveDownloadGrant({
      contentToken: issued.contentToken,
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      assetId: "asset-download-001",
      occurredAt: "2026-04-06T12:00:02.000Z",
    });
    expect(resolved).toBeUndefined();
  });
});

