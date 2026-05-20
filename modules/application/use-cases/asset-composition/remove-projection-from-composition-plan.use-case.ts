import { normalizeAssetCompositionPlan, normalizeRemoveProjectionFromCompositionPlanCommand, type RemoveProjectionFromCompositionPlanCommand, type RemoveProjectionFromCompositionPlanResult } from "../../../contracts/asset-composition";
import type { AssetCompositionPlanRepositoryPort } from "../../ports/asset-composition";
import { assetCompositionPlanFailure } from "./asset-composition-plan-result-helpers";

export class RemoveProjectionFromCompositionPlanUseCase {
  constructor(private readonly d: { repository: AssetCompositionPlanRepositoryPort; now?: () => string }) {}
  async execute(command: RemoveProjectionFromCompositionPlanCommand): Promise<RemoveProjectionFromCompositionPlanResult> {
    let c; try { c = normalizeRemoveProjectionFromCompositionPlanCommand(command); } catch { return assetCompositionPlanFailure("validation", "asset-composition-workspace-required"); }
    const now = (this.d.now ?? (() => new Date().toISOString()))();
    try {
      const plan = await this.d.repository.readAssetCompositionPlanRecord(c.targetWorkspaceId, c.planId);
      if (!plan) return assetCompositionPlanFailure("not-found", "asset-composition-plan-not-found");
      if (plan.status === "archived") return assetCompositionPlanFailure("blocked", "asset-composition-plan-runtime-binding-deferred");
      const removedNodes = plan.nodes.filter((n) => n.selectedProjection.projectionId === c.projectionId).map((n) => n.nodeId);
      if (!plan.selectedProjections.some((p) => p.projectionId === c.projectionId)) return assetCompositionPlanFailure("not-found", "asset-composition-projection-missing");
      const hasRel = plan.relationships.some((r) => removedNodes.includes(r.sourceNodeId) || removedNodes.includes(r.targetNodeId));
      if (hasRel) return assetCompositionPlanFailure("blocked", "asset-composition-relationship-node-missing");
      const next = normalizeAssetCompositionPlan({ ...plan, selectedProjections: plan.selectedProjections.filter((p) => p.projectionId !== c.projectionId), nodes: plan.nodes.filter((n) => !removedNodes.includes(n.nodeId)), planningSummary: { ...plan.planningSummary, totalNodes: Math.max(0, plan.nodes.length - removedNodes.length) }, provenance: [...plan.provenance, { kind: "projection-removed", targetWorkspaceId: c.targetWorkspaceId, operationAt: now, planId: c.planId, projectionId: c.projectionId }], updatedAt: now });
      return { status: "success", value: await this.d.repository.updateAssetCompositionPlanRecord(next) };
    } catch { return assetCompositionPlanFailure("unavailable", "asset-composition-workspace-invalid"); }
  }
}
