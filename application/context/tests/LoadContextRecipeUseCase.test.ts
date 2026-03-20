import { describe, expect, it } from "bun:test";
import { LoadContextRecipeUseCase } from "../LoadContextRecipeUseCase";
import { ContextRecipe } from "../models/ContextRecipe";
import { InMemoryContextRecipeRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextRecipeRepository";

describe("LoadContextRecipeUseCase", () => {
  it("loads a reusable recipe with guidance intact", async () => {
    const repository = new InMemoryContextRecipeRepository([
      new ContextRecipe({
        id: "structured-qa",
        name: "Structured QA",
        packageReferences: [{ packageId: "pkg-knowledge" }],
        guidance: {
          responseStyle: "structured",
          detailLevel: "balanced",
          formattingInstructions: "Use markdown headings.",
        },
      }),
    ]);

    const result = await new LoadContextRecipeUseCase(repository).execute({
      contextRecipeId: " structured-qa ",
    });

    expect(result.contextRecipe?.id).toBe("structured-qa");
    expect(result.contextRecipe?.guidance?.formattingInstructions).toBe("Use markdown headings.");
  });

  it("returns undefined when not found and throwIfNotFound is false", async () => {
    const result = await new LoadContextRecipeUseCase(new InMemoryContextRecipeRepository()).execute({
      contextRecipeId: "missing",
      throwIfNotFound: false,
    });

    expect(result.contextRecipe).toBeUndefined();
  });
});
