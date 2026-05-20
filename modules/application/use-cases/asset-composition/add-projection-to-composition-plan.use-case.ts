import { normalizeAddProjectionToCompositionPlanCommand, normalizeAssetCompositionNodeId, normalizeAssetCompositionPlan, type AddProjectionToCompositionPlanCommand, type AddProjectionToCompositionPlanResult } from "../../../contracts/asset-composition";
import type { AssetCompositionPlanRepositoryPort } from "../../ports/asset-composition";
import type { EffectiveAssetProjectionRepositoryPort } from "../../ports/effective-asset-projections";
import { createPlanProvenanceEvent } from "./asset-composition-plan-provenance.service";
import { assetCompositionPlanFailure } from "./asset-composition-plan-result-helpers";
import { createCompositionNodeFromProjection, createSelectedProjectionReference } from "./asset-composition-node-factory.service";
import { validateProjectionForSelection } from "./asset-composition-projection-selection.service";

export class AddProjectionToCompositionPlanUseCase {
  constructor(private readonly d: { repository: AssetCompositionPlanRepositoryPort; projectionRepository: EffectiveAssetProjectionRepositoryPort; generateNodeId: () => string; now?: () => string }) {}
  async execute(command: AddProjectionToCompositionPlanCommand): Promise<AddProjectionToCompositionPlanResult> {
    let c; try { c = normalizeAddProjectionToCompositionPlanCommand(command); } catch { return assetCompositionPlanFailure("validation", "asset-composition-workspace-required"); }
    const now = (this.d.now ?? (() => new Date().toISOString()))();
    try {
      const plan = await this.d.repository.readAssetCompositionPlanRecord(c.targetWorkspaceId, c.planId);
      if (!plan) return assetCompositionPlanFailure("not-found", "asset-composition-plan-not-found");
      if (plan.status === "archived") return assetCompositionPlanFailure("blocked", "asset-composition-plan-runtime-binding-deferred");
      const projection = await this.d.projectionRepository.readEffectiveAssetProjectionRecord(c.targetWorkspaceId, c.projectionId);
      if (!projection) return assetCompositionPlanFailure("not-found", "asset-composition-projection-missing");
      if (projection.targetWorkspaceId !== c.targetWorkspaceId) return assetCompositionPlanFailure("not-found", "asset-composition-projection-missing");
      const fail = validateProjectionForSelection(projection); if (fail) return assetCompositionPlanFailure(fail.kind, fail.code);
      if (plan.selectedProjections.some((x) => x.projectionId === c.projectionId)) return assetCompositionPlanFailure("conflict", "asset-composition-projection-conflicted");
      const nodeId = normalizeAssetCompositionNodeId(this.d.generateNodeId());
      const selected = createSelectedProjectionReference(projection, now);
      const node = createCompositionNodeFromProjection({ projection, selectedProjection: selected, command: c, nodeId, now });
      const next = normalizeAssetCompositionPlan({ ...plan, selectedProjections: [...plan.selectedProjections, selected], nodes: [...plan.nodes, node], planningSummary: { ...plan.planningSummary, totalNodes: plan.nodes.length + 1 }, provenance: [...plan.provenance, { ...createPlanProvenanceEvent("plan-created", c.targetWorkspaceId, c.planId, now), kind: "projection-selected", projectionId: c.projectionId, nodeId, effectiveAssetReference: projection.effectiveAssetReference }], updatedAt: now });
      return { status: "success", value: await this.d.repository.updateAssetCompositionPlanRecord(next) };
    } catch { return assetCompositionPlanFailure("unavailable", "asset-composition-workspace-invalid"); }
  }
}
