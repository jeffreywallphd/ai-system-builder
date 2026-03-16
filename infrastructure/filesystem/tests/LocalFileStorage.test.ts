import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalFileStorage } from "../LocalFileStorage";

describe("LocalFileStorage", () => {
  it("writes, reads, moves, copies and lists files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-fs-"));
    const storage = new LocalFileStorage();

    try {
      const a = path.join(root, "a.txt");
      await storage.write({ path: a, content: "hello", createDirectories: true });
      expect(await storage.readText(a)).toBe("hello");

      const b = path.join(root, "b", "moved.txt");
      await storage.move({ fromPath: a, toPath: b, createDirectories: true });
      expect(await storage.exists(b)).toBe(true);

      const c = path.join(root, "c.txt");
      await storage.copy({ fromPath: b, toPath: c });
      expect(await storage.readText(c)).toBe("hello");

      const listed = await storage.list(root, { recursive: true });
      expect(listed.some((entry) => entry.path.endsWith("moved.txt"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
