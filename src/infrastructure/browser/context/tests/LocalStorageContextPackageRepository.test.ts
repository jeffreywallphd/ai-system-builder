import { describe, expect, it } from "bun:test";
import { ContextPackage } from "@application/context/models/ContextPackage";
import { LocalStorageContextPackageRepository } from "../LocalStorageContextPackageRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("LocalStorageContextPackageRepository", () => {
  it("persists reusable context packages in browser storage", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageContextPackageRepository("test-context", storage as never);

    await repository.save(
      new ContextPackage({
        id: "ctx-browser",
        name: "Browser Context",
        description: "Support authoring package",
        tags: ["support", "persona"],
        fragments: [
          { id: "persona", kind: "persona", content: "Helpful", order: 2 },
          { id: "instructions", kind: "instructions", content: "Clear", order: 1 },
        ],
      }),
    );

    const loaded = await repository.load("ctx-browser");
    expect(loaded?.fragments.map((fragment) => fragment.id)).toEqual(["instructions", "persona"]);
    expect((await repository.list({ query: "support" }))[0]?.id).toBe("ctx-browser");
  });

  it("deletes packages from browser storage", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageContextPackageRepository("test-context", storage as never);

    await repository.save(
      new ContextPackage({
        id: "ctx-delete",
        name: "Delete",
        fragments: [{ id: "instructions", kind: "instructions", content: "Delete", order: 0 }],
      }),
    );

    await repository.delete("ctx-delete");

    expect(await repository.exists("ctx-delete")).toBe(false);
  });
});

