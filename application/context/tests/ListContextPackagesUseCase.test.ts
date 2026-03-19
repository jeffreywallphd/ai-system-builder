import { describe, expect, it } from "bun:test";
import { ListContextPackagesUseCase } from "../ListContextPackagesUseCase";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("ListContextPackagesUseCase", () => {
  it("lists reusable context package summaries", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "persona-core",
        name: "Persona Core",
        tags: ["agent", "shared"],
        fragments: [{ id: "persona", kind: "persona", content: "You are methodical.", order: 1 }],
      }),
      new ContextPackage({
        id: "tool-formatting",
        name: "Tool Formatting",
        tags: ["tools"],
        fragments: [{ id: "format", kind: "formatting-constraints", content: "Return JSON.", order: 1 }],
      }),
    ]);

    const result = await new ListContextPackagesUseCase(repository).execute({
      criteria: { tags: ["shared", "missing"] },
    });

    expect(result.contextPackages).toHaveLength(1);
    expect(result.contextPackages[0]).toMatchObject({
      id: "persona-core",
      name: "Persona Core",
      fragmentCount: 1,
    });
  });

  it("supports query-based listing for prompt and tool reuse", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "retrieval-pack",
        name: "Retrieval Notes",
        description: "Vector store notes",
        fragments: [{ id: "chunk", kind: "retrieved-context", content: "Chunk", order: 0 }],
      }),
      new ContextPackage({
        id: "memory-pack",
        name: "Memory Snippets",
        fragments: [{ id: "memory", kind: "memory-snippets", content: "Recent tool decisions", order: 0 }],
      }),
    ]);

    const result = await new ListContextPackagesUseCase(repository).execute({
      criteria: { query: "vector" },
    });

    expect(result.contextPackages.map((contextPackage) => contextPackage.id)).toEqual([
      "retrieval-pack",
    ]);
  });
});
