import type { AssetCompositionPlan } from "../../../contracts/asset-composition";
import type { RuntimeReadinessDiagnostic, RuntimeRequirement } from "../../../contracts/runtime-readiness";

export class RuntimeRequirementExtractionService {
  public extractRequirements(input: { plan: AssetCompositionPlan; nextRequirementId: () => RuntimeRequirement["requirementId"]; now: string }): { requirements: RuntimeRequirement[]; diagnostics: RuntimeReadinessDiagnostic[] } {
    const requirements: RuntimeRequirement[] = [];
    const diagnostics: RuntimeReadinessDiagnostic[] = [];
    for (const node of input.plan.nodes) {
      for (const capability of node.requiredCapabilities ?? []) {
        requirements.push({
          requirementId: input.nextRequirementId(), targetWorkspaceId: input.plan.targetWorkspaceId, compositionPlanId: input.plan.planId,
          sourceNodeId: node.nodeId, capabilityKind: capability.capabilityKind, capabilityKey: capability.capabilityKey,
          isRequired: capability.isRequired, label: `${capability.capabilityKind}:${capability.capabilityKey}`.slice(0, 80), diagnostics: [], blockers: [],
        });
      }
    }
    for (const relationship of input.plan.relationships) {
      for (const capability of relationship.requiredCapabilities ?? []) {
        requirements.push({ requirementId: input.nextRequirementId(), targetWorkspaceId: input.plan.targetWorkspaceId, compositionPlanId: input.plan.planId, sourceRelationshipId: relationship.relationshipId, capabilityKind: capability.capabilityKind, capabilityKey: capability.capabilityKey, isRequired: capability.isRequired, label: `${capability.capabilityKind}:${capability.capabilityKey}`.slice(0, 80), diagnostics: [], blockers: [] });
      }
    }
    if (requirements.length === 0) diagnostics.push({ code: "runtime-readiness-requirement-missing", severity: "warning", message: "Sanitized runtime requirement extraction diagnostic." });
    return { requirements, diagnostics };
  }
}
