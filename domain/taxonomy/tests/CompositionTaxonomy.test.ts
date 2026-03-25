import { describe, expect, it } from "bun:test";
import {
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
});
