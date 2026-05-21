import type { RuntimeBinding, RuntimeBindingCandidate, RuntimeReadinessDiagnostic, RuntimeRequirement } from "../../../contracts/runtime-readiness";

export class RuntimeBindingCandidateSelectionService {
  public select(input: { readinessBindingId: RuntimeBinding["readinessBindingId"]; targetWorkspaceId: RuntimeBinding["targetWorkspaceId"]; requirements: readonly RuntimeRequirement[]; candidates: readonly RuntimeBindingCandidate[]; nextBindingId: () => RuntimeBinding["bindingId"]; now: string }) {
    const bindings: RuntimeBinding[] = [];
    const diagnostics: RuntimeReadinessDiagnostic[] = [];
    for (const requirement of input.requirements.filter((item) => item.isRequired)) {
      const matches = input.candidates.filter((candidate) => candidate.requirementId === requirement.requirementId);
      if (matches.length === 1 && matches[0].matchStatus === "matched") {
        bindings.push({ bindingId: input.nextBindingId(), targetWorkspaceId: input.targetWorkspaceId, readinessBindingId: input.readinessBindingId, requirementId: requirement.requirementId, selectedProviderCandidateId: matches[0].providerCandidateId, selectedCapabilityId: matches[0].capabilityId, status: "selected", diagnostics: [], blockers: [], provenance: [], createdAt: input.now, updatedAt: input.now });
      } else if (matches.length > 1) diagnostics.push({ code: "runtime-readiness-binding-candidate-missing", severity: "warning", message: "Sanitized binding ambiguity diagnostic." });
    }
    return { bindings, diagnostics };
  }
}
