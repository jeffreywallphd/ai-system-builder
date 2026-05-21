import { normalizeCreateExecutionPlanCommand, normalizeExecutionPlanId, normalizeExecutionPlanRecord, type CreateExecutionPlanCommand, type CreateExecutionPlanResult, type ExecutionPlanRecord } from "../../../contracts/execution-plans";
import type { AssetCompositionPlanRepositoryPort } from "../../ports/asset-composition";
import type { ExecutionPlanRepositoryPort } from "../../ports/execution-plans";
import type { RuntimeReadinessBindingRepositoryPort } from "../../ports/runtime-readiness";
import { executionPlanFailure } from "./execution-plan-result-helpers";
import { ExecutionPlanStepPlanningService } from "./execution-plan-step-planning.service";
import { ExecutionPlanStatusService } from "./execution-plan-status.service";
import { createExecutionPlanProvenanceEvent } from "./execution-plan-provenance.service";
import { ExecutionPlanProviderPlanningService } from "./execution-plan-provider-planning.service";

export class CreateExecutionPlanUseCase {
  public constructor(private readonly d: { executionPlanRepository: ExecutionPlanRepositoryPort; runtimeReadinessBindingRepository: RuntimeReadinessBindingRepositoryPort; compositionPlanRepository: AssetCompositionPlanRepositoryPort; stepPlanningService: ExecutionPlanStepPlanningService; statusService: ExecutionPlanStatusService; providerPlanningService: ExecutionPlanProviderPlanningService; nextExecutionPlanId: () => string; nextExecutionStepId: () => string; nextExecutionAdapterReferenceId: () => string; nextExecutionSafetyGateId: () => string; now?: () => string; }) {}
  public async execute(command: CreateExecutionPlanCommand): Promise<CreateExecutionPlanResult> {
    let c; try { c = normalizeCreateExecutionPlanCommand(command); } catch { return executionPlanFailure("validation", "execution-plan-command-invalid"); }
    const now = (this.d.now ?? (() => new Date().toISOString()))();
    try {
      const readiness = await this.d.runtimeReadinessBindingRepository.readRuntimeReadinessBindingRecord(c.workspaceId as any, c.runtimeReadinessBindingId as any);
      if (!readiness) return executionPlanFailure("not-found", "execution-plan-source-readiness-not-found");
      if (["archived", "invalid", "blocked", "missing-requirements", "provider-unavailable", "provider-unsupported", "configuration-required", "permission-required", "stale"].includes(readiness.status)) {
        return executionPlanFailure(readiness.status === "stale" ? "stale" : "source-readiness-not-ready", "execution-plan-source-readiness-not-ready");
      }
      const sourcePlanId = c.compositionPlanId ?? readiness.compositionPlanId;
      const composition = await this.d.compositionPlanRepository.readAssetCompositionPlanRecord(c.workspaceId as any, sourcePlanId as any);
      if (!composition) return executionPlanFailure("not-found", "execution-plan-source-composition-not-found");
      if (["archived", "invalid", "stale", "blocked", "conflicted"].includes(composition.status)) return executionPlanFailure(composition.status === "stale" ? "stale" : "blocked", "execution-plan-source-composition-not-usable");
      const planId = normalizeExecutionPlanId(this.d.nextExecutionPlanId());
      const stepPlan = this.d.stepPlanningService.plan({ planId, compositionPlan: composition, nextExecutionStepId: this.d.nextExecutionStepId, sourceCompositionPlanId: sourcePlanId });
      const providerPlan = this.d.providerPlanningService.plan({ planId, sourceRuntimeReadinessBindingId: c.runtimeReadinessBindingId, steps: stepPlan.steps, createAdapterReferenceId: this.d.nextExecutionAdapterReferenceId, createSafetyGateId: this.d.nextExecutionSafetyGateId });
      const status = this.d.statusService.calculate({ readinessStatus: readiness.status, hasStaleSource: false, hasBlockers: stepPlan.blockers.length > 0 || providerPlan.blockers.length > 0, hasMissingInputs: false, hasMissingOutputs: false, hasMissingAdapters: providerPlan.adapterReferences.length === 0 });
      const record: ExecutionPlanRecord = normalizeExecutionPlanRecord({ id: planId, workspaceId: c.workspaceId, sourceCompositionPlanId: sourcePlanId as string, sourceRuntimeReadinessBindingId: c.runtimeReadinessBindingId, sourceReadinessStatus: readiness.status, status, steps: providerPlan.steps, dependencies: [], inputs: [], outputs: [], adapterReferences: providerPlan.adapterReferences, safetyGates: providerPlan.safetyGates, blockers: [...stepPlan.blockers, ...providerPlan.blockers], diagnostics: [...stepPlan.diagnostics, ...providerPlan.diagnostics], resourceEstimates: [], provenance: [createExecutionPlanProvenanceEvent("execution-plan-created", now, { workspaceId: c.workspaceId, executionPlanId: planId, runtimeReadinessBindingId: c.runtimeReadinessBindingId, compositionPlanId: sourcePlanId as string })], createdAt: now, updatedAt: now });
      const saved = await this.d.executionPlanRepository.saveExecutionPlan(record);
      return { kind: "success", value: saved };
    } catch { return executionPlanFailure("unavailable", "execution-plan-service-unavailable"); }
  }
}
