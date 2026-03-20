import { describe, expect, it } from "bun:test";
import { ContextService } from "../ContextService";
import { CreateContextPackageUseCase } from "../../../application/context/CreateContextPackageUseCase";
import { CreateContextRecipeUseCase } from "../../../application/context/CreateContextRecipeUseCase";
import { UpdateContextPackageUseCase } from "../../../application/context/UpdateContextPackageUseCase";
import { DeleteContextPackageUseCase } from "../../../application/context/DeleteContextPackageUseCase";
import { ListContextPackagesUseCase } from "../../../application/context/ListContextPackagesUseCase";
import { ListContextRecipesUseCase } from "../../../application/context/ListContextRecipesUseCase";
import { LoadContextPackageUseCase } from "../../../application/context/LoadContextPackageUseCase";
import { LoadContextRecipeUseCase } from "../../../application/context/LoadContextRecipeUseCase";
import { SearchContextPackagesUseCase } from "../../../application/context/SearchContextPackagesUseCase";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { InMemoryContextRecipeRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextRecipeRepository";

describe("ContextService", () => {
  it("wraps context package and recipe use cases", async () => {
    const repository = new InMemoryContextPackageRepository();
    const recipeRepository = new InMemoryContextRecipeRepository();
    const service = new ContextService({
      createContextPackageUseCase: new CreateContextPackageUseCase({
        contextPackageRepository: repository,
        createId: () => "ctx-service",
      }),
      createContextRecipeUseCase: new CreateContextRecipeUseCase({
        contextRecipeRepository: recipeRepository,
      }),
      updateContextPackageUseCase: new UpdateContextPackageUseCase({
        contextPackageRepository: repository,
        now: () => new Date("2026-03-19T00:00:00.000Z"),
      }),
      deleteContextPackageUseCase: new DeleteContextPackageUseCase(repository),
      listContextPackagesUseCase: new ListContextPackagesUseCase(repository),
      listContextRecipesUseCase: new ListContextRecipesUseCase(recipeRepository),
      loadContextPackageUseCase: new LoadContextPackageUseCase(repository),
      loadContextRecipeUseCase: new LoadContextRecipeUseCase(recipeRepository),
      searchContextPackagesUseCase: new SearchContextPackagesUseCase(repository),
    });

    const created = await service.createContextPackage({
      name: "Service Package",
      description: "For authors",
      tags: ["authoring"],
      fragments: [{ id: "instructions", kind: "instructions", content: "Alpha", order: 1 }],
    });
    await service.createContextRecipe({
      name: "Company Default",
      description: "Preset for standard company answers",
      packageReferences: [{ packageId: created.contextPackage.id }],
    });
    const updated = await service.updateContextPackage({
      contextPackageId: created.contextPackage.id,
      name: "Service Package v2",
      description: "Updated for authors",
      tags: ["authoring", "shared"],
      fragments: [{ id: "instructions", kind: "instructions", content: "Beta", order: 0 }],
    });
    const searched = await service.searchContextPackages({ query: "updated" });
    const loaded = await service.loadContextPackage(updated.contextPackage.id);
    const listed = await service.listContextPackages();
    const recipes = await service.listContextRecipes();
    const loadedRecipe = await service.loadContextRecipe("company-default");
    const deleted = await service.deleteContextPackage(updated.contextPackage.id);

    expect(searched.contextPackages[0]?.id).toBe("ctx-service");
    expect(loaded.contextPackage?.name).toBe("Service Package v2");
    expect(listed.contextPackages).toHaveLength(1);
    expect(recipes.contextRecipes[0]?.id).toBe("company-default");
    expect(loadedRecipe.contextRecipe?.packageReferences[0]?.packageId).toBe("ctx-service");
    expect(deleted.deleted).toBe(true);
  });
});
