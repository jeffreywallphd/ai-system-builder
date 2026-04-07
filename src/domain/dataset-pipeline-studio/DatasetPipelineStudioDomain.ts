import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";

export const DatasetPipelineStudioIdentity = Object.freeze({
  studioType: "dataset-pipeline-studio",
  defaultStudioId: "studio-dataset-pipelines",
  defaultStudioName: "Dataset Pipeline Studio",
});

export function createDatasetPipelineStudioTaxonomy(
  behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "iterative"> = TaxonomyBehaviorKinds.deterministic,
) {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.datasetPipeline,
    behaviorKind,
  });
}

export function createDatasetPipelineAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "iterative">;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["dataset-pipeline", ...(input.tags ?? [])]),
    taxonomy: createDatasetPipelineStudioTaxonomy(input.behaviorKind),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? DatasetPipelineStudioIdentity.studioType,
    },
  });
}
