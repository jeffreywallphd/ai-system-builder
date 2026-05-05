import { constants } from "node:fs";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, testDouble } from "../../../../../testing/node-test";
import { createFilesystemGeneratedImagePersistenceAdapter } from "../createFilesystemGeneratedImagePersistenceAdapter";

describe("createFilesystemGeneratedImagePersistenceAdapter", () => {
  it("moves comfy output into generated/images with safe artifact key and writes catalog+binding", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-move-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "x.png"), "abc");
    const artifactCatalogAppend = { appendArtifactCatalogRecord: testDouble.fn(async () => ({ ok: true as const, value: { storageKey: "generated/images/x.png" } })) };
    const artifactStorageBinding = { upsertArtifactStorageBinding: testDouble.fn(async () => ({ ok: true as const, value: { binding: {} } })) };
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store, artifactCatalogAppend, artifactStorageBinding });
    const result = await adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "x.png" }, requestId: "req-1" });
    expect(result.storageKey).toBe("generated/images/x.png");
    await expect(stat(path.join(store, result.storageKey))).resolves.toEqual(expect.objectContaining({ isFile: expect.any(Function) }));
    await expect(stat(path.join(out, "x.png"))).rejects.toThrow();
    expect(artifactCatalogAppend.appendArtifactCatalogRecord).toHaveBeenCalledWith(expect.objectContaining({ record: expect.objectContaining({ sourceKind: "generated", artifactFamily: "image" }) }));
    expect(artifactStorageBinding.upsertArtifactStorageBinding).toHaveBeenCalledWith(expect.objectContaining({ binding: expect.objectContaining({ artifactId: result.artifactId, role: "primary", backing: expect.objectContaining({ kind: "artifact-object", provider: "filesystem", locator: result.storageKey, verification: expect.objectContaining({ exists: true }) }) }) }));
  });

  it("rejects path traversal in filename and subfolder", async () => {
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: "/tmp/out", artifactStorageRoot: "/tmp/store" });
    await expect(adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "../x.png" }, requestId: "req-1" })).rejects.toThrow();
    await expect(adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "x.png", subfolder: "../evil" }, requestId: "req-1" })).rejects.toThrow();
  });

  it("falls back to copy-delete on EXDEV rename", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-fallback-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "x.png"), "abc");
    const renameSpy = testDouble.spyOn(require("node:fs/promises"), "rename").mockRejectedValueOnce(Object.assign(new Error("exdev"), { code: "EXDEV" }));
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store });
    const result = await adapter.persistGeneratedImage({ output: { type: "image", engine: "comfyui", fileName: "x.png" }, requestId: "req-1" });
    expect((await readFile(path.join(store, result.storageKey), "utf8"))).toBe("abc");
    renameSpy.mockRestore();
  });

  it("persists generated image from in-memory base64 content when runtime file was already deleted", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-memory-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store });
    const pngBody = Buffer.from("abc");
    const result = await adapter.persistGeneratedImage({
      output: { type: "image", engine: "comfyui", fileName: "x.png", contentBase64: pngBody.toString("base64"), mediaType: "image/png" },
      requestId: "req-1",
    });
    await expect(stat(path.join(store, result.storageKey))).resolves.toEqual(expect.objectContaining({ isFile: expect.any(Function) }));
    expect(await readFile(path.join(store, result.storageKey))).toEqual(pngBody);
  });

  it("uses preferred user file names and appends numeric suffixes for collisions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "img-user-name-"));
    const out = path.join(root, "comfy");
    const store = path.join(root, "store");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "x.png"), "abc");
    await mkdir(path.join(store, "generated/images"), { recursive: true });
    await writeFile(path.join(store, "generated/images/my-image.png"), "existing");
    const adapter = createFilesystemGeneratedImagePersistenceAdapter({ comfyUiOutputRoot: out, artifactStorageRoot: store });
    const result = await adapter.persistGeneratedImage({
      output: { type: "image", engine: "comfyui", fileName: "x.png", contentBase64: Buffer.from("abc").toString("base64") },
      requestId: "req-1",
      preferredFileName: "my image.png",
    });
    expect(result.storageKey).toBe("generated/images/my-image-2.png");
  });
});
