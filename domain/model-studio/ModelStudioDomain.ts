import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import { createCompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../taxonomy/CompositionTaxonomy";
import type { AssetContractDescriptor } from "../contracts/AssetContract";

export const ModelStudioIdentity = Object.freeze({
  studioType: "model-studio",
  defaultStudioId: "studio-models",
  defaultStudioName: "Model Studio",
});

export function createModelStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.model,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
}

export function createModelAssetMetadata(input: {
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
    tags: Object.freeze(["model", ...(input.tags ?? [])]),
    taxonomy: createModelStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? ModelStudioIdentity.studioType,
    },
  });
}
