import { describe, expect, it } from "bun:test";
import { LocalStorageInstalledModelCatalog } from "../LocalStorageInstalledModelCatalog";
import { makeModel } from "../../../../domain/services/tests/testUtils";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("LocalStorageInstalledModelCatalog", () => {
  it("persists installed model records and supports filtering", async () => {
    const storage = createStorage();
    const catalog = new LocalStorageInstalledModelCatalog("test-installed-models", storage);

    await catalog.saveInstalled(makeModel("model-1"));
    await catalog.saveInstalled(makeModel("vision-1", { kind: "vision-model" } as never));

    expect((await catalog.listInstalled()).length).toBe(2);
    expect((await catalog.listInstalled({ query: "vision" })).map((model) => model.id)).toEqual(["vision-1"]);
    expect(await catalog.isInstalled("model-1")).toBeTrue();
  });
});
