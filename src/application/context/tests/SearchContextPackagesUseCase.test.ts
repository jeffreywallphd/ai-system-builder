import { describe, expect, it } from "bun:test";
import { SearchContextPackagesUseCase } from "../SearchContextPackagesUseCase";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("SearchContextPackagesUseCase", () => {
  it("searches by package name, description, and tags", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "persona-bank",
        name: "Persona Bank",
        description: "Reusable support personas.",
        tags: ["persona", "support"],
        fragments: [{ id: "persona", kind: "persona", content: "Helpful", order: 0 }],
      }),
      new ContextPackage({
        id: "format-rules",
        name: "Formatting Rules",
        description: "Response formatting constraints.",
        tags: ["formatting"],
        fragments: [{ id: "format", kind: "formatting-constraints", content: "Bullets", order: 0 }],
      }),
    ]);

    const result = await new SearchContextPackagesUseCase(repository).execute({
      query: "support",
      tags: ["persona"],
      limit: 10,
    });

    expect(result.criteria.query).toBe("support");
    expect(result.contextPackages.map((contextPackage) => contextPackage.id)).toEqual(["persona-bank"]);
  });

  it("bounds the requested limit", async () => {
    const repository = new InMemoryContextPackageRepository(
      Array.from({ length: 80 }, (_, index) =>
        new ContextPackage({
          id: `ctx-${index}`,
          name: `Context ${index}`,
          description: "Shared package",
          tags: ["shared"],
          fragments: [{ id: `fragment-${index}`, kind: "instructions", content: "Alpha", order: index }],
        }),
      ),
    );

    const result = await new SearchContextPackagesUseCase(repository).execute({
      query: "Context",
      limit: 500,
    });

    expect(result.criteria.limit).toBe(50);
    expect(result.contextPackages).toHaveLength(50);
  });
});
