import { describe, expect, it } from "bun:test";
import { InspectContextAssemblyUseCase } from "../InspectContextAssemblyUseCase";
import { ContextPackage } from "../models/ContextPackage";

describe("InspectContextAssemblyUseCase", () => {
  it("surfaces provenance for included fragments and keeps source ordering visible", () => {
    const useCase = new InspectContextAssemblyUseCase();

    const result = useCase.execute({
      assembly: {
        packages: [
          {
            alias: "memory-bank",
            order: 2,
            contextPackage: new ContextPackage({
              id: "ctx-memory",
              name: "Memory Bank",
              fragments: [
                {
                  id: "memory-1",
                  kind: "memory-snippets",
                  title: "Preference",
                  content: "Prefers tables.",
                  order: 2,
                  metadata: { precedence: 2 },
                },
              ],
            }),
          },
        ],
        fragments: [
          {
            id: "sys",
            kind: "instructions",
            content: "Answer clearly.",
            order: 1,
            metadata: { precedence: 5 },
          },
        ],
      },
    });

    expect(result.entries.map((entry) => entry.fragmentId)).toEqual(["sys", "memory-1"]);
    expect(result.entries[1]).toMatchObject({
      fragmentId: "memory-1",
      status: "included",
      stage: "budget",
      matchedSources: ["ctx-memory", "memory bank", "memory-bank", "package"],
      provenance: [
        expect.objectContaining({
          sourceType: "package",
          packageId: "ctx-memory",
          packageAlias: "memory-bank",
          packageName: "Memory Bank",
          fragmentId: "memory-1",
        }),
      ],
    });
  });

  it("reports trimmed fragments and keeps the final assembled prompt text", () => {
    const useCase = new InspectContextAssemblyUseCase();

    const result = useCase.execute({
      assembly: {
        fragments: [
          { id: "a", kind: "instructions", content: "Alpha", order: 1 },
          { id: "b", kind: "retrieved-context", content: "BetaBeta", order: 2 },
        ],
      },
      budget: {
        maxCharacters: 8,
        separator: "\n\n",
      },
    });

    expect(result.finalPromptText).toBe("Alpha\n\nB");
    expect(result.entries).toContainEqual(
      expect.objectContaining({
        fragmentId: "b",
        status: "trimmed",
        stage: "budget",
        reason: "trimmed-to-fit",
      })
    );
  });

  it("tracks fragments excluded during trimming separately from assembly exclusions", () => {
    const useCase = new InspectContextAssemblyUseCase();

    const result = useCase.execute({
      assembly: {
        fragments: [
          { id: "sys", kind: "instructions", content: "Stay factual.", order: 1 },
          {
            id: "persona",
            kind: "persona",
            content: "Be concise.",
            order: 2,
            metadata: { visibility: "advanced", source: "author" },
          },
          { id: "fmt", kind: "formatting-constraints", content: "Use bullets.", order: 3 },
        ],
        excludeKinds: ["formatting-constraints"],
      },
      trimmingPolicy: {
        visibilityMode: "basic",
      },
    });

    expect(result.entries).toContainEqual(
      expect.objectContaining({
        fragmentId: "persona",
        status: "excluded",
        stage: "trimming",
        reason: "excluded-by-visibility",
      })
    );
    expect(result.entries).toContainEqual(
      expect.objectContaining({
        fragmentId: "fmt",
        status: "excluded",
        stage: "assembly",
        reason: "excluded-by-kind",
      })
    );
  });

  it("preserves dynamic-source provenance across inspection, trimming, and budgeting", () => {
    const useCase = new InspectContextAssemblyUseCase();

    const result = useCase.execute({
      assembly: {
        dynamicSources: [
          {
            sourceType: "retrieved",
            id: "retrieval",
            label: "Knowledge Search",
            documents: [{ id: "doc-1", text: "Alpha knowledge." }],
          },
          {
            sourceType: "memory",
            id: "memory",
            messages: [{ role: "assistant", content: "Earlier reply." }],
          },
        ],
      },
      budget: {
        maxCharacters: 16,
        separator: "\n\n",
      },
    });

    expect(result.entries).toContainEqual(
      expect.objectContaining({
        fragmentId: "doc-1",
        matchedSources: ["dynamic", "knowledge search", "retrieval", "retrieved"],
      })
    );
    expect(result.entries).toContainEqual(
      expect.objectContaining({
        fragmentId: "memory:message:1",
        stage: "budget",
        reason: "excluded-over-budget",
        provenance: [expect.objectContaining({ dynamicSourceType: "memory" })],
      })
    );
  });

});
