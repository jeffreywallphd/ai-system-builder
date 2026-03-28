import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../taxonomy/CompositionTaxonomy";

export const ConfigProfileStudioIdentity = Object.freeze({
  studioType: "config-profile-studio",
  defaultStudioId: "studio-config-profiles",
  defaultStudioName: "Config Profile Studio",
});

export function createConfigProfileStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.configProfile,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
}

export function createConfigProfileAssetMetadata(input: {
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
    tags: Object.freeze(["config-profile", ...(input.tags ?? [])]),
    taxonomy: createConfigProfileStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? ConfigProfileStudioIdentity.studioType,
    },
  });
}
