import { describe, expect, it } from "bun:test";
import { ListInstalledModelsUseCase } from "../ListInstalledModelsUseCase";
import { makeModel } from "../../../domain/services/tests/testUtils";
import { makeInstalledModelCatalog } from "./testUtils";
import { CanonicalAssetIdentityService } from "../../assets-system/CanonicalAssetIdentityService";

describe("ListInstalledModelsUseCase", () => {
  it("lists installed models", async () => {
    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] })
    ).execute();

    expect(result.models.map((m) => m.id)).toEqual(["m"]);
  });

  it("returns canonical identity summaries when canonical resolution is configured", async () => {
    const canonicalIdentityService = new CanonicalAssetIdentityService(
      {
        getIdentity: async () => ({
          entityType: "installed-model",
          entityId: "m",
          assetId: "installed-model:m",
          latestVersionId: "asset-version:m:1",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
        upsertIdentity: async () => undefined,
      },
      {
        listVersionsByAssetId: async () => [],
      } as any,
    );

    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] }),
      canonicalIdentityService,
    ).execute();

    expect(result.canonicalByModelId?.m?.preferred).toBeTrue();
    expect(result.canonicalByModelId?.m?.assetId).toBe("installed-model:m");
  });
});
