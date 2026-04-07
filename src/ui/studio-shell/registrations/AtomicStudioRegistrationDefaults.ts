import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";
import type { AssetMetadataPatch } from "../../../src/domain/studio-shell/StudioShellDomain";
import type { CompositionTaxonomyDescriptor } from "../../../src/domain/taxonomy/CompositionTaxonomy";

const contractResolver = new CompositionAssetContractResolver();

export function createStudioMetadataPatch(input: {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly summary: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly sourceLabel: string;
}): AssetMetadataPatch {
  return Object.freeze({
    title: input.title,
    tags: [...input.tags],
    summary: input.summary,
    taxonomy: input.taxonomy,
    contract: contractResolver.resolveContractForTaxonomy(input.taxonomy),
    provenance: {
      sourceType: "generated",
      sourceLabel: input.sourceLabel,
    },
  });
}

export function createAtomicStudioMetadataPatch(input: {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly summary: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly sourceLabel: string;
}): AssetMetadataPatch {
  return createStudioMetadataPatch(input);
}

export function createCompositeStudioMetadataPatch(input: {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly summary: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly sourceLabel: string;
}): AssetMetadataPatch {
  return createStudioMetadataPatch(input);
}

export function createSystemStudioMetadataPatch(input: {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly summary: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly sourceLabel: string;
}): AssetMetadataPatch {
  return createStudioMetadataPatch(input);
}
