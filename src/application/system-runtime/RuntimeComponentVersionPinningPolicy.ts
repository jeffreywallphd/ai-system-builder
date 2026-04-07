import {
  SystemComponentKinds,
  type SystemComponentReference,
} from "@domain/system-studio/SystemAssetDomain";
import { TaxonomySemanticRoles } from "@domain/taxonomy/CompositionTaxonomy";

export function requiresPinnedRuntimeComponentVersion(input: {
  readonly component: SystemComponentReference;
  readonly hasResolvedContract: boolean;
}): boolean {
  if (input.component.versionId) {
    return false;
  }

  if (input.component.componentKind === SystemComponentKinds.system) {
    return true;
  }

  const semanticRole = input.component.taxonomy?.semanticRole;
  if (
    semanticRole === TaxonomySemanticRoles.workflow
    || semanticRole === TaxonomySemanticRoles.workflowTemplate
    || semanticRole === TaxonomySemanticRoles.system
    || semanticRole === TaxonomySemanticRoles.appTemplate
  ) {
    return true;
  }

  if (!semanticRole) {
    return true;
  }

  return !input.hasResolvedContract;
}

