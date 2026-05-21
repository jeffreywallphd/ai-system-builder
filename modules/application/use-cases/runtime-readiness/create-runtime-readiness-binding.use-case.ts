import { normalizeCreateRuntimeReadinessBindingCommand, normalizeRuntimeReadinessBinding, type CreateRuntimeReadinessBindingCommand, type CreateRuntimeReadinessBindingResult } from "../../../contracts/runtime-readiness";
import type { AssetCompositionPlanRepositoryPort } from "../../ports/asset-composition";
import type { RuntimeInventoryRepositoryPort, RuntimeReadinessBindingRepositoryPort } from "../../ports/runtime-readiness";
import { runtimeReadinessFailure } from "./runtime-readiness-binding-result-helpers";
import { RuntimeRequirementExtractionService } from "./runtime-requirement-extraction.service";
import { RuntimeCapabilityMatchingService } from "./runtime-capability-matching.service";
import { RuntimeBindingCandidateSelectionService } from "./runtime-binding-candidate-selection.service";
import { createRuntimeReadinessProvenanceEvent } from "./runtime-readiness-binding-provenance.service";

export class CreateRuntimeReadinessBindingUseCase {
  public constructor(private readonly d: { compositionRepository: AssetCompositionPlanRepositoryPort; inventoryRepository: RuntimeInventoryRepositoryPort; bindingRepository: RuntimeReadinessBindingRepositoryPort; requirementExtractionService: RuntimeRequirementExtractionService; capabilityMatchingService: RuntimeCapabilityMatchingService; candidateSelectionService: RuntimeBindingCandidateSelectionService; nextReadinessBindingId: () => string; nextRequirementId: () => string; nextBindingCandidateId: () => string; nextBindingId: () => string; now?: () => string }) {}
  public async execute(command: CreateRuntimeReadinessBindingCommand): Promise<CreateRuntimeReadinessBindingResult> {
    let c; try { c = normalizeCreateRuntimeReadinessBindingCommand(command); } catch { return runtimeReadinessFailure("validation", "runtime-readiness-composition-plan-required"); }
    const now = (this.d.now ?? (() => new Date().toISOString()))();
    try {
      const plan = await this.d.compositionRepository.readAssetCompositionPlanRecord(c.targetWorkspaceId, c.compositionPlanId);
      if (!plan) return runtimeReadinessFailure("not-found", "runtime-readiness-composition-plan-missing");
      if (plan.status === "archived") return runtimeReadinessFailure("conflict", "runtime-readiness-composition-plan-not-valid");
      if (plan.status !== "valid") return runtimeReadinessFailure(plan.status === "stale" ? "stale" : "blocked", "runtime-readiness-composition-plan-not-valid");
      const extraction = this.d.requirementExtractionService.extractRequirements({ plan, nextRequirementId: this.d.nextRequirementId as never, now });
      const inventories = (await this.d.inventoryRepository.listRuntimeInventoryRecords({ targetWorkspaceId: c.targetWorkspaceId })).records;
      const matching = this.d.capabilityMatchingService.match({ inventory: inventories, requirements: extraction.requirements, targetWorkspaceId: c.targetWorkspaceId, nextBindingCandidateId: this.d.nextBindingCandidateId as never, now });
      const selection = this.d.candidateSelectionService.select({ readinessBindingId: this.d.nextReadinessBindingId() as never, targetWorkspaceId: c.targetWorkspaceId, requirements: extraction.requirements, candidates: matching.candidates, nextBindingId: this.d.nextBindingId as never, now });
      const selectedRequired = new Set(selection.bindings.map((binding) => binding.requirementId));
      const required = extraction.requirements.filter((item) => item.isRequired);
      const status = matching.blockers.length > 0 ? "missing-requirements" : required.every((item) => selectedRequired.has(item.requirementId)) ? "ready-for-setup" : "draft";
      const record = normalizeRuntimeReadinessBinding({ readinessBindingId: this.d.nextReadinessBindingId() as never, targetWorkspaceId: c.targetWorkspaceId, compositionPlanId: c.compositionPlanId, compositionPlanValidationAt: plan.validationSummary?.validatedAt, status, requirements: extraction.requirements, providerCandidates: matching.providerCandidates, bindingCandidates: matching.candidates, bindings: selection.bindings, blockers: matching.blockers, diagnostics: [...extraction.diagnostics, ...matching.diagnostics, ...selection.diagnostics], provenance: [createRuntimeReadinessProvenanceEvent("readiness-binding-created", c.targetWorkspaceId, c.compositionPlanId, now, this.d.nextReadinessBindingId() as never)], createdAt: now, updatedAt: now });
      return { status: "success", value: await this.d.bindingRepository.saveRuntimeReadinessBindingRecord(record) };
    } catch {
      return runtimeReadinessFailure("internal", "runtime-readiness-service-unavailable");
    }
  }
}
