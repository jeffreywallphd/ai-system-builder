import type { RuntimeBindingCandidate, RuntimeInventory, RuntimeReadinessBlocker, RuntimeReadinessDiagnostic, RuntimeRequirement } from "../../../contracts/runtime-readiness";

export class RuntimeCapabilityMatchingService {
  public match(input: { inventory: readonly RuntimeInventory[]; requirements: readonly RuntimeRequirement[]; targetWorkspaceId: RuntimeRequirement["targetWorkspaceId"]; nextBindingCandidateId: () => RuntimeBindingCandidate["bindingCandidateId"]; now: string }) {
    const candidates: RuntimeBindingCandidate[] = [];
    const blockers: RuntimeReadinessBlocker[] = [];
    const diagnostics: RuntimeReadinessDiagnostic[] = [];
    const providerCandidates = input.inventory.flatMap((record) => record.discoveredProviderCandidates);
    for (const requirement of input.requirements) {
      const matches = providerCandidates.flatMap((provider) => provider.capabilities.filter((capability) => capability.capabilityKind === requirement.capabilityKind && capability.capabilityKey === requirement.capabilityKey).map((capability) => ({ provider, capability })));
      if (matches.length === 0) {
        if (requirement.isRequired) blockers.push({ code: "runtime-readiness-capability-missing", message: "Sanitized runtime capability blocker." });
        else diagnostics.push({ code: "runtime-readiness-capability-missing", severity: "warning", message: "Sanitized runtime capability diagnostic." });
        continue;
      }
      for (const match of matches) {
        candidates.push({ bindingCandidateId: input.nextBindingCandidateId(), targetWorkspaceId: input.targetWorkspaceId, requirementId: requirement.requirementId, providerCandidateId: match.provider.providerCandidateId, capabilityId: match.capability.capabilityId, matchStatus: match.provider.availabilityStatus === "available" ? "matched" : "provider-unavailable", blockers: [], diagnostics: [], createdAt: input.now, updatedAt: input.now });
      }
    }
    return { candidates, blockers, diagnostics, providerCandidates };
  }
}
