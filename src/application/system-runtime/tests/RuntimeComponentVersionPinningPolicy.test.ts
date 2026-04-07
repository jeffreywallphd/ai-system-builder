import { describe, expect, it } from "bun:test";
import { requiresPinnedRuntimeComponentVersion } from "../RuntimeComponentVersionPinningPolicy";

describe("RuntimeComponentVersionPinningPolicy", () => {
  it("requires version pins for workflow-like components without versions", () => {
    expect(requiresPinnedRuntimeComponentVersion({
      component: {
        componentKind: "composite",
        assetId: "asset:workflow",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      },
      hasResolvedContract: true,
    })).toBeTrue();
  });

  it("allows unpinned dataset components when contracts are resolvable", () => {
    expect(requiresPinnedRuntimeComponentVersion({
      component: {
        componentKind: "atomic",
        assetId: "asset:dataset:image-reference-input",
        taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
      },
      hasResolvedContract: true,
    })).toBeFalse();
  });

  it("requires version pins when taxonomy/contract cannot be resolved", () => {
    expect(requiresPinnedRuntimeComponentVersion({
      component: {
        componentKind: "atomic",
        assetId: "asset:unknown",
      },
      hasResolvedContract: false,
    })).toBeTrue();
  });
});
