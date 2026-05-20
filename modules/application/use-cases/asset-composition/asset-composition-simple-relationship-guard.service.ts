import type { AssetCompositionNode, AssetCompositionPlan, AssetCompositionRelationshipKind } from "../../../contracts/asset-composition";

export type SimpleRelationshipGuardFailureCode =
  | "asset-composition-plan-runtime-binding-deferred"
  | "asset-composition-relationship-node-missing"
  | "asset-composition-workspace-invalid"
  | "asset-composition-relationship-duplicate"
  | "asset-composition-relationship-unsupported";

export const guardSimpleCompositionRelationship = (d: { plan: AssetCompositionPlan; sourceNode: AssetCompositionNode; targetNode: AssetCompositionNode; relationshipKind: AssetCompositionRelationshipKind }) => {
  if (d.plan.status === "archived") return { ok: false as const, code: "asset-composition-plan-runtime-binding-deferred" as SimpleRelationshipGuardFailureCode };
  if (d.sourceNode.targetWorkspaceId !== d.plan.targetWorkspaceId || d.targetNode.targetWorkspaceId !== d.plan.targetWorkspaceId) return { ok: false as const, code: "asset-composition-workspace-invalid" as SimpleRelationshipGuardFailureCode };
  if (d.sourceNode.nodeId === d.targetNode.nodeId) return { ok: false as const, code: "asset-composition-relationship-node-missing" as SimpleRelationshipGuardFailureCode };
  if ([d.sourceNode.status, d.targetNode.status].some((s) => s === "disabled" || s === "invalid" || s === "source-missing")) return { ok: false as const, code: "asset-composition-relationship-node-missing" as SimpleRelationshipGuardFailureCode };
  if (d.plan.relationships.some((r) => r.sourceNodeId === d.sourceNode.nodeId && r.targetNodeId === d.targetNode.nodeId && r.kind === d.relationshipKind)) return { ok: false as const, code: "asset-composition-relationship-duplicate" as SimpleRelationshipGuardFailureCode };
  return { ok: true as const };
};
