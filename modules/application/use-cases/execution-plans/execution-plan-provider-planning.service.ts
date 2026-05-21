import type { ExecutionAdapterReference, ExecutionAdapterReferenceKind, ExecutionAdapterReferenceStatus, ExecutionBlocker, ExecutionDiagnostic, ExecutionSafetyGate, ExecutionSafetyGateKind, ExecutionStep } from '../../../contracts/execution-plans';

const needsProvider = new Set<ExecutionStep['kind']>(['generate-image','generate-text','embed-content','call-api','store-artifact','read-artifact']);
const plannedGate = (id:string, kind:ExecutionSafetyGateKind, stepId:string, adapterReferenceId?:string):ExecutionSafetyGate => ({ id, kind, status:'planned', label:`Planned ${kind}`, stepId, adapterReferenceId, blockers:[], diagnostics:[] });

export class ExecutionPlanProviderPlanningService {
  public plan(args:{ planId:string; sourceRuntimeReadinessBindingId:string; readiness:{selectedRuntimeBindings?:Array<{runtimeBindingId:string; providerKind?:string; capabilityKind?:string; status?:string; label?:string}>}; steps:ExecutionStep[]; createAdapterReferenceId:()=>string; createSafetyGateId:()=>string; }) {
    const adapterReferences:ExecutionAdapterReference[]=[]; const safetyGates:ExecutionSafetyGate[]=[]; const blockers:ExecutionBlocker[]=[]; const diagnostics:ExecutionDiagnostic[]=[];
    const selected = args.readiness.selectedRuntimeBindings ?? [];
    const steps = args.steps.map((step)=>{
      const binding = selected.find((b)=> (b.capabilityKind?.toLowerCase() ?? '').includes(step.kind.split('-')[1] ?? '')) ?? selected[0];
      let status:ExecutionAdapterReferenceStatus = binding ? 'available-by-readiness':'needs-setup';
      if (!needsProvider.has(step.kind)) status = 'planned';
      const kind:ExecutionAdapterReferenceKind = step.kind === 'call-api' ? 'api-adapter' : step.kind === 'store-artifact' ? 'storage-adapter' : step.kind === 'read-artifact' ? 'artifact-adapter' : step.kind === 'generate-image' ? 'model-adapter' : 'provider-adapter';
      const ar:ExecutionAdapterReference = { id: args.createAdapterReferenceId(), kind, status, sourceRuntimeReadinessBindingId: args.sourceRuntimeReadinessBindingId, sourceRuntimeBindingId: binding?.runtimeBindingId, providerKind: binding?.providerKind, capabilityKind: binding?.capabilityKind, label: binding?.label ?? `Planned adapter for ${step.kind}`, blockers:[], diagnostics:[] };
      adapterReferences.push(ar);
      if (needsProvider.has(step.kind) && !binding) blockers.push({ code:'execution-plan-provider-setup-required', message:'Provider setup selection required.', targetReferenceKind:'execution-step', targetReferenceId:step.id });
      const gates:ExecutionSafetyGateKind[]=['provider-setup-selected','required-input-available','output-destination-planned','no-unresolved-blockers','credentials-not-embedded','unsafe-details-redacted','executable-payload-deferred'];
      const created = gates.map((g)=>plannedGate(args.createSafetyGateId(), g, step.id, ar.id));
      safetyGates.push(...created);
      diagnostics.push({ code:'execution-plan-provider-planning-deferred', severity:'info', message:'Provider invocation remains deferred.', targetReferenceKind:'execution-step', targetReferenceId:step.id });
      return { ...step, requiredAdapterReferenceIds:[...step.requiredAdapterReferenceIds, ar.id], safetyGateIds:[...step.safetyGateIds, ...created.map((g)=>g.id)] };
    });
    return { steps, adapterReferences, safetyGates, blockers, diagnostics };
  }
}
