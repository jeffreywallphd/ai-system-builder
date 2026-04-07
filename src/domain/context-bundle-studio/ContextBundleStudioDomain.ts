import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";

export const ContextBundleStudioIdentity = Object.freeze({
  studioType: "context-bundle-studio",
  defaultStudioId: "studio-context-bundles",
  defaultStudioName: "Context Bundle Studio",
});

export function createContextBundleStudioTaxonomy(
  behaviorKind: Extract<TaxonomyBehaviorKind, "none" | "deterministic"> = TaxonomyBehaviorKinds.none,
) {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.contextBundle,
    behaviorKind,
  });
}

export function createContextBundleAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly behaviorKind?: Extract<TaxonomyBehaviorKind, "none" | "deterministic">;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["context-bundle", ...(input.tags ?? [])]),
    taxonomy: createContextBundleStudioTaxonomy(input.behaviorKind),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? ContextBundleStudioIdentity.studioType,
    },
  });
}
