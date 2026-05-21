import type { AssetCompositionPlan } from '../../../contracts/asset-composition';
import type { ExecutionAdapterReference, ExecutionBlocker, ExecutionDependency, ExecutionDependencyId, ExecutionDiagnostic, ExecutionInput, ExecutionOutput, ExecutionSafetyGate, ExecutionStep } from '../../../contracts/execution-plans';

export class ExecutionPlanDependencyPlanningService {
  public plan(args: { compositionPlan: AssetCompositionPlan; steps: ExecutionStep[]; inputs: ExecutionInput[]; outputs: ExecutionOutput[]; adapterReferences: ExecutionAdapterReference[]; safetyGates: ExecutionSafetyGate[]; nextExecutionDependencyId: () => ExecutionDependencyId | string; }) {
    const deps: ExecutionDependency[] = []; const blockers: ExecutionBlocker[] = []; const diagnostics: ExecutionDiagnostic[] = [];
    const byNode = new Map(args.steps.map((s) => [s.sourceNodeId, s]));
    for (const rel of args.compositionPlan.relationships) {
      const src = byNode.get(rel.sourceNodeId); const tgt = byNode.get(rel.targetNodeId);
      if (!src || !tgt) { diagnostics.push({ code:'execution-plan-ambiguous-relationship-mapping', severity:'warning', message:'Relationship mapping ambiguous.', targetReferenceKind:'composition-relationship', targetReferenceId: rel.relationshipId }); continue; }
      deps.push({ id: args.nextExecutionDependencyId() as ExecutionDependencyId, kind:'step-after-step', status:'satisfied-by-plan', sourceStepId: src.id, targetStepId: tgt.id, label:'Step ordering dependency', blockers:[], diagnostics:[] });
    }
    for (const input of args.inputs) deps.push({ id: args.nextExecutionDependencyId() as ExecutionDependencyId, kind:'input-required', status:'satisfied-by-plan', sourceStepId: input.stepId, inputId: input.id, label:'Input required dependency', blockers:[], diagnostics:[] });
    for (const output of args.outputs) deps.push({ id: args.nextExecutionDependencyId() as ExecutionDependencyId, kind:'output-required', status:'satisfied-by-plan', sourceStepId: output.stepId, outputId: output.id, label:'Output required dependency', blockers:[], diagnostics:[] });
    for (const a of args.adapterReferences) {
      const step = args.steps.find((s) => s.requiredAdapterReferenceIds.includes(a.id));
      if (!step) { blockers.push({ code:'execution-plan-missing-step-reference', message:'Missing step for adapter dependency.' }); continue; }
      deps.push({ id: args.nextExecutionDependencyId() as ExecutionDependencyId, kind:'provider-required', status:'satisfied-by-plan', sourceStepId: step.id, adapterReferenceId: a.id, label:'Provider required dependency', blockers:[], diagnostics:[] });
    }
    for (const g of args.safetyGates) if (g.stepId) deps.push({ id: args.nextExecutionDependencyId() as ExecutionDependencyId, kind:'safety-gate-required', status:'satisfied-by-plan', sourceStepId: g.stepId, safetyGateId: g.id, label:'Safety gate dependency', blockers:[], diagnostics:[] });
    return { dependencies: deps, blockers, diagnostics };
  }
}
