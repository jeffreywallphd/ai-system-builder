import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContextPackage } from "../../../application/context/models/ContextPackage";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalContextPackageRepository } from "../LocalContextPackageRepository";

describe("LocalContextPackageRepository", () => {
  it("saves, loads, lists, and checks existence for persisted context packages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-context-packages-"));

    try {
      const repository = new LocalContextPackageRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
      });
      const contextPackage = new ContextPackage({
        id: "ctx-persisted",
        name: "Persisted Context",
        tags: ["workflow", "tooling"],
        fragments: [
          { id: "persona", kind: "persona", content: "You are reliable.", order: 1 },
          { id: "format", kind: "formatting-constraints", content: "Return markdown.", order: 2 },
        ],
      });

      await repository.save(contextPackage);

      expect(await repository.exists("ctx-persisted")).toBe(true);
      expect((await repository.load("ctx-persisted"))?.getFragmentText()).toContain(
        "You are reliable."
      );
      expect((await repository.list({ tags: ["tooling"] })).map((item) => item.id)).toEqual([
        "ctx-persisted",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
