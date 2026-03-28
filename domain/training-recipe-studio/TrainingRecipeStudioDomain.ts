import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../taxonomy/CompositionTaxonomy";

export const TrainingRecipeStudioIdentity = Object.freeze({
  studioType: "training-recipe-studio",
  defaultStudioId: "studio-training-recipes",
  defaultStudioName: "Training Recipe Studio",
});

export function createTrainingRecipeStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.trainingRecipe,
    behaviorKind: TaxonomyBehaviorKinds.deterministic,
  });
}

export function createTrainingRecipeAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["training-recipe", ...(input.tags ?? [])]),
    taxonomy: createTrainingRecipeStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? TrainingRecipeStudioIdentity.studioType,
    },
  });
}
