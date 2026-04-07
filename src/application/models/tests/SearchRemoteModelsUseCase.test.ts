import { describe, expect, it } from "bun:test";
import { SearchRemoteModelsUseCase } from "../SearchRemoteModelsUseCase";
import { makeModel } from "@domain/services/tests/testUtils";
import { makeRemoteModelCatalog } from "./testUtils";

describe("SearchRemoteModelsUseCase", () => {
  it("returns search results and cursor", async () => {
    const useCase = new SearchRemoteModelsUseCase(
      makeRemoteModelCatalog({ search: async () => ({ items: [{ provider: "hf", model: makeModel("r") }], nextCursor: "n" }) })
    );

    const result = await useCase.execute({ criteria: { query: "r" } });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("n");
  });
});

