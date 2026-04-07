import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../taxonomy/CompositionTaxonomy";

export const ToolChainStudioIdentity = Object.freeze({
  studioType: "tool-chain-studio",
  defaultStudioId: "studio-tool-chains",
  defaultStudioName: "Tool Chain Studio",
});

export function createToolChainStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.toolChain,
    behaviorKind: TaxonomyBehaviorKinds.deterministic,
  });
}

export function createToolChainAssetMetadata(input: {
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
    tags: Object.freeze(["tool-chain", ...(input.tags ?? [])]),
    taxonomy: createToolChainStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? ToolChainStudioIdentity.studioType,
    },
  });
}
