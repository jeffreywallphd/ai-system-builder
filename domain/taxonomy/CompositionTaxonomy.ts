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

const allowedTaxonomyCombinationsBySemanticRole: Readonly<Record<TaxonomySemanticRole, ReadonlyArray<readonly [
  TaxonomyStructuralKind,
  TaxonomyBehaviorKind,
]>>> = Object.freeze({
  [TaxonomySemanticRoles.model]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.dataset]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.tool]: Object.freeze([
    [TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.dynamic],
  ]),
  [TaxonomySemanticRoles.promptTemplate]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.embeddingIndex]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.workflow]: Object.freeze([
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.dynamic],
  ]),
  [TaxonomySemanticRoles.agent]: Object.freeze([[TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.autonomous]]),
  [TaxonomySemanticRoles.contextBundle]: Object.freeze([
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.none],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic],
  ]),
  [TaxonomySemanticRoles.trainingRecipe]: Object.freeze([[TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic]]),
  [TaxonomySemanticRoles.toolChain]: Object.freeze([[TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic]]),
  [TaxonomySemanticRoles.system]: Object.freeze([
    [TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none],
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.none],
  ]),
});

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

export function assertAllowedCompositionTaxonomyCombination(
  descriptor: CompositionTaxonomyDescriptor,
  label: string = "Taxonomy descriptor",
): CompositionTaxonomyDescriptor {
  const allowed = allowedTaxonomyCombinationsBySemanticRole[descriptor.semanticRole] ?? [];
  const isAllowed = allowed.some(([structuralKind, behaviorKind]) =>
    descriptor.structuralKind === structuralKind && descriptor.behaviorKind === behaviorKind
  );
  if (!isAllowed) {
    const allowedPairs = allowed.map(([structuralKind, behaviorKind]) => `${structuralKind}/${behaviorKind}`).join(", ");
    throw new Error(
      `${label} combination '${descriptor.structuralKind}/${descriptor.semanticRole}/${descriptor.behaviorKind}' is invalid. ` +
      `Allowed combinations for semantic role '${descriptor.semanticRole}': ${allowedPairs}.`,
    );
  }

  return descriptor;
}
