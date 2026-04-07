import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Asset } from "@domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalAssetRepository } from "../LocalAssetRepository";

describe("LocalAssetRepository", () => {
  it("persists and filters assets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-assets-"));
    try {
      const repo = new LocalAssetRepository({ fileStorage: new LocalFileStorage(), rootDirectory: root });
      const asset = new Asset({
        id: "a1",
        name: "Preview",
        kind: "image",
        source: new AssetSourceInfo({ type: "workflow-output", workflowId: "wf-1" }),
        location: new AssetLocation({ accessMethod: "file", location: "/tmp/a1.png", format: "png" }),
      });

      await repo.save(asset);
      expect((await repo.getById("a1"))?.name).toBe("Preview");
      expect((await repo.list({ workflowId: "wf-1" })).length).toBe(1);
      expect(await repo.remove("a1")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

