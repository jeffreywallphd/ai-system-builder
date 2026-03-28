import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";

export const ToolStudioIdentity = Object.freeze({
  studioType: "tool-studio",
  defaultStudioId: "studio-tools",
  defaultStudioName: "Tool Studio",
});

export function createToolStudioTaxonomy(
  behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional"> = TaxonomyBehaviorKinds.conditional,
) {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.tool,
    behaviorKind,
  });
}

export function createToolAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional">;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["tool", ...(input.tags ?? [])]),
    taxonomy: createToolStudioTaxonomy(input.behaviorKind),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? ToolStudioIdentity.studioType,
    },
  });
}
