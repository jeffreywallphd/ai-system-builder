import { describe, expect, it } from "bun:test";
import { SaveAssetUseCase } from "../SaveAssetUseCase";
import { makeAsset, makeAssetCatalog, makeFileStorage } from "./testUtils";

describe("SaveAssetUseCase", () => {
  it("persists content and updates location/metadata", async () => {
    const asset = makeAsset("a1");
    const saved: string[] = [];
    const fileStorage = makeFileStorage({
      exists: async () => false,
      write: async ({ path }) => void saved.push(path),
      stat: async (path) => ({ path, kind: "file", sizeBytes: 42 }),
    });
    const assetCatalog = makeAssetCatalog({ getById: async () => undefined });

    const result = await new SaveAssetUseCase({ assetCatalog, fileStorage }).execute({
      asset,
      content: "abc",
      destination: "/tmp/new.bin",
    });

    expect(saved).toEqual(["/tmp/new.bin"]);
    expect(result.created).toBeTrue();
    expect(result.contentPersisted).toBeTrue();
    expect(result.asset.location.location).toBe("/tmp/new.bin");
    expect(result.asset.technicalMetadata?.sizeBytes).toBe(42);
  });

  it("supports metadata-only save when content persistence is disabled", async () => {
    const savedAssets: string[] = [];
    const assetCatalog = makeAssetCatalog({ save: async (asset) => (savedAssets.push(asset.id), asset) });

    const result = await new SaveAssetUseCase({ assetCatalog, fileStorage: makeFileStorage() }).execute({
      asset: makeAsset("a2"),
      persistContent: false,
    });

    expect(result.contentPersisted).toBeFalse();
    expect(savedAssets).toEqual(["a2"]);
  });

  it("throws when destination already exists and overwrite is false", async () => {
    const useCase = new SaveAssetUseCase({
      assetCatalog: makeAssetCatalog(),
      fileStorage: makeFileStorage({ exists: async () => true }),
    });

    await expect(useCase.execute({ asset: makeAsset("a3"), content: "x" })).rejects.toThrow(
      "already exists"
    );
  });
});
