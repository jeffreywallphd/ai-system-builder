import { mkdtemp, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, testDouble } from "../../../../../testing/node-test";
import { createFilesystemGeneratedImagePersistenceAdapter } from "../createFilesystemGeneratedImagePersistenceAdapter";

describe("createFilesystemGeneratedImagePersistenceAdapter", () => {
  it("moves comfy output into generated/images/<artifactId>.png", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-move-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "x.png"), "abc");
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store });
    const result = await adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "x.png" }, requestId: "req-1" });
    expect(result.storageKey).toBe(`generated/images/${result.artifactId}.png`);
    await expect(access(path.join(store, result.storageKey))).resolves.toBeUndefined();
    await expect(access(path.join(out, "x.png"))).rejects.toThrow();
  });

  it("catalogs generated images with generated sourceKind", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-catalog-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "x.png"), "abc");
    const artifactCatalogAppend = { appendArtifactCatalogRecord: testDouble.fn(async () => ({ ok: true as const, value: { storageKey: "generated/images/x.png" } })) };
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store, artifactCatalogAppend, now: () => "2026-05-01T00:00:00.000Z" });
    await adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "x.png" }, requestId: "req-1" });
    expect(artifactCatalogAppend.appendArtifactCatalogRecord).toHaveBeenCalled();
  });

  it("rejects path traversal", async () => {
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: "/tmp/out", artifactStorageRoot: "/tmp/store" });
    await expect(adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "../x.png" }, requestId: "req-1" })).rejects.toThrow();
  });
});
