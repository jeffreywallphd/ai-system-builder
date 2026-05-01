import { mkdtemp, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, testDouble } from "../../../../../testing/node-test";
import { createFilesystemGeneratedImagePersistenceAdapter } from "../createFilesystemGeneratedImagePersistenceAdapter";

describe("createFilesystemGeneratedImagePersistenceAdapter", () => {
  it("moves comfy output into generated/images/<assetId>", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-move-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "x.png"), "abc");
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store });
    const result = await adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "x.png" }, assetId: "asset-1" });
    expect(result.artifactId).toBe("generated/images/asset-1/x.png");
    await expect(access(path.join(store, "generated/images/asset-1/x.png"))).resolves.toBeUndefined();
    await expect(access(path.join(out, "x.png"))).rejects.toThrow();
  });

  it("rejects path traversal", async () => {
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: "/tmp/out", artifactStorageRoot: "/tmp/store" });
    await expect(adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "../x.png" }, assetId: "asset-1" })).rejects.toThrow();
  });
});
