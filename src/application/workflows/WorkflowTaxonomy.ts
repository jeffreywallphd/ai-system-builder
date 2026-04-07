import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { CompositionTaxonomyDescriptor, TaxonomyBehaviorKind } from "@domain/taxonomy/CompositionTaxonomy";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";

const classifier = new CompositionTaxonomyClassifier();

export function classifyWorkflowTaxonomy(
  workflow: IWorkflow,
  behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "dynamic"> = "deterministic",
): CompositionTaxonomyDescriptor {
  return classifier.classifyWorkflow(workflow, behaviorKind);
}

