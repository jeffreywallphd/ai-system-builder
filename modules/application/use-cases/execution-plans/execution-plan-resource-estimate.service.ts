import { normalizeExecutionResourceEstimateId, type ExecutionPlanRecord, type ExecutionResourceEstimate } from '../../../contracts/execution-plans';

export class ExecutionPlanResourceEstimateService {
  public estimate(plan: ExecutionPlanRecord): ExecutionResourceEstimate[] {
    const providerCount = new Set(plan.adapterReferences.map((a)=>a.providerKind).filter(Boolean)).size;
    const compute = plan.steps.length > 8 ? 'high' : plan.steps.length > 3 ? 'medium' : plan.steps.length ? 'low' : 'none';
    const storage = plan.outputs.length > 6 ? 'large' : plan.outputs.length > 2 ? 'medium' : plan.outputs.length ? 'small' : 'none';
    const duration = plan.dependencies.length > 10 ? 'long' : plan.dependencies.length > 4 ? 'medium' : plan.steps.length ? 'short' : 'instant';
    return [{ id: normalizeExecutionResourceEstimateId(`${plan.id}_resource-estimate`), compute, storage, duration, summary: `steps=${plan.steps.length};inputs=${plan.inputs.length};outputs=${plan.outputs.length};dependencies=${plan.dependencies.length};adapters=${plan.adapterReferences.length};gates=${plan.safetyGates.length};blockers=${plan.blockers.length};diagnostics=${plan.diagnostics.length};providerCategories=${providerCount}` }];
  }
}
