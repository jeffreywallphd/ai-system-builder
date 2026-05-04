import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "../../../../testing/node-test";
import { createLocalImageAssetRegistryAdapter } from "../createLocalImageAssetRegistryAdapter";

describe("createLocalImageAssetRegistryAdapter", () => {
  it("preserves generation metadata fields", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-reg-"));
    const filePath = path.join(root, "image-assets.json");
    const adapter = createLocalImageAssetRegistryAdapter({ filePath, now: () => "2026-05-01T00:00:00.000Z" });
    await adapter.registerImageAsset({ assetId: "asset-1", artifactId: "artifacts/x", source: "generated", metadata: { requestId: "req-1", originalFileName: "output_1.png", prompt: "cat", negativePrompt: "dog", seed: 7, model: "sdxl", engine: "comfyui", workflowTemplateId: "wf-1", width: 512, height: 512, createdAt: "2026-05-01T00:00:00.000Z" } });
    const asset = await adapter.getImageAsset("asset-1");
    expect(asset).toEqual(expect.objectContaining({ source: "generated", metadata: expect.objectContaining({ requestId: "req-1", originalFileName: "output_1.png", prompt: "cat", negativePrompt: "dog", seed: 7, model: "sdxl", engine: "comfyui", workflowTemplateId: "wf-1", width: 512, height: 512, createdAt: "2026-05-01T00:00:00.000Z" }) }));
  });
});
