import { describe, expect, it } from "bun:test";
import {
  UxAssetPresentationLabelResolver,
  UxStudioEntryLabelResolver,
  UxTaxonomySuppressionPolicy,
  UxTaxonomyVisibilityRules,
} from "../UxTaxonomySuppression";

describe("UxTaxonomySuppression", () => {
  it("keeps taxonomy suppressed on primary surfaces while preserving taxonomy filter visibility", () => {
    const policy = new UxTaxonomySuppressionPolicy();

    expect(policy.resolvePresentationMode(UxTaxonomyVisibilityRules.primaryNavigation)).toBe("intent-primary");
    expect(policy.resolvePresentationMode(UxTaxonomyVisibilityRules.taxonomyFilters)).toBe("taxonomy-primary");
  });

  it("resolves intent-friendly labels for assets and studio entry actions", () => {
    const assetResolver = new UxAssetPresentationLabelResolver();
    const studioResolver = new UxStudioEntryLabelResolver();

    const taxonomy = { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } as const;
    expect(assetResolver.resolveAssetLabel(taxonomy, UxTaxonomyVisibilityRules.registryPrimary)).toBe("AI capability");
    expect(assetResolver.resolveAssetLabel(taxonomy, UxTaxonomyVisibilityRules.taxonomyFilters)).toBe("model");
    expect(studioResolver.resolveOpenLabel(taxonomy)).toBe("Open AI capability workspace");
  });
});
