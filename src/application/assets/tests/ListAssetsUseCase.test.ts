import { describe, expect, it } from "bun:test";
import { ListAssetsUseCase } from "../ListAssetsUseCase";
import { makeAsset, makeAssetCatalog } from "./testUtils";

describe("ListAssetsUseCase", () => {
  it("lists assets using criteria", async () => {
    const criteriaCalls: unknown[] = [];
    const useCase = new ListAssetsUseCase(
      makeAssetCatalog({ list: async (criteria) => (criteriaCalls.push(criteria), [makeAsset("a")]) })
    );

    const result = await useCase.execute({ criteria: { kinds: ["input"] } });
    expect(result.assets).toHaveLength(1);
    expect(criteriaCalls).toHaveLength(1);
  });

  it("can include canonical lineage summaries without breaking asset catalog listing", async () => {
    const asset = makeAsset("asset-with-lineage");
    const useCase = new ListAssetsUseCase(
      makeAssetCatalog({ list: async () => [asset] }),
      {
        versionRepository: {
          saveVersion: async () => undefined,
          getByVersionId: async () => undefined,
          listVersionsByAssetId: async () => [{ versionId: "v1", versionLabel: "1", parentVersionId: undefined, createdAt: new Date("2026-03-24T00:00:00.000Z") } as any],
        },
        lineageRepository: {
          saveEdge: async () => undefined,
          listEdgesByVersionId: async () => [],
        },
        transformationRepository: {
          saveTransformation: async () => undefined,
          getById: async () => undefined,
          listByVersionId: async () => [],
        },
      },
    );

    const result = await useCase.execute();
    expect(result.assets).toHaveLength(1);
    expect(result.canonicalByAssetId?.[asset.id]?.latestVersionId).toBe("v1");
  });
});
