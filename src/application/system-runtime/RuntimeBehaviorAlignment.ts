import type { Agent } from "@domain/agents/Agent";
import {
  assertAllowedCompositionTaxonomyCombination,
  type CompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  type TaxonomyBehaviorKind,
} from "@domain/taxonomy/CompositionTaxonomy";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { ICompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";

export const RuntimeExecutionPatterns = Object.freeze({
  fixed: "fixed",
  branchCapable: "branch-capable",
  loopCapable: "loop-capable",
  plannerCapable: "planner-capable",
});

export type RuntimeExecutionPattern = typeof RuntimeExecutionPatterns[keyof typeof RuntimeExecutionPatterns];

export interface RuntimeBehaviorProfile {
  readonly behaviorKind: Exclude<TaxonomyBehaviorKind, "none">;
  readonly executionPattern: RuntimeExecutionPattern;
  readonly supportsBranching: boolean;
  readonly supportsIteration: boolean;
  readonly supportsPlanning: boolean;
}

const runtimeBehaviorProfileByBehaviorKind: Readonly<Record<Exclude<TaxonomyBehaviorKind, "none">, RuntimeBehaviorProfile>> = Object.freeze({
  [TaxonomyBehaviorKinds.deterministic]: Object.freeze({
    behaviorKind: TaxonomyBehaviorKinds.deterministic,
    executionPattern: RuntimeExecutionPatterns.fixed,
    supportsBranching: false,
    supportsIteration: false,
    supportsPlanning: false,
  }),
  [TaxonomyBehaviorKinds.conditional]: Object.freeze({
    behaviorKind: TaxonomyBehaviorKinds.conditional,
    executionPattern: RuntimeExecutionPatterns.branchCapable,
    supportsBranching: true,
    supportsIteration: false,
    supportsPlanning: false,
  }),
  [TaxonomyBehaviorKinds.iterative]: Object.freeze({
    behaviorKind: TaxonomyBehaviorKinds.iterative,
    executionPattern: RuntimeExecutionPatterns.loopCapable,
    supportsBranching: true,
    supportsIteration: true,
    supportsPlanning: false,
  }),
  [TaxonomyBehaviorKinds.autonomous]: Object.freeze({
    behaviorKind: TaxonomyBehaviorKinds.autonomous,
    executionPattern: RuntimeExecutionPatterns.plannerCapable,
    supportsBranching: true,
    supportsIteration: true,
    supportsPlanning: true,
  }),
});

export function resolveRuntimeBehaviorForTaxonomy(
  taxonomy: CompositionTaxonomyDescriptor,
): RuntimeBehaviorProfile | undefined {
  assertAllowedCompositionTaxonomyCombination(taxonomy, "Runtime behavior taxonomy");

  if (taxonomy.behaviorKind === TaxonomyBehaviorKinds.none) {
    return undefined;
  }

  return runtimeBehaviorProfileByBehaviorKind[taxonomy.behaviorKind];
}

export function classifyExecutableBehavior(
  taxonomy: CompositionTaxonomyDescriptor,
): RuntimeBehaviorProfile {
  const profile = resolveRuntimeBehaviorForTaxonomy(taxonomy);
  if (!profile) {
    throw new Error(
      `Taxonomy '${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}' is non-executable for runtime behavior mapping.`,
    );
  }

  return profile;
}

export class RuntimeBehaviorAlignmentService {
  public constructor(
    private readonly taxonomyClassifier: Pick<ICompositionTaxonomyClassifier, "classifyWorkflow" | "classifyAgent" | "classifySystemAsset">,
  ) {}

  public resolveWorkflowRuntimeBehavior(
    workflow: IWorkflow,
    behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative"> = TaxonomyBehaviorKinds.deterministic,
  ): RuntimeBehaviorProfile {
    const taxonomy = this.taxonomyClassifier.classifyWorkflow(workflow, behaviorKind);
    return classifyExecutableBehavior(taxonomy);
  }

  public resolveAgentRuntimeBehavior(agent: Agent): RuntimeBehaviorProfile {
    const taxonomy = this.taxonomyClassifier.classifyAgent(agent);
    return classifyExecutableBehavior(taxonomy);
  }

  public resolveSystemRuntimeBehavior(
    semanticRole: Extract<CompositionTaxonomyDescriptor["semanticRole"], "system" | "app-template"> = "system",
    behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative" | "autonomous"> = TaxonomyBehaviorKinds.deterministic,
  ): RuntimeBehaviorProfile {
    const taxonomy = this.taxonomyClassifier.classifySystemAsset(semanticRole, behaviorKind);
    return classifyExecutableBehavior(taxonomy);
  }
}

