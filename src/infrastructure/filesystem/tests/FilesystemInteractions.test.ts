import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalAssetRepository } from "../LocalAssetRepository";

describe("filesystem interactions", () => {
  it("repositories persist indexes through LocalFileStorage", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-fs-int-"));
    try {
      const fs = new LocalFileStorage();
      const repo = new LocalAssetRepository({ fileStorage: fs, rootDirectory: root });
      await repo.list();
      await fs.write({ path: path.join(root, "probe.txt"), content: "ok", createDirectories: true });
      expect(await fs.exists(path.join(root, "probe.txt"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
