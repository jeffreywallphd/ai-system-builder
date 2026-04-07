import { describe, expect, it } from "bun:test";
import { DeleteAssetUseCase } from "../DeleteAssetUseCase";
import { makeAsset, makeAssetCatalog, makeFileStorage } from "./testUtils";

describe("DeleteAssetUseCase", () => {
  it("returns not removed for unknown asset", async () => {
    const result = await new DeleteAssetUseCase({
      assetCatalog: makeAssetCatalog({ getById: async () => undefined }),
      fileStorage: makeFileStorage(),
    }).execute({ assetId: "x" });

    expect(result.removed).toBeFalse();
  });

  it("hard deletes and removes content", async () => {
    const deleted: string[] = [];
    const useCase = new DeleteAssetUseCase({
      assetCatalog: makeAssetCatalog({ getById: async () => makeAsset("h1"), remove: async () => true }),
      fileStorage: makeFileStorage({ exists: async () => true, delete: async (path) => void deleted.push(path) }),
    });

    const result = await useCase.execute({ assetId: "h1", hardDelete: true, deleteContent: true });
    expect(result.removed).toBeTrue();
    expect(result.deletedContent).toBeTrue();
    expect(deleted[0]).toContain("h1");
  });

  it("soft deletes by saving an asset with deleted status", async () => {
    const statuses: string[] = [];
    const useCase = new DeleteAssetUseCase({
      assetCatalog: makeAssetCatalog({
        getById: async () => makeAsset("s1"),
        save: async (asset) => (statuses.push(asset.status), asset),
      }),
      fileStorage: makeFileStorage(),
    });

    const result = await useCase.execute({ assetId: "s1" });
    expect(result.asset?.status).toBe("deleted");
    expect(statuses).toEqual(["deleted"]);
  });
});
