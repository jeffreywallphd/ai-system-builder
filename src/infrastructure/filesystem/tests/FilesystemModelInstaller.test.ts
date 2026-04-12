import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Model, ModelArtifact, ModelSource } from "@domain/models/Model";
import { FilesystemModelInstaller } from "../FilesystemModelInstaller";
import { LocalFileStorage } from "../LocalFileStorage";

describe("FilesystemModelInstaller", () => {
  it("removes managed local artifacts for an installed model", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-fs-uninstall-"));
    try {
      const filePath = path.join(root, "model.gguf");
      await writeFile(filePath, "weights");
      const model = new Model({
        id: "demo-model",
        name: "Demo model",
        kind: "completion-model",
        source: new ModelSource({ type: "local" }),
        artifact: new ModelArtifact({ name: "model.gguf", accessMethod: "local-file", location: filePath, format: "gguf" }),
      });
      const installer = new FilesystemModelInstaller(new LocalFileStorage());

      await installer.uninstall({ model, removeArtifacts: true });

      expect(await new LocalFileStorage().exists(filePath)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

