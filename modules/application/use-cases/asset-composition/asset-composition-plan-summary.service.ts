import type { AssetCompositionPlan } from "../../../contracts/asset-composition";

export const recomputeAssetCompositionPlanningSummary = (plan: AssetCompositionPlan): AssetCompositionPlan["planningSummary"] => {
  const compatibleRelationshipCount = plan.relationships.filter((x) => x.compatibilityStatus === "compatible").length;
  const blockedRelationshipCount = plan.relationships.filter((x) => x.compatibilityStatus === "blocked").length;
  return {
    ...plan.planningSummary,
    totalNodes: plan.nodes.length,
    totalRelationships: plan.relationships.length,
    compatibleRelationshipCount,
    blockedRelationshipCount,
  };
};
