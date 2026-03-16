import { describe, expect, it } from "bun:test";
import { LoadAssetUseCase } from "../LoadAssetUseCase";
import { makeAsset, makeAssetCatalog, makeFileStorage } from "./testUtils";

describe("LoadAssetUseCase", () => {
  it("loads binary content", async () => {
    const asset = makeAsset("bin");
    const useCase = new LoadAssetUseCase({
      assetCatalog: makeAssetCatalog({ getById: async () => asset }),
      fileStorage: makeFileStorage({ exists: async () => true, read: async (path) => ({ path, content: new Uint8Array([1, 2]) }) }),
    });

    const result = await useCase.execute({ assetId: " bin ", loadContent: true });
    expect(result.content).toEqual(new Uint8Array([1, 2]));
  });

  it("loads text content when requested", async () => {
    const asset = makeAsset("txt");
    const useCase = new LoadAssetUseCase({
      assetCatalog: makeAssetCatalog({ getById: async () => asset }),
      fileStorage: makeFileStorage({ exists: async () => true, readText: async () => "hello" }),
    });

    const result = await useCase.execute({ assetId: "txt", loadContent: true, asText: true, encoding: "utf8" });
    expect(result.content).toBe("hello");
  });

  it("marks missing assets when content file does not exist", async () => {
    const saved: string[] = [];
    const asset = makeAsset("missing");
    const useCase = new LoadAssetUseCase({
      assetCatalog: makeAssetCatalog({
        getById: async () => asset,
        save: async (updated) => (saved.push(updated.status), updated),
      }),
      fileStorage: makeFileStorage({ exists: async () => false }),
    });

    await expect(useCase.execute({ assetId: "missing", loadContent: true })).rejects.toThrow("missing");
    expect(saved).toEqual(["missing"]);
  });
});
