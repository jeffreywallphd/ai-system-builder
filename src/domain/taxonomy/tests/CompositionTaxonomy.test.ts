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
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });

    expect(descriptor.structuralKind).toBe("composite");
    expect(Object.isFrozen(descriptor)).toBeTrue();
  });

  it("rejects unsupported values", () => {
    expect(() => createCompositionTaxonomyDescriptor({
      structuralKind: "invalid" as never,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    })).toThrow("Taxonomy structural kind must be one of");
  });

  it("validates semantic-role combination constraints deterministically", () => {
    const valid = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });
    expect(assertAllowedCompositionTaxonomyCombination(valid)).toEqual(valid);

    const invalid = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    expect(() => assertAllowedCompositionTaxonomyCombination(invalid)).toThrow("Taxonomy descriptor combination");
  });

  it("normalizes dynamic behavior aliases to conditional", () => {
    const descriptor = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: "dynamic",
    });

    expect(descriptor.behaviorKind).toBe("conditional");
    expect(assertAllowedCompositionTaxonomyCombination(descriptor)).toEqual(descriptor);
  });

  it("supports revised combinations for schema, config-profile, dataset-pipeline, and app-template", () => {
    const schema = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.schema,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const configProfile = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.configProfile,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const datasetPipeline = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.datasetPipeline,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });
    const appTemplate = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.appTemplate,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });

    expect(assertAllowedCompositionTaxonomyCombination(schema)).toEqual(schema);
    expect(assertAllowedCompositionTaxonomyCombination(configProfile)).toEqual(configProfile);
    expect(assertAllowedCompositionTaxonomyCombination(datasetPipeline)).toEqual(datasetPipeline);
    expect(assertAllowedCompositionTaxonomyCombination(appTemplate)).toEqual(appTemplate);
  });

  it("rejects outdated atomic/system taxonomy combinations", () => {
    const descriptor = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    expect(() => assertAllowedCompositionTaxonomyCombination(descriptor)).toThrow("invalid");
  });
});
