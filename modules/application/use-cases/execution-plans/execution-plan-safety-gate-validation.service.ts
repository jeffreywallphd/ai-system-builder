import type { ExecutionPlanRecord, ExecutionBlocker, ExecutionDiagnostic } from '../../../contracts/execution-plans';

export class ExecutionPlanSafetyGateValidationService {
  public validate(plan: ExecutionPlanRecord): { blockers: ExecutionBlocker[]; diagnostics: ExecutionDiagnostic[]; requiresReview: boolean } {
    const blockers: ExecutionBlocker[] = [];
    const diagnostics: ExecutionDiagnostic[] = [];
    let requiresReview = false;
    for (const gate of plan.safetyGates) {
      if (gate.kind === 'user-review-required' || gate.kind === 'policy-review-required' || gate.kind === 'execution-preview-reviewed') {
        requiresReview = true;
        diagnostics.push({ code: 'execution-plan-safety-gate-needs-review', severity: 'warning', message: 'Safety review required.', targetReferenceKind: 'execution-safety-gate', targetReferenceId: gate.id });
      }
      if (gate.kind === 'no-unresolved-blockers' && plan.blockers.length > 0) blockers.push({ code: 'execution-plan-safety-gate-failed', message: 'Unresolved blockers remain.', targetReferenceKind: 'execution-safety-gate', targetReferenceId: gate.id });
      if (gate.kind === 'provider-setup-selected' && gate.adapterReferenceId && !plan.adapterReferences.find((a) => a.id === gate.adapterReferenceId && a.status === 'available')) blockers.push({ code: 'execution-plan-provider-setup-required', message: 'Provider setup required.', targetReferenceKind: 'execution-safety-gate', targetReferenceId: gate.id });
    }
    return { blockers, diagnostics, requiresReview };
  }
}
