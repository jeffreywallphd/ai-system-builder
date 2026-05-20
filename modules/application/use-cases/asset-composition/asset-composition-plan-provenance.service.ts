import type { AssetCompositionPlanId, AssetCompositionProvenanceEvent } from "../../../contracts/asset-composition";
import type { WorkspaceId } from "../../../contracts/workspace";

export const createPlanProvenanceEvent = (
  kind: "plan-created" | "plan-archived",
  targetWorkspaceId: WorkspaceId,
  planId: AssetCompositionPlanId,
  operationAt: string,
): AssetCompositionProvenanceEvent => ({
  kind,
  targetWorkspaceId,
  operationAt,
  planId,
});
