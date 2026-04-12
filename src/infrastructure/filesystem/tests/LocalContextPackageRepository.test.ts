import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContextPackage } from "@application/context/models/ContextPackage";
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
        description: "Support prompt assets.",
        tags: ["workflow", "tooling"],
        fragments: [
          { id: "persona", kind: "persona", content: "You are reliable.", order: 1 },
          { id: "format", kind: "formatting-constraints", content: "Return markdown.", order: 2 },
        ],
      });

      await repository.save(contextPackage);

      expect(await repository.exists("ctx-persisted")).toBe(true);
      expect((await repository.load("ctx-persisted"))?.getFragmentText()).toContain("You are reliable.");
      expect((await repository.list({ tags: ["tooling"] })).map((item) => item.id)).toEqual(["ctx-persisted"]);
      expect((await repository.list({ query: "support" })).map((item) => item.id)).toEqual(["ctx-persisted"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves fragment ordering and stable ids across reloads", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-context-packages-order-"));

    try {
      const repository = new LocalContextPackageRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
      });

      await repository.save(
        new ContextPackage({
          id: "ctx-ordered",
          name: "Ordered Context",
          fragments: [
            { id: "z-last", kind: "examples", content: "Later", order: 9 },
            { id: "a-first", kind: "instructions", content: "First", order: 0 },
            { id: "m-middle", kind: "domain-notes", content: "Middle", order: 5 },
          ],
        }),
      );

      const loaded = await repository.load("ctx-ordered");
      expect(loaded?.id).toBe("ctx-ordered");
      expect(loaded?.fragments.map((fragment) => fragment.id)).toEqual(["a-first", "m-middle", "z-last"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deletes persisted packages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-context-packages-delete-"));

    try {
      const repository = new LocalContextPackageRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
      });

      await repository.save(
        new ContextPackage({
          id: "ctx-delete",
          name: "Delete Me",
          fragments: [{ id: "instructions", kind: "instructions", content: "Delete", order: 0 }],
        }),
      );

      await repository.delete("ctx-delete");

      expect(await repository.exists("ctx-delete")).toBe(false);
      expect(await repository.load("ctx-delete")).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

