import { normalizeExecutionPlanRecord, normalizeValidateExecutionPlanCommand, type ValidateExecutionPlanCommand, type ValidateExecutionPlanResult } from '../../../contracts/execution-plans';
import type { AssetCompositionPlanRepositoryPort } from '../../ports/asset-composition';
import type { ExecutionPlanRepositoryPort } from '../../ports/execution-plans';
import type { RuntimeReadinessBindingRepositoryPort } from '../../ports/runtime-readiness';
import { executionPlanFailure } from './execution-plan-result-helpers';
import { ExecutionPlanPreflightValidationService } from './execution-plan-preflight-validation.service';
import { createExecutionPlanProvenanceEvent } from './execution-plan-provenance.service';
import { ExecutionPlanResourceEstimateService } from './execution-plan-resource-estimate.service';
import { ExecutionPlanSafetyGateValidationService } from './execution-plan-safety-gate-validation.service';
import { ExecutionPlanStatusService } from './execution-plan-status.service';

export class ValidateExecutionPlanUseCase {
  public constructor(private readonly d: { executionPlanRepository: ExecutionPlanRepositoryPort; runtimeReadinessBindingRepository?: RuntimeReadinessBindingRepositoryPort; compositionPlanRepository?: AssetCompositionPlanRepositoryPort; preflightValidationService: ExecutionPlanPreflightValidationService; safetyGateValidationService: ExecutionPlanSafetyGateValidationService; resourceEstimateService: ExecutionPlanResourceEstimateService; statusService: ExecutionPlanStatusService; now?: () => string }) {}
  public async execute(command: ValidateExecutionPlanCommand): Promise<ValidateExecutionPlanResult> {
    let c; try { c = normalizeValidateExecutionPlanCommand(command); } catch { return executionPlanFailure('validation','execution-plan-command-invalid'); }
    const now = (this.d.now ?? (() => new Date().toISOString()))();
    try {
      const record = await this.d.executionPlanRepository.getExecutionPlanById(c.workspaceId as any, c.executionPlanId as any);
      if (!record) return executionPlanFailure('not-found','execution-plan-not-found');
      if (record.status === 'archived') return executionPlanFailure('archived','execution-plan-archived');
      let hasStaleSource = false;
      let readinessStatus = record.sourceReadinessStatus;
      if (this.d.runtimeReadinessBindingRepository) {
        const readiness = await this.d.runtimeReadinessBindingRepository.readRuntimeReadinessBindingRecord(record.workspaceId as any, record.sourceRuntimeReadinessBindingId as any);
        if (!readiness) return executionPlanFailure('source-readiness-not-ready','execution-plan-source-readiness-not-found');
        readinessStatus = readiness.status;
        if (new Date(readiness.updatedAt).getTime() > new Date(record.updatedAt).getTime()) hasStaleSource = true;
      }
      if (this.d.compositionPlanRepository) {
        const comp = await this.d.compositionPlanRepository.readAssetCompositionPlanRecord(record.workspaceId as any, record.sourceCompositionPlanId as any);
        if (!comp) return executionPlanFailure('blocked','execution-plan-source-composition-not-found');
        if (new Date(comp.updatedAt).getTime() > new Date(record.updatedAt).getTime()) hasStaleSource = true;
      }
      const pre = this.d.preflightValidationService.validate(record);
      const withPre = { ...record, blockers: [...record.blockers, ...pre.blockers], diagnostics: [...record.diagnostics, ...pre.diagnostics] };
      const gates = this.d.safetyGateValidationService.validate(withPre);
      const resourceEstimates = this.d.resourceEstimateService.estimate(withPre);
      const status = this.d.statusService.calculate({ readinessStatus, hasStaleSource, hasBlockers: withPre.blockers.length + gates.blockers.length > 0, hasMissingInputs: pre.hasMissingInputs, hasMissingOutputs: pre.hasMissingOutputs, hasMissingAdapters: pre.hasMissingAdapters, requiresSafetyReview: gates.requiresReview, isInvalid: pre.hasUnsafeDetails });
      const next = normalizeExecutionPlanRecord({ ...withPre, status, resourceEstimates, blockers: [...withPre.blockers, ...gates.blockers], diagnostics: [...withPre.diagnostics, ...gates.diagnostics], provenance: [...withPre.provenance, createExecutionPlanProvenanceEvent('execution-plan-validated', now, { workspaceId: record.workspaceId, executionPlanId: record.id })], updatedAt: now });
      const saved = await this.d.executionPlanRepository.updateExecutionPlan(next);
      return { kind: 'success', value: saved };
    } catch { return executionPlanFailure('unavailable','execution-plan-service-unavailable'); }
  }
}
