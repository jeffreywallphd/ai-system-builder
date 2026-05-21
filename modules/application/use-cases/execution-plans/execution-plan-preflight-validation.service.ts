import type { ExecutionPlanRecord, ExecutionBlocker, ExecutionDiagnostic } from '../../../contracts/execution-plans';

const UNSAFE_PATTERNS = [/payload/i,/workflow/i,/graph/i,/base64/i,/secret/i,/token/i,/api[-_]?key/i,/private[-_]?key/i,/signed[-_]?url/i,/command/i,/env/i,/path/i];

export class ExecutionPlanPreflightValidationService {
  public validate(plan: ExecutionPlanRecord): { blockers: ExecutionBlocker[]; diagnostics: ExecutionDiagnostic[]; hasMissingInputs: boolean; hasMissingOutputs: boolean; hasMissingAdapters: boolean; hasUnsafeDetails: boolean } {
    const blockers: ExecutionBlocker[] = [];
    const diagnostics: ExecutionDiagnostic[] = [];
    if (!plan.workspaceId) blockers.push(this.b('execution-plan-workspace-missing','Workspace is required.'));
    if (!plan.sourceRuntimeReadinessBindingId) blockers.push(this.b('execution-plan-source-readiness-missing','Source readiness reference is required.'));
    if (!plan.sourceCompositionPlanId) blockers.push(this.b('execution-plan-source-composition-missing','Source composition plan reference is required.'));
    if (plan.steps.length === 0) blockers.push(this.b('execution-plan-no-steps-planned','At least one step must be planned.'));

    const stepIds = new Set(plan.steps.map((s) => s.id));
    const inputIds = new Set(plan.inputs.map((i) => i.id));
    const outputIds = new Set(plan.outputs.map((o) => o.id));
    const adapterIds = new Set(plan.adapterReferences.map((a) => a.id));
    const gateIds = new Set(plan.safetyGates.map((g) => g.id));

    for (const dep of plan.dependencies) {
      if (dep.requiredStepId && !stepIds.has(dep.requiredStepId)) blockers.push(this.b('execution-plan-unknown-step-dependency','Dependency references unknown step.', dep.id));
      if (dep.requiredInputId && !inputIds.has(dep.requiredInputId)) blockers.push(this.b('execution-plan-missing-required-input','Dependency references unknown input.', dep.id));
      if (dep.requiredOutputId && !outputIds.has(dep.requiredOutputId)) blockers.push(this.b('execution-plan-missing-required-output','Dependency references unknown output.', dep.id));
      if (dep.requiredAdapterReferenceId && !adapterIds.has(dep.requiredAdapterReferenceId)) blockers.push(this.b('execution-plan-missing-adapter-reference','Dependency references unknown adapter.', dep.id));
      if (dep.requiredSafetyGateId && !gateIds.has(dep.requiredSafetyGateId)) blockers.push(this.b('execution-plan-safety-gate-target-missing','Dependency references unknown safety gate.', dep.id));
    }

    for (const i of plan.inputs) if (!stepIds.has(i.stepId)) blockers.push(this.b('execution-plan-input-step-unknown','Input references unknown step.', i.id));
    for (const o of plan.outputs) if (!stepIds.has(o.stepId)) blockers.push(this.b('execution-plan-output-step-unknown','Output references unknown step.', o.id));
    for (const s of plan.steps) {
      for (const inId of s.inputIds) if (!inputIds.has(inId)) blockers.push(this.b('execution-plan-missing-required-input','Step input missing.', s.id));
      for (const outId of s.outputIds) if (!outputIds.has(outId)) blockers.push(this.b('execution-plan-missing-required-output','Step output missing.', s.id));
      for (const aId of s.requiredAdapterReferenceIds) if (!adapterIds.has(aId)) blockers.push(this.b('execution-plan-provider-setup-required','Step adapter missing.', s.id));
    }
    for (const g of plan.safetyGates) {
      if (g.stepId && !stepIds.has(g.stepId)) blockers.push(this.b('execution-plan-safety-gate-target-missing','Safety gate references unknown step.', g.id));
      if (g.inputId && !inputIds.has(g.inputId)) blockers.push(this.b('execution-plan-safety-gate-target-missing','Safety gate references unknown input.', g.id));
      if (g.outputId && !outputIds.has(g.outputId)) blockers.push(this.b('execution-plan-safety-gate-target-missing','Safety gate references unknown output.', g.id));
      if (g.adapterReferenceId && !adapterIds.has(g.adapterReferenceId)) blockers.push(this.b('execution-plan-safety-gate-target-missing','Safety gate references unknown adapter.', g.id));
    }

    const serialized = JSON.stringify(plan);
    const hasUnsafeDetails = UNSAFE_PATTERNS.some((p) => p.test(serialized));
    if (hasUnsafeDetails) diagnostics.push({ code: 'execution-plan-unsafe-details-redacted', severity: 'warning', message: 'Unsafe details were detected and deferred.' });
    return { blockers, diagnostics, hasMissingInputs: blockers.some((b) => b.code.includes('input')), hasMissingOutputs: blockers.some((b) => b.code.includes('output')), hasMissingAdapters: blockers.some((b) => b.code.includes('adapter') || b.code.includes('provider-setup')), hasUnsafeDetails };
  }
  private b(code: string, message: string, targetReferenceId?: string): ExecutionBlocker { return { code, message, ...(targetReferenceId ? { targetReferenceKind: 'execution-step', targetReferenceId: targetReferenceId as never } : {}) }; }
}
