import { describe, expect, it } from "bun:test";
import { ListInstalledModelsUseCase } from "../ListInstalledModelsUseCase";
import { makeModel } from "../../../domain/services/tests/testUtils";
import { makeInstalledModelCatalog } from "./testUtils";

describe("ListInstalledModelsUseCase", () => {
  it("lists installed models", async () => {
    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] })
    ).execute();

    expect(result.models.map((m) => m.id)).toEqual(["m"]);
  });
});
