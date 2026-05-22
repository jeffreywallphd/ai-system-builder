import type { ExecutionAdapterReference, ExecutionAdapterReferenceKind, ExecutionAdapterReferenceStatus, ExecutionBlocker, ExecutionDiagnostic, ExecutionStep } from '../../../contracts/execution-plans';

const needsProvider = new Set<ExecutionStep['kind']>(['generate-image','generate-text','embed-content','call-api','store-artifact','read-artifact']);

const inferCapability = (stepKind: ExecutionStep['kind']): string => {
  if (stepKind === 'generate-image') return 'image-generation';
  if (stepKind === 'generate-text') return 'text-generation';
  if (stepKind === 'embed-content') return 'embeddings';
  if (stepKind === 'store-artifact' || stepKind === 'read-artifact') return 'storage';
  if (stepKind === 'call-api') return 'api';
  return '';
};

export class ExecutionPlanProviderPlanningService {
  public plan(args:{ planId:string; sourceRuntimeReadinessBindingId:string; readiness:{selectedRuntimeBindings?:Array<{runtimeBindingId:string; providerKind?:string; capabilityKind?:string; status?:string; label?:string}>}; steps:ExecutionStep[]; createAdapterReferenceId:()=>string; }) {
    const adapterReferences:ExecutionAdapterReference[]=[]; const blockers:ExecutionBlocker[]=[]; const diagnostics:ExecutionDiagnostic[]=[];
    const selected = args.readiness.selectedRuntimeBindings ?? [];
    const steps = args.steps.map((step)=>{
      if (!needsProvider.has(step.kind)) return step;
      const requiredCapability = inferCapability(step.kind);
      const binding = selected.find((b)=> (b.capabilityKind ?? '').toLowerCase() === requiredCapability);
      const status:ExecutionAdapterReferenceStatus = binding ? 'available-by-readiness':'needs-setup';
      const kind:ExecutionAdapterReferenceKind = step.kind === 'call-api' ? 'api-adapter' : step.kind === 'store-artifact' ? 'storage-adapter' : step.kind === 'read-artifact' ? 'artifact-adapter' : step.kind === 'generate-image' ? 'model-adapter' : 'provider-adapter';
      const ar:ExecutionAdapterReference = { id: args.createAdapterReferenceId(), kind, status, sourceRuntimeReadinessBindingId: args.sourceRuntimeReadinessBindingId, sourceRuntimeBindingId: binding?.runtimeBindingId, providerKind: binding?.providerKind, capabilityKind: binding?.capabilityKind, label: binding?.label ?? `Setup required for ${step.kind}`, blockers:[], diagnostics:[] };
      adapterReferences.push(ar);
      if (!binding) blockers.push({ code:'execution-plan-provider-setup-required', message:'Provider setup selection required.', targetReferenceKind:'execution-step', targetReferenceId:step.id });

      diagnostics.push({ code:'execution-plan-provider-planning-deferred', severity:'info', message:'Provider invocation remains deferred.', targetReferenceKind:'execution-step', targetReferenceId:step.id });
      return { ...step, requiredAdapterReferenceIds:[...step.requiredAdapterReferenceIds, ar.id] };
    });
    return { steps, adapterReferences, blockers, diagnostics };
  }
}
