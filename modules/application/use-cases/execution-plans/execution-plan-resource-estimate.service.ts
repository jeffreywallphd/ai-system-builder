import type { ExecutionPlanRecord, ExecutionResourceEstimate } from '../../../contracts/execution-plans';

export class ExecutionPlanResourceEstimateService {
  public estimate(plan: ExecutionPlanRecord): ExecutionResourceEstimate[] {
    const providerHeavy = plan.steps.filter((s) => ['generate-image','generate-text','embed-content','call-api'].includes(s.kind)).length;
    const unknownProvider = plan.adapterReferences.some((a) => a.kind === 'manual-adapter' || a.status === 'missing' || a.status === 'needs-setup' || a.status === 'blocked');
    const compute = plan.steps.length === 0 ? 'none' : unknownProvider ? 'unknown' : providerHeavy >= 3 ? 'high' : providerHeavy >= 1 ? 'medium' : plan.steps.length <= 2 ? 'low' : 'medium';
    const storage = plan.outputs.length === 0 ? 'none' : plan.outputs.length >= 5 ? 'large' : plan.outputs.length >= 3 ? 'medium' : 'small';
    const duration = unknownProvider ? 'unknown' : plan.steps.length <= 1 ? 'instant' : plan.steps.length <= 3 ? 'short' : plan.steps.length <= 6 ? 'medium' : 'long';
    return [{ id: 'ere_counts' as never, category: 'compute', estimate: compute }, { id: 'ere_storage' as never, category: 'storage', estimate: storage }, { id: 'ere_duration' as never, category: 'duration', estimate: duration }];
  }
}
