export const TaxonomyStructuralKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
});

export type TaxonomyStructuralKind = typeof TaxonomyStructuralKinds[keyof typeof TaxonomyStructuralKinds];

export const TaxonomySemanticRoles = Object.freeze({
  model: "model",
  dataset: "dataset",
  schema: "schema",
  tool: "tool",
  promptTemplate: "prompt-template",
  embeddingIndex: "embedding-index",
  configProfile: "config-profile",
  workflow: "workflow",
  workflowTemplate: "workflow-template",
  agent: "agent",
  contextBundle: "context-bundle",
  datasetPipeline: "dataset-pipeline",
  trainingRecipe: "training-recipe",
  toolChain: "tool-chain",
  appTemplate: "app-template",
  system: "system",
});

export type TaxonomySemanticRole = typeof TaxonomySemanticRoles[keyof typeof TaxonomySemanticRoles];

export const TaxonomyBehaviorKinds = Object.freeze({
  none: "none",
  deterministic: "deterministic",
  conditional: "conditional",
  iterative: "iterative",
  autonomous: "autonomous",
});

export type TaxonomyBehaviorKind = typeof TaxonomyBehaviorKinds[keyof typeof TaxonomyBehaviorKinds];
export type TaxonomyBehaviorKindAlias = "dynamic";

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
  [TaxonomySemanticRoles.schema]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.tool]: Object.freeze([
    [TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.conditional],
  ]),
  [TaxonomySemanticRoles.promptTemplate]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.embeddingIndex]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.configProfile]: Object.freeze([[TaxonomyStructuralKinds.atomic, TaxonomyBehaviorKinds.none]]),
  [TaxonomySemanticRoles.workflow]: Object.freeze([
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.conditional],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.iterative],
  ]),
  [TaxonomySemanticRoles.workflowTemplate]: Object.freeze([
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.conditional],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.iterative],
  ]),
  [TaxonomySemanticRoles.agent]: Object.freeze([[TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.autonomous]]),
  [TaxonomySemanticRoles.contextBundle]: Object.freeze([
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.none],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic],
  ]),
  [TaxonomySemanticRoles.datasetPipeline]: Object.freeze([
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.iterative],
  ]),
  [TaxonomySemanticRoles.trainingRecipe]: Object.freeze([[TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic]]),
  [TaxonomySemanticRoles.toolChain]: Object.freeze([[TaxonomyStructuralKinds.composite, TaxonomyBehaviorKinds.deterministic]]),
  [TaxonomySemanticRoles.appTemplate]: Object.freeze([
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.conditional],
  ]),
  [TaxonomySemanticRoles.system]: Object.freeze([
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.deterministic],
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.conditional],
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.iterative],
    [TaxonomyStructuralKinds.system, TaxonomyBehaviorKinds.autonomous],
  ]),
});

function normalizeBehaviorKind(kind: TaxonomyBehaviorKind | TaxonomyBehaviorKindAlias): TaxonomyBehaviorKind {
  if (kind === "dynamic") {
    return TaxonomyBehaviorKinds.conditional;
  }
  return kind;
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
  descriptor: Omit<CompositionTaxonomyDescriptor, "behaviorKind"> & { readonly behaviorKind: TaxonomyBehaviorKind | TaxonomyBehaviorKindAlias },
): CompositionTaxonomyDescriptor {
  const normalizedBehaviorKind = normalizeBehaviorKind(descriptor.behaviorKind);
  return Object.freeze({
    structuralKind: assertAllowed(descriptor.structuralKind, TaxonomyStructuralKinds, "Taxonomy structural kind"),
    semanticRole: assertAllowed(descriptor.semanticRole, TaxonomySemanticRoles, "Taxonomy semantic role"),
    behaviorKind: assertAllowed(normalizedBehaviorKind, TaxonomyBehaviorKinds, "Taxonomy behavior kind"),
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
