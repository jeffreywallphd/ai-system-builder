import { describe, expect, it } from "bun:test";
import { ContextRecipe } from "../../../../application/context/models/ContextRecipe";
import { LocalStorageContextRecipeRepository } from "../LocalStorageContextRecipeRepository";

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } as Storage;
}

describe("LocalStorageContextRecipeRepository", () => {
  it("persists reusable context recipes in browser storage", async () => {
    const storage = createStorage();
    const repository = new LocalStorageContextRecipeRepository("test-context-recipes", storage);

    await repository.save(
      new ContextRecipe({
        id: "strict-json",
        name: "Strict JSON",
        packageReferences: [{ packageId: "pkg-json" }],
        guidance: { strictStructuredOutput: true },
      })
    );

    const loaded = await repository.load("strict-json");

    expect(loaded?.id).toBe("strict-json");
    expect(loaded?.guidance?.strictStructuredOutput).toBeTrue();
  });
});
