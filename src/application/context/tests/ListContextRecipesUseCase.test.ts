import { describe, expect, it } from "bun:test";
import { ListContextRecipesUseCase } from "../ListContextRecipesUseCase";
import { ContextRecipe } from "../models/ContextRecipe";
import { InMemoryContextRecipeRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextRecipeRepository";

describe("ListContextRecipesUseCase", () => {
  it("lists reusable context recipe summaries", async () => {
    const repository = new InMemoryContextRecipeRepository([
      new ContextRecipe({
        id: "company-default",
        name: "Company Default",
        tags: ["knowledge", "response"],
        packageReferences: [{ packageId: "pkg-company" }],
      }),
      new ContextRecipe({
        id: "strict-json",
        name: "Strict JSON",
        tags: ["formatting"],
        packageReferences: [{ packageId: "pkg-json" }],
      }),
    ]);

    const result = await new ListContextRecipesUseCase(repository).execute({
      criteria: { tags: ["knowledge"] },
    });

    expect(result.contextRecipes).toHaveLength(1);
    expect(result.contextRecipes[0]).toMatchObject({
      id: "company-default",
      packageReferenceCount: 1,
    });
  });

  it("supports query-based listing for preset discovery", async () => {
    const repository = new InMemoryContextRecipeRepository([
      new ContextRecipe({
        id: "concise-brief",
        name: "Concise Brief",
        description: "Executive summary style",
      }),
      new ContextRecipe({
        id: "deep-analysis",
        name: "Detailed Analysis",
        description: "Long-form research output",
      }),
    ]);

    const result = await new ListContextRecipesUseCase(repository).execute({
      criteria: { query: "executive" },
    });

    expect(result.contextRecipes.map((recipe) => recipe.id)).toEqual(["concise-brief"]);
  });
});
