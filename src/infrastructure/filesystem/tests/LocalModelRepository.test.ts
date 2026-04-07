import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Model, ModelArtifact, ModelSource } from "../../../src/domain/models/Model";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalModelRepository } from "../LocalModelRepository";

describe("LocalModelRepository", () => {
  it("stores and removes installed models", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-models-"));
    try {
      const repo = new LocalModelRepository({ fileStorage: new LocalFileStorage(), rootDirectory: root });
      const model = new Model({
        id: "m1",
        name: "Base",
        kind: "completion-model",
        source: new ModelSource({ type: "local" }),
        artifact: new ModelArtifact({ name: "weights", accessMethod: "local-file", format: "gguf" }),
      });

      await repo.saveInstalled(model);
      expect(await repo.isInstalled("m1")).toBe(true);
      expect((await repo.listInstalled({ query: "base" })).length).toBe(1);
      expect(await repo.removeInstalled("m1")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
