import { describe, expect, it } from "bun:test";
import { ContextTrimmingService } from "../ContextTrimmingService";
import type { IAssembledContextFragment } from "../models/AssembledContext";

function makeFragment(params: Partial<IAssembledContextFragment> & Pick<IAssembledContextFragment, "id" | "kind" | "content">): IAssembledContextFragment {
  return Object.freeze({
    order: 0,
    assemblyKey: `${params.kind}:${params.id}`,
    precedence: 0,
    provenance: Object.freeze([
      Object.freeze({
        sourceType: "direct" as const,
        fragmentId: params.id,
      }),
    ]),
    ...params,
  });
}

describe("ContextTrimmingService", () => {
  it("preserves trimming order while filtering by visibility and kind", () => {
    const service = new ContextTrimmingService();
    const fragments = [
      makeFragment({ id: "sys", kind: "instructions", content: "Stay factual." }),
      makeFragment({ id: "persona", kind: "persona", content: "Be concise.", metadata: { visibility: "advanced" } }),
      makeFragment({ id: "kb-1", kind: "retrieved-context", content: "Result A", metadata: { source: "kb" } }),
      makeFragment({ id: "fmt", kind: "formatting-constraints", content: "Use bullets." }),
    ];

    const result = service.trim(fragments, {
      visibilityMode: "basic",
      excludeKinds: ["formatting-constraints"],
    });

    expect(result.fragments.map((fragment) => fragment.id)).toEqual(["sys", "kb-1"]);
    expect(result.decisions).toEqual([
      expect.objectContaining({ id: "sys", action: "included" }),
      expect.objectContaining({ id: "persona", action: "excluded-by-visibility" }),
      expect.objectContaining({ id: "kb-1", action: "included" }),
      expect.objectContaining({ id: "fmt", action: "excluded-by-kind" }),
    ]);
  });

  it("supports source-based inclusion and exclusion rules deterministically", () => {
    const service = new ContextTrimmingService();
    const fragments = [
      makeFragment({ id: "kb", kind: "retrieved-context", content: "KB", metadata: { source: "knowledge-base" } }),
      makeFragment({ id: "mem", kind: "memory-snippets", content: "Memory", metadata: { source: "memory-bank" } }),
      makeFragment({ id: "pkg", kind: "examples", content: "Pkg", metadata: { packageAlias: "examples" } }),
    ];

    const result = service.trim(fragments, {
      includeSources: ["knowledge-base", "memory-bank"],
      excludeSources: ["memory-bank"],
    });

    expect(result.fragments.map((fragment) => fragment.id)).toEqual(["kb"]);
    expect(result.decisions).toEqual([
      expect.objectContaining({ id: "kb", action: "included", matchedSources: ["direct", "knowledge-base"] }),
      expect.objectContaining({ id: "mem", action: "excluded-by-source" }),
      expect.objectContaining({ id: "pkg", action: "excluded-by-source" }),
    ]);
  });

  it("treats advanced mode as inclusive while remaining deterministic", () => {
    const service = new ContextTrimmingService();
    const fragments = [
      makeFragment({ id: "a", kind: "instructions", content: "A", metadata: { visibility: "advanced" } }),
      makeFragment({ id: "b", kind: "instructions", content: "B" }),
    ];

    const first = service.trim(fragments, { visibilityMode: "advanced" });
    const second = service.trim(fragments, { visibilityMode: "advanced" });

    expect(first.fragments.map((fragment) => fragment.id)).toEqual(["a", "b"]);
    expect(second).toEqual(first);
  });
});
