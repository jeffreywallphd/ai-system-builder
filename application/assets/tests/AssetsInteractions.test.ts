import { describe, expect, it } from "bun:test";
import { SaveAssetUseCase } from "../SaveAssetUseCase";
import { LoadAssetUseCase } from "../LoadAssetUseCase";
import { DeleteAssetUseCase } from "../DeleteAssetUseCase";
import { makeAsset, makeAssetCatalog, makeFileStorage } from "./testUtils";

describe("application/assets interactions", () => {
  it("save -> load -> delete flow works against shared in-memory adapters", async () => {
    const state = new Map<string, ReturnType<typeof makeAsset>>();
    const asset = makeAsset("flow");

    const catalog = makeAssetCatalog({
      getById: async (id) => state.get(id),
      save: async (next) => (state.set(next.id, next as ReturnType<typeof makeAsset>), next),
      remove: async (id) => state.delete(id),
      list: async () => [...state.values()],
    });

    const fileStorage = makeFileStorage({ exists: async () => true, readText: async () => "payload" });

    await new SaveAssetUseCase({ assetCatalog: catalog, fileStorage }).execute({ asset, persistContent: false });
    const loaded = await new LoadAssetUseCase({ assetCatalog: catalog, fileStorage }).execute({ assetId: "flow", loadContent: true, asText: true });
    const deleted = await new DeleteAssetUseCase({ assetCatalog: catalog, fileStorage }).execute({ assetId: "flow", hardDelete: true });

    expect(loaded.asset.id).toBe("flow");
    expect(loaded.content).toBe("payload");
    expect(deleted.removed).toBeTrue();
  });
});
