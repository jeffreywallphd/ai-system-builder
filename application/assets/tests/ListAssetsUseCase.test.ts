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
});
