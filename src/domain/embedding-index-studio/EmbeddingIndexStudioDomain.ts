import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../taxonomy/CompositionTaxonomy";

export const EmbeddingIndexStudioIdentity = Object.freeze({
  studioType: "embedding-index-studio",
  defaultStudioId: "studio-embedding-indexes",
  defaultStudioName: "Embedding Index Studio",
});

export function createEmbeddingIndexStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.embeddingIndex,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
}

export function createEmbeddingIndexAssetMetadata(input: {
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
    tags: Object.freeze(["embedding-index", ...(input.tags ?? [])]),
    taxonomy: createEmbeddingIndexStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? EmbeddingIndexStudioIdentity.studioType,
    },
  });
}
