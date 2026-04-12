import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { ContextRecipe } from "@application/context/models/ContextRecipe";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalContextRecipeRepository } from "../LocalContextRecipeRepository";

describe("LocalContextRecipeRepository", () => {
  it("saves, loads, lists, and checks existence for persisted context recipes", async () => {
    const rootDirectory = path.join(os.tmpdir(), `ai-loom-studio-context-recipes-${Date.now()}`);
    const repository = new LocalContextRecipeRepository({
      fileStorage: new LocalFileStorage(),
      rootDirectory,
    });

    const contextRecipe = new ContextRecipe({
      id: "company-default",
      name: "Company Default",
      packageReferences: [{ packageId: "pkg-company" }],
      guidance: { responseStyle: "structured", detailLevel: "concise" },
    });

    await repository.save(contextRecipe);

    expect(await repository.exists("company-default")).toBeTrue();
    expect((await repository.load("company-default"))?.guidance?.responseStyle).toBe("structured");
    expect((await repository.list())[0]?.packageReferenceCount).toBe(1);
  });
});

