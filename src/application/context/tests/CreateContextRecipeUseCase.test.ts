import { describe, expect, it } from "bun:test";
import { CreateContextRecipeUseCase } from "../CreateContextRecipeUseCase";
import { InMemoryContextRecipeRepository } from "@infrastructure/mocks/repositories/InMemoryContextRecipeRepository";

describe("CreateContextRecipeUseCase", () => {
  it("derives a stable deterministic recipe id when one is not provided", async () => {
    const repository = new InMemoryContextRecipeRepository();
    const useCase = new CreateContextRecipeUseCase({
      contextRecipeRepository: repository,
    });

    const first = await useCase.execute({
      name: "Company Answer Style",
      packageReferences: [{ packageId: "pkg-style" }],
    });
    const second = await useCase.execute({
      name: " Company Answer Style ",
      packageReferences: [{ packageId: "pkg-policy" }],
    });

    expect(first.contextRecipe.id).toBe("company-answer-style");
    expect(first.created).toBeTrue();
    expect(second.contextRecipe.id).toBe("company-answer-style");
    expect(second.created).toBeFalse();
  });

  it("stores recipe guidance and package references for reuse", async () => {
    const repository = new InMemoryContextRecipeRepository();
    const useCase = new CreateContextRecipeUseCase({
      contextRecipeRepository: repository,
    });

    const result = await useCase.execute({
      id: "exec-profile",
      name: "Executive Profile",
      packageReferences: [
        { packageId: "pkg-style", alias: "Style" },
        { packageId: "pkg-company", alias: "Company Knowledge" },
      ],
      budgetingDefaults: { maxTokens: 400 },
      guidance: {
        responseStyle: "structured",
        detailLevel: "concise",
        strictStructuredOutput: true,
      },
    });

    expect(result.contextRecipe.packageReferences.map((reference) => reference.packageId)).toEqual([
      "pkg-style",
      "pkg-company",
    ]);
    expect(result.contextRecipe.budgetingDefaults?.maxTokens).toBe(400);
    expect(result.contextRecipe.guidance?.strictStructuredOutput).toBeTrue();
  });
});

