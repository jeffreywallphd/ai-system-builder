import type { RuntimeReadinessBinding, RuntimeReadinessBlocker, RuntimeReadinessDiagnostic, RuntimeReadinessStatus } from "../../../contracts/runtime-readiness";

const statusPriority: RuntimeReadinessStatus[] = [
  "invalid","blocked","missing-requirements","provider-unavailable","provider-unsupported","configuration-required","permission-required","stale","ready-for-setup","draft",
];

const pushBlocker = (list: RuntimeReadinessBlocker[], code: RuntimeReadinessBlocker["code"], message: string, safeDetails?: Record<string, string>) => {
  list.push({ code, message, ...(safeDetails ? { safeDetails } : {}) });
};
const pushDiagnostic = (list: RuntimeReadinessDiagnostic[], code: RuntimeReadinessDiagnostic["code"], severity: RuntimeReadinessDiagnostic["severity"], message: string) => {
  list.push({ code, severity, message });
};

export class RuntimeReadinessValidationService {
  public validate(binding: RuntimeReadinessBinding, targetWorkspaceId: string): { status: RuntimeReadinessStatus; blockers: RuntimeReadinessBlocker[]; diagnostics: RuntimeReadinessDiagnostic[]; bindings: RuntimeReadinessBinding["bindings"] } {
    const blockers: RuntimeReadinessBlocker[] = [];
    const diagnostics: RuntimeReadinessDiagnostic[] = [];

    if (binding.targetWorkspaceId !== targetWorkspaceId) {
      pushBlocker(blockers, "runtime-readiness-workspace-invalid", "Readiness binding workspace mismatch.");
    }
    if (!binding.compositionPlanId) {
      pushBlocker(blockers, "runtime-readiness-composition-plan-required", "Readiness binding does not reference a composition plan.");
    }

    const requirementsById = new Map(binding.requirements.map((item) => [item.requirementId, item]));
    const providersById = new Map(binding.providerCandidates.map((item) => [item.providerCandidateId, item]));
    const availabilityByRequirement = new Map<string, RuntimeReadinessStatus[]>();

    for (const candidate of binding.bindingCandidates) {
      if (!requirementsById.has(candidate.requirementId)) pushBlocker(blockers, "runtime-readiness-requirement-missing", "Binding candidate references unknown requirement.");
      if (!providersById.has(candidate.providerCandidateId)) pushBlocker(blockers, "runtime-readiness-provider-missing", "Binding candidate references unknown provider candidate.");
    }

    const nextBindings = binding.bindings.map((item) => {
      const requirement = requirementsById.get(item.requirementId);
      const provider = providersById.get(item.selectedProviderCandidateId);
      let status = item.status;
      if (!requirement) {
        pushBlocker(blockers, "runtime-readiness-requirement-missing", "Selected binding references unknown requirement.");
        status = "invalid";
      }
      if (!provider) {
        pushBlocker(blockers, "runtime-readiness-provider-missing", "Selected binding references unknown provider candidate.");
        status = "invalid";
      }
      if (provider && ["unavailable", "not-installed", "error", "unknown"].includes(provider.availabilityStatus)) {
        if (requirement?.isRequired) pushBlocker(blockers, "runtime-readiness-provider-unavailable", "Required provider candidate is unavailable."); else pushDiagnostic(diagnostics, "runtime-readiness-provider-unavailable", "warning", "Optional provider candidate is unavailable.");
        status = "provider-unavailable";
        availabilityByRequirement.set(item.requirementId, [...(availabilityByRequirement.get(item.requirementId) ?? []), "provider-unavailable"]);
      }
      if (provider?.availabilityStatus === "unsupported") { if (requirement?.isRequired) pushBlocker(blockers, "runtime-readiness-capability-unsupported", "Required provider candidate is unsupported."); status = "unsupported"; availabilityByRequirement.set(item.requirementId,[...(availabilityByRequirement.get(item.requirementId)??[]),"provider-unsupported"]); }
      if (provider?.availabilityStatus === "not-configured") { if (requirement?.isRequired) pushBlocker(blockers,"runtime-readiness-configuration-required","Provider configuration is required."); status = "configuration-required"; availabilityByRequirement.set(item.requirementId,[...(availabilityByRequirement.get(item.requirementId)??[]),"configuration-required"]); }
      if (provider?.availabilityStatus === "permission-required") { if (requirement?.isRequired) pushBlocker(blockers,"runtime-readiness-permission-required","Provider permission is required."); status = "permission-required"; availabilityByRequirement.set(item.requirementId,[...(availabilityByRequirement.get(item.requirementId)??[]),"permission-required"]); }
      if (provider?.availabilityStatus === "stale") { if (requirement?.isRequired) pushBlocker(blockers,"runtime-readiness-inventory-stale","Runtime inventory is stale for required binding."); else pushDiagnostic(diagnostics,"runtime-readiness-inventory-stale","warning","Optional provider inventory is stale."); status = "stale"; availabilityByRequirement.set(item.requirementId,[...(availabilityByRequirement.get(item.requirementId)??[]),"stale"]); }
      return { ...item, status };
    });

    for (const requirement of binding.requirements) {
      if (requirement.targetWorkspaceId !== binding.targetWorkspaceId) pushBlocker(blockers, "runtime-readiness-workspace-invalid", "Requirement workspace mismatch.");
      if (requirement.compositionPlanId !== binding.compositionPlanId) pushBlocker(blockers, "runtime-readiness-composition-plan-not-valid", "Requirement composition plan mismatch.");
      const candidateCount = binding.bindingCandidates.filter((c) => c.requirementId === requirement.requirementId).length;
      const selectedCount = nextBindings.filter((c) => c.requirementId === requirement.requirementId && ["selected","bound"].includes(c.status)).length;
      if (candidateCount + selectedCount === 0) {
        if (requirement.isRequired) pushBlocker(blockers, "runtime-readiness-capability-missing", "Required capability has no runtime candidate.", { capabilityKey: requirement.capabilityKey });
        else pushDiagnostic(diagnostics, "runtime-readiness-capability-missing", "warning", "Optional capability has no runtime candidate.");
      }
      if (selectedCount > 1 && requirement.isRequired) pushBlocker(blockers, "runtime-readiness-binding-candidate-missing", "Conflicting selected bindings found for one required capability.");
    }

    const has = (s: RuntimeReadinessStatus) => blockers.some((b) => ({
      invalid:["runtime-readiness-workspace-invalid","runtime-readiness-requirement-missing","runtime-readiness-provider-missing"],
      blocked:["runtime-readiness-composition-plan-not-valid","runtime-readiness-composition-plan-missing"],
      "missing-requirements":["runtime-readiness-capability-missing","runtime-readiness-model-missing"],
      "provider-unavailable":["runtime-readiness-provider-unavailable","runtime-readiness-provider-not-installed"],
      "provider-unsupported":["runtime-readiness-capability-unsupported","runtime-readiness-provider-missing"],
      "configuration-required":["runtime-readiness-configuration-required","runtime-readiness-provider-not-configured"],
      "permission-required":["runtime-readiness-permission-required","runtime-readiness-provider-permission-required"],
      stale:["runtime-readiness-inventory-stale","runtime-readiness-composition-plan-stale"],
      "ready-for-setup":[], draft:[]
    }[s] as string[]).includes(b.code));

    const status = statusPriority.find((s) => s === "ready-for-setup" ? blockers.length === 0 && binding.requirements.filter((x)=>x.isRequired).every((r)=>nextBindings.some((b)=>b.requirementId===r.requirementId&&["selected","bound"].includes(b.status))) : has(s)) ?? "draft";
    return { status, blockers, diagnostics, bindings: nextBindings };
  }
}
