import { describe, expect, it } from "bun:test";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../ports/interfaces/IFileStorage";
import { makeAssetCatalog, makeFileStorage } from "./testUtils";

describe("application/assets interface contracts", () => {
  it("test doubles satisfy required port contracts", async () => {
    const catalog: IAssetCatalog = makeAssetCatalog();
    const storage: IFileStorage = makeFileStorage();

    expect(await catalog.list()).toEqual([]);
    expect(await storage.exists("/tmp/x")).toBeFalse();
  });
});
