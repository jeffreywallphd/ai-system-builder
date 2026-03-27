import { describe, expect, it } from "bun:test";
import {
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../CompositionTaxonomy";

describe("Composition taxonomy descriptor", () => {
  it("creates a frozen descriptor with validated kinds", () => {
    const descriptor = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.dynamic,
    });

    expect(descriptor.structuralKind).toBe("composite");
    expect(Object.isFrozen(descriptor)).toBeTrue();
  });

  it("rejects unsupported values", () => {
    expect(() => createCompositionTaxonomyDescriptor({
      structuralKind: "invalid" as never,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.dynamic,
    })).toThrow("Taxonomy structural kind must be one of");
  });

  it("validates semantic-role combination constraints deterministically", () => {
    const valid = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.dynamic,
    });
    expect(assertAllowedCompositionTaxonomyCombination(valid)).toEqual(valid);

    const invalid = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    expect(() => assertAllowedCompositionTaxonomyCombination(invalid)).toThrow("Taxonomy descriptor combination");
  });
});
