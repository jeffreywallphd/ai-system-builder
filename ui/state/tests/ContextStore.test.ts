import { describe, expect, it } from "bun:test";
import { ContextStore } from "../ContextStore";
import { ContextService } from "../../services/ContextService";
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

function createStore(): ContextStore {
  const repository = new InMemoryContextPackageRepository();
  const recipeRepository = new InMemoryContextRecipeRepository();
  return new ContextStore(
    new ContextService({
      createContextPackageUseCase: new CreateContextPackageUseCase({
        contextPackageRepository: repository,
        createId: () => "ctx-store",
      }),
      createContextRecipeUseCase: new CreateContextRecipeUseCase({
        contextRecipeRepository: recipeRepository,
      }),
      updateContextPackageUseCase: new UpdateContextPackageUseCase({
        contextPackageRepository: repository,
        now: () => new Date("2026-03-19T12:00:00.000Z"),
      }),
      deleteContextPackageUseCase: new DeleteContextPackageUseCase(repository),
      listContextPackagesUseCase: new ListContextPackagesUseCase(repository),
      listContextRecipesUseCase: new ListContextRecipesUseCase(recipeRepository),
      loadContextPackageUseCase: new LoadContextPackageUseCase(repository),
      loadContextRecipeUseCase: new LoadContextRecipeUseCase(recipeRepository),
      searchContextPackagesUseCase: new SearchContextPackagesUseCase(repository),
    }),
  );
}

describe("ContextStore", () => {
  it("tracks create, search, update, selection, delete flows, and recipe summaries", async () => {
    const store = createStore();
    await store.initialize();
    expect(store.getState().recipes).toEqual([]);

    await store.createPackage({
      name: "Store Package",
      description: "Author package",
      tags: ["support"],
      fragments: [
        { id: "b", kind: "examples", content: "Example", order: 20 },
        { id: "a", kind: "instructions", content: "Instruction", order: 0 },
      ],
    });
    expect(store.getState().packages).toHaveLength(1);
    expect(store.getState().selectedPackage?.fragments.map((fragment) => fragment.id)).toEqual(["a", "b"]);

    await store.search({ query: "author", tags: ["support"] });
    expect(store.getState().searchQuery).toBe("author");
    expect(store.getState().packages[0]?.id).toBe("ctx-store");

    await store.updatePackage({
      contextPackageId: "ctx-store",
      name: "Store Package v2",
      description: "Author package updated",
      tags: ["support", "shared"],
      fragments: [{ id: "a", kind: "instructions", content: "Updated", order: 1 }],
    });
    expect(store.getState().selectedPackage?.name).toBe("Store Package v2");

    await store.clearSearch();
    expect(store.getState().searchQuery).toBe("");

    await store.deletePackage("ctx-store");
    expect(store.getState().packages).toHaveLength(0);
    expect(store.getState().selectedPackage).toBeUndefined();
  });
});
