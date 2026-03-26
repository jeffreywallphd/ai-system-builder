export const TaxonomyStructuralKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
});

export type TaxonomyStructuralKind = typeof TaxonomyStructuralKinds[keyof typeof TaxonomyStructuralKinds];

export const TaxonomySemanticRoles = Object.freeze({
  model: "model",
  dataset: "dataset",
  tool: "tool",
  promptTemplate: "prompt-template",
  embeddingIndex: "embedding-index",
  workflow: "workflow",
  agent: "agent",
  contextBundle: "context-bundle",
  trainingRecipe: "training-recipe",
  toolChain: "tool-chain",
  system: "system",
});

export type TaxonomySemanticRole = typeof TaxonomySemanticRoles[keyof typeof TaxonomySemanticRoles];

export const TaxonomyBehaviorKinds = Object.freeze({
  none: "none",
  deterministic: "deterministic",
  dynamic: "dynamic",
  iterative: "iterative",
  autonomous: "autonomous",
});

export type TaxonomyBehaviorKind = typeof TaxonomyBehaviorKinds[keyof typeof TaxonomyBehaviorKinds];

export interface CompositionTaxonomyDescriptor {
  readonly structuralKind: TaxonomyStructuralKind;
  readonly semanticRole: TaxonomySemanticRole;
  readonly behaviorKind: TaxonomyBehaviorKind;
}

function assertAllowed<T extends string>(
  value: T,
  allowed: Readonly<Record<string, T>>,
  label: string,
): T {
  if (!Object.values(allowed).includes(value)) {
    throw new Error(`${label} must be one of: ${Object.values(allowed).join(", ")}.`);
  }

  return value;
}

export function createCompositionTaxonomyDescriptor(
  descriptor: CompositionTaxonomyDescriptor,
): CompositionTaxonomyDescriptor {
  return Object.freeze({
    structuralKind: assertAllowed(descriptor.structuralKind, TaxonomyStructuralKinds, "Taxonomy structural kind"),
    semanticRole: assertAllowed(descriptor.semanticRole, TaxonomySemanticRoles, "Taxonomy semantic role"),
    behaviorKind: assertAllowed(descriptor.behaviorKind, TaxonomyBehaviorKinds, "Taxonomy behavior kind"),
  });
}
