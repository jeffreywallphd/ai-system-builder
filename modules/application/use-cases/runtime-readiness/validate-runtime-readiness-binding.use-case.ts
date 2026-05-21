import { normalizeReadRuntimeReadinessBindingCommand, normalizeRuntimeReadinessBinding, type RuntimeReadinessBinding, type ValidateRuntimeReadinessBindingCommand, type ValidateRuntimeReadinessBindingResult } from "../../../contracts/runtime-readiness";
import type { AssetCompositionPlanRecord } from "../../../contracts/asset-composition";
import type { AssetCompositionPlanRepositoryPort } from "../../ports/asset-composition";
import type { RuntimeReadinessBindingRepositoryPort } from "../../ports/runtime-readiness";
import { runtimeReadinessFailure } from "./runtime-readiness-binding-result-helpers";
import { createRuntimeReadinessProvenanceEvent } from "./runtime-readiness-binding-provenance.service";
import { RuntimeReadinessValidationService } from "./runtime-readiness-validation.service";

export class ValidateRuntimeReadinessBindingUseCase {
  public constructor(private readonly d: { bindingRepository: RuntimeReadinessBindingRepositoryPort; validationService: RuntimeReadinessValidationService; compositionRepository?: Pick<AssetCompositionPlanRepositoryPort, "readAssetCompositionPlanRecord">; now?: () => string }) {}

  public async execute(command: ValidateRuntimeReadinessBindingCommand): Promise<ValidateRuntimeReadinessBindingResult> {
    let c;
    try { c = normalizeReadRuntimeReadinessBindingCommand(command); } catch { return runtimeReadinessFailure("validation", "runtime-readiness-workspace-required"); }
    const now = (this.d.now ?? (() => new Date().toISOString()))();
    try {
      const binding = await this.d.bindingRepository.readRuntimeReadinessBindingRecord(c.targetWorkspaceId, c.readinessBindingId);
      if (!binding) return runtimeReadinessFailure("not-found", "runtime-readiness-binding-candidate-missing");
      if (binding.archivedAt || binding.status === "archived") return runtimeReadinessFailure("blocked", "runtime-readiness-composition-plan-not-valid");

      const blockers = [...binding.blockers];
      const diagnostics = [...binding.diagnostics];
      if (this.d.compositionRepository) {
        const plan = await this.d.compositionRepository.readAssetCompositionPlanRecord(c.targetWorkspaceId, binding.compositionPlanId as never) as AssetCompositionPlanRecord | undefined;
        if (!plan) blockers.push({ code: "runtime-readiness-composition-plan-missing", message: "Composition plan reference is missing." });
        else if (["invalid", "archived", "blocked", "conflicted", "unsupported"].includes(plan.status as string)) blockers.push({ code: "runtime-readiness-composition-plan-not-valid", message: "Composition plan is not valid for runtime readiness progression." });
        else if (plan.status === "stale") blockers.push({ code: "runtime-readiness-composition-plan-stale", message: "Composition plan is stale." });
      }

      const evaluated = this.d.validationService.validate({ ...binding, blockers, diagnostics }, c.targetWorkspaceId);
      const status = evaluated.status;
      const updated: RuntimeReadinessBinding = normalizeRuntimeReadinessBinding({ ...binding, status, blockers: evaluated.blockers, diagnostics: evaluated.diagnostics, bindings: evaluated.bindings, updatedAt: now, provenance: [...binding.provenance, createRuntimeReadinessProvenanceEvent("readiness-validated", c.targetWorkspaceId, binding.compositionPlanId, now, binding.readinessBindingId)] });
      const saved = await this.d.bindingRepository.saveRuntimeReadinessBindingRecord(updated);
      return { status: "success", value: saved };
    } catch {
      return runtimeReadinessFailure("internal", "runtime-readiness-service-unavailable");
    }
  }
}
