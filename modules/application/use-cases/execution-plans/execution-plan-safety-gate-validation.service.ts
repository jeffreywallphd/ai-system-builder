import type { ExecutionAdapterReferenceStatus, ExecutionBlocker, ExecutionDiagnostic, ExecutionPlanRecord } from '../../../contracts/execution-plans';

const PASSABLE = new Set<ExecutionAdapterReferenceStatus>(['available-by-readiness','planned']);
const BLOCKED = new Set<ExecutionAdapterReferenceStatus>(['needs-setup','missing','blocked','unsupported','stale','invalid']);

export class ExecutionPlanSafetyGateValidationService {
  public validate(plan: ExecutionPlanRecord): { blockers: ExecutionBlocker[]; diagnostics: ExecutionDiagnostic[]; requiresReview: boolean } {
    const blockers: ExecutionBlocker[] = []; const diagnostics: ExecutionDiagnostic[] = []; let requiresReview = false;
    for (const gate of plan.safetyGates) {
      if (['user-review-required','policy-review-required','execution-preview-reviewed','resource-estimate-review'].includes(gate.kind)) { requiresReview = true; diagnostics.push({ code:'execution-plan-safety-gate-needs-review', severity:'warning', message:'Safety review required.', targetReferenceKind:'execution-safety-gate', targetReferenceId:gate.id }); }
      if (gate.kind === 'no-unresolved-blockers' && plan.blockers.length > 0) blockers.push({ code:'execution-plan-safety-gate-failed', message:'Unresolved blockers remain.', targetReferenceKind:'execution-safety-gate', targetReferenceId:gate.id });
      if (gate.kind === 'required-input-available' && gate.inputId && !plan.inputs.find((i)=>i.id===gate.inputId && i.status!=='missing')) blockers.push({ code:'execution-plan-missing-inputs', message:'Required input unavailable.', targetReferenceKind:'execution-safety-gate', targetReferenceId:gate.id });
      if (gate.kind === 'output-destination-planned' && gate.outputId && !plan.outputs.find((o)=>o.id===gate.outputId && o.destinationReferenceId)) blockers.push({ code:'execution-plan-missing-outputs', message:'Output destination missing.', targetReferenceKind:'execution-safety-gate', targetReferenceId:gate.id });
      if (gate.kind === 'provider-setup-selected' && gate.adapterReferenceId) {
        const a = plan.adapterReferences.find((x)=>x.id===gate.adapterReferenceId);
        if (!a || BLOCKED.has(a.status)) blockers.push({ code:'execution-plan-provider-setup-required', message:'Provider setup required.', targetReferenceKind:'execution-safety-gate', targetReferenceId:gate.id });
        if (a?.status === 'deferred') requiresReview = true;
        if (a && !PASSABLE.has(a.status) && a.status !== 'deferred' && !BLOCKED.has(a.status)) diagnostics.push({ code:'execution-plan-provider-status-unknown', severity:'warning', message:'Unknown adapter planning status.', targetReferenceKind:'execution-adapter-reference', targetReferenceId:a.id });
      }
    }
    return { blockers, diagnostics, requiresReview };
  }
}
