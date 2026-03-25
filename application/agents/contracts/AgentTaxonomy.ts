import type { Agent } from "../../../domain/agents/Agent";
import type { CompositionTaxonomyDescriptor } from "../../../domain/taxonomy/CompositionTaxonomy";
import { CompositionTaxonomyClassifier } from "../../taxonomy/CompositionTaxonomyClassifier";

const classifier = new CompositionTaxonomyClassifier();

/**
 * Agents are classified through the shared composition taxonomy so
 * agent execution remains an extension of the same model used by
 * workflows/assets instead of a parallel ontology.
 */
export function classifyAgentTaxonomy(agent: Agent): CompositionTaxonomyDescriptor {
  return classifier.classifyAgent(agent);
}
