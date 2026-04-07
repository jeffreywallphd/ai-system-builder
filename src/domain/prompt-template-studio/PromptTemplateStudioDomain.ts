import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../taxonomy/CompositionTaxonomy";

export const PromptTemplateStudioIdentity = Object.freeze({
  studioType: "prompt-template-studio",
  defaultStudioId: "studio-prompt-templates",
  defaultStudioName: "Prompt Template Studio",
});

export function createPromptTemplateStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.promptTemplate,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
}

export function createPromptTemplateAssetMetadata(input: {
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
    tags: Object.freeze(["prompt-template", ...(input.tags ?? [])]),
    taxonomy: createPromptTemplateStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? PromptTemplateStudioIdentity.studioType,
    },
  });
}
