import type {
  ExecutionAdapterReference,
  ExecutionAdapterReferenceKind,
  ExecutionBlocker,
  ExecutionDiagnostic,
  ExecutionSafetyGate,
  ExecutionSafetyGateKind,
  ExecutionStep
} from "../../../contracts/execution-plans";

type PlannerResult = {
  adapterReferences: ExecutionAdapterReference[];
  safetyGates: ExecutionSafetyGate[];
  blockers: ExecutionBlocker[];
  diagnostics: ExecutionDiagnostic[];
  statusHint?: ExecutionStep["status"];
};

type PlannerInput = {
  planId: string;
  sourceRuntimeReadinessBindingId: string;
  step: ExecutionStep;
  createAdapterReferenceId: () => string;
  createSafetyGateId: () => string;
};

interface ExecutionPlanProviderPlanner {
  canPlan(input: PlannerInput): boolean;
  plan(input: PlannerInput): PlannerResult;
}

const gate = (id: string, kind: ExecutionSafetyGateKind, stepId: string): ExecutionSafetyGate => ({ id: id as never, kind, status: "planned", label: `Planned ${kind}`, stepId: stepId as never, blockers: [], diagnostics: [] });
const diag = (code: string, message: string, step: ExecutionStep): ExecutionDiagnostic => ({ code, severity: "warning", message, targetReferenceKind: "execution-step", targetReferenceId: step.id });
const blocker = (code: string, message: string, step: ExecutionStep): ExecutionBlocker => ({ code, message, targetReferenceKind: "execution-step", targetReferenceId: step.id });
const adapter = (id: string, kind: ExecutionAdapterReferenceKind, input: PlannerInput, label: string, providerKind?: string, capabilityKind?: string): ExecutionAdapterReference => ({
  id: id as never, kind, status: "planned", sourceRuntimeReadinessBindingId: input.sourceRuntimeReadinessBindingId, sourceRuntimeBindingId: `${input.step.id}`, label, providerKind, capabilityKind, blockers: [], diagnostics: []
});

class KindPlanner implements ExecutionPlanProviderPlanner {
  public constructor(private readonly kinds: ExecutionStep["kind"][], private readonly planFn: (input: PlannerInput) => PlannerResult) {}
  public canPlan(input: PlannerInput): boolean { return this.kinds.includes(input.step.kind); }
  public plan(input: PlannerInput): PlannerResult { return this.planFn(input); }
}

export class ExecutionPlanProviderPlannerRegistryService {
  private readonly planners: ExecutionPlanProviderPlanner[];
  public constructor() {
    this.planners = [
      new KindPlanner(["generate-image"], (input) => {
        const hasComfy = /comfy/ui.test(input.step.summary ?? "");
        const providerUnknown = /unknown-provider/i.test(input.step.summary ?? "");
        const refs = [adapter(input.createAdapterReferenceId(), hasComfy ? "comfyui-adapter" : "model-adapter", input, "Planned image provider adapter", hasComfy ? "comfyui" : "model-provider", "image-generation")];
        const safetyGates = ["provider-setup-selected", "output-destination-planned", "no-unresolved-blockers", "execution-preview-reviewed", "executable-payload-deferred"].map((k) => gate(input.createSafetyGateId(), k as ExecutionSafetyGateKind, input.step.id));
        const diagnostics = [diag("execution-plan-model-planning-deferred", "Image execution planning is deferred.", input), diag("execution-plan-executable-payload-deferred", "Executable payload generation is deferred.", input)];
        const blockers = providerUnknown ? [blocker("execution-plan-provider-setup-required", "Provider setup must be selected before execution handoff.", input.step)] : [];
        if (providerUnknown) diagnostics.push(diag("execution-plan-provider-reference-missing", "Image provider reference missing.", input.step));
        return { adapterReferences: refs, safetyGates, diagnostics, blockers, statusHint: providerUnknown ? "needs-provider-setup" : "planned" };
      }),
      new KindPlanner(["generate-text"], (input) => ({ adapterReferences: [adapter(input.createAdapterReferenceId(), "provider-adapter", input, "Planned text provider adapter", "llm-provider", "text-generation")], safetyGates: ["provider-setup-selected", "policy-review-required", "execution-preview-reviewed", "executable-payload-deferred"].map((k) => gate(input.createSafetyGateId(), k as ExecutionSafetyGateKind, input.step.id)), blockers: [], diagnostics: [diag("execution-plan-model-planning-deferred", "Text provider planning is deferred.", input)], statusHint: "planned" })),
      new KindPlanner(["embed-content"], (input) => ({ adapterReferences: [adapter(input.createAdapterReferenceId(), "model-adapter", input, "Planned embedding adapter", "embedding-provider", "embedding")], safetyGates: ["required-input-available", "output-destination-planned", "provider-setup-selected"].map((k) => gate(input.createSafetyGateId(), k as ExecutionSafetyGateKind, input.step.id)), blockers: [], diagnostics: [diag("execution-plan-provider-invocation-deferred", "Embedding invocation is deferred.", input)], statusHint: "planned" })),
      new KindPlanner(["store-artifact", "read-artifact"], (input) => ({ adapterReferences: [adapter(input.createAdapterReferenceId(), input.step.kind === "store-artifact" ? "storage-adapter" : "artifact-adapter", input, "Planned artifact/storage adapter", "storage-provider", input.step.kind)], safetyGates: ["storage-destination-safe", "output-destination-planned", "required-input-available"].map((k) => gate(input.createSafetyGateId(), k as ExecutionSafetyGateKind, input.step.id)), blockers: [], diagnostics: [diag("execution-plan-storage-planning-deferred", "Storage planning is deferred.", input)], statusHint: "planned" })),
      new KindPlanner(["call-api"], (input) => ({ adapterReferences: [adapter(input.createAdapterReferenceId(), "api-adapter", input, "Planned API adapter", "api-provider", "api-service")], safetyGates: ["provider-setup-selected", "credentials-not-embedded", "policy-review-required", "executable-payload-deferred"].map((k) => gate(input.createSafetyGateId(), k as ExecutionSafetyGateKind, input.step.id)), blockers: [], diagnostics: [diag("execution-plan-api-planning-deferred", "API execution planning is deferred.", input)], statusHint: "planned" })),
      new KindPlanner(["manual-review", "transform-data", "validate-output", "compose-output", "prepare-input", "provider-setup-check", "runtime-setup-check", "safety-check"], (input) => ({ adapterReferences: [adapter(input.createAdapterReferenceId(), "manual-adapter", input, "Manual or deferred provider planning", "manual", input.step.kind)], safetyGates: [gate(input.createSafetyGateId(), "user-review-required", input.step.id), gate(input.createSafetyGateId(), "executable-payload-deferred", input.step.id)], blockers: input.step.kind === "manual-review" ? [blocker("execution-plan-provider-planning-deferred", "Manual review required for unsupported step planning.", input.step)] : [], diagnostics: [diag("execution-plan-manual-review-required", "Manual provider planning is required.", input)], statusHint: input.step.kind === "manual-review" ? "needs-review" : "deferred" }))
    ];
  }
  public select(input: PlannerInput): ExecutionPlanProviderPlanner {
    return this.planners.find((p) => p.canPlan(input)) ?? this.planners[this.planners.length - 1];
  }
}

export class ExecutionPlanProviderPlanningService {
  private readonly registry = new ExecutionPlanProviderPlannerRegistryService();
  public plan(args: { planId: string; sourceRuntimeReadinessBindingId: string; steps: ExecutionStep[]; createAdapterReferenceId: () => string; createSafetyGateId: () => string; }) {
    const adapterReferences: ExecutionAdapterReference[] = [];
    const safetyGates: ExecutionSafetyGate[] = [];
    const blockers: ExecutionBlocker[] = [];
    const diagnostics: ExecutionDiagnostic[] = [];
    const steps = args.steps.map((step) => {
      const input: PlannerInput = { ...args, step };
      const result = this.registry.select(input).plan(input);
      adapterReferences.push(...result.adapterReferences);
      safetyGates.push(...result.safetyGates);
      blockers.push(...result.blockers);
      diagnostics.push(...result.diagnostics);
      return { ...step, status: result.statusHint ?? step.status, requiredAdapterReferenceIds: result.adapterReferences.map((r) => r.id), safetyGateIds: result.safetyGates.map((g) => g.id), blockers: [...step.blockers, ...result.blockers], diagnostics: [...step.diagnostics, ...result.diagnostics] };
    });
    return { steps, adapterReferences, safetyGates, blockers, diagnostics };
  }
}
