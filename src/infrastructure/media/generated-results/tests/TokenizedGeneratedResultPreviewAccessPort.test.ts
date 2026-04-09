import { describe, expect, it } from "bun:test";
import { TokenizedGeneratedResultPreviewAccessPort } from "../TokenizedGeneratedResultPreviewAccessPort";

describe("TokenizedGeneratedResultPreviewAccessPort", () => {
  it("creates protected-resource and preview-access descriptors without raw storage leakage", () => {
    const adapter = new TokenizedGeneratedResultPreviewAccessPort("preview-secret-alpha");

    const descriptor = adapter.createPreviewAccessDescriptor({
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      derivativeId: "preview-display-safe-abcd",
      previewKind: "display-safe",
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/generated-results/gr-asset-001/previews/display-safe/file.webp",
      occurredAt: "2026-04-08T12:00:00.000Z",
    });

    expect(descriptor.protectedResourceId).toMatch(/^protected-resource:\/\/gr-preview-[a-f0-9]{24}$/);
    expect(descriptor.accessHandle).toMatch(/^preview-access:\/\/generated-results\//);
    expect(descriptor.accessHandle).not.toContain("storage-alpha");
    expect(descriptor.accessHandle).not.toContain("workspaces/workspace-alpha");
  });
});
