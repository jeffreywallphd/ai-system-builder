import { describe, expect, it } from "bun:test";
import { ContextBudgetingService } from "../ContextBudgetingService";
import type { IAssembledContextFragment } from "../models/AssembledContext";

function makeFragment(params: Partial<IAssembledContextFragment> & Pick<IAssembledContextFragment, "id" | "kind" | "content">): IAssembledContextFragment {
  return Object.freeze({
    order: 0,
    assemblyKey: `${params.kind}:${params.id}`,
    precedence: 0,
    provenance: Object.freeze([Object.freeze({ sourceType: "direct" as const, fragmentId: params.id })]),
    ...params,
  });
}

describe("ContextBudgetingService", () => {
  it("enforces character budgets in fragment order and trims the first overflowing fragment", () => {
    const service = new ContextBudgetingService();
    const fragments = [
      makeFragment({ id: "a", kind: "instructions", content: "Alpha" }),
      makeFragment({ id: "b", kind: "retrieved-context", content: "BetaBeta" }),
      makeFragment({ id: "c", kind: "examples", content: "Gamma" }),
    ];

    const result = service.enforceBudget(fragments, {
      maxCharacters: 12,
      separator: "\n",
      trimPartialFragments: true,
    });

    expect(result.fragments.map((fragment) => [fragment.id, fragment.content])).toEqual([
      ["a", "Alpha"],
      ["b", "BetaB…"],
    ]);
    expect(result.promptText).toBe("Alpha\nBetaB…");
    expect(result.decisions).toEqual([
      expect.objectContaining({ id: "a", action: "included" }),
      expect.objectContaining({ id: "b", action: "trimmed-to-fit" }),
      expect.objectContaining({ id: "c", action: "excluded-over-budget" }),
    ]);
  });

  it("enforces token budgets with approximate estimation", () => {
    const service = new ContextBudgetingService();
    const fragments = [
      makeFragment({ id: "sys", kind: "instructions", content: "1234" }),
      makeFragment({ id: "ctx", kind: "retrieved-context", content: "56789012" }),
    ];

    const result = service.enforceBudget(fragments, {
      maxTokens: 2,
      approximateCharactersPerToken: 4,
      separator: "",
    });

    expect(result.includedTokenCount).toBeLessThanOrEqual(3);
    expect(result.fragments.map((fragment) => fragment.content)).toEqual(["1234", "567…"]);
    expect(result.wasTrimmed).toBeTrue();
  });

  it("returns deterministic outputs for repeated budgeting runs", () => {
    const service = new ContextBudgetingService();
    const fragments = [
      makeFragment({ id: "a", kind: "instructions", content: "AlphaAlpha" }),
      makeFragment({ id: "b", kind: "retrieved-context", content: "BetaBeta" }),
    ];

    const budget = { maxCharacters: 10, separator: "" };
    const first = service.enforceBudget(fragments, budget);
    const second = service.enforceBudget(fragments, budget);

    expect(first).toEqual(second);
  });
});
