import type {
  AgentCostLimits,
  AgentExecutionLimits,
  AgentPolicy,
  AgentSafetyConstraint,
  AgentToolAccessPolicy,
} from "./AgentPolicy";
import { normalizeAgentPolicy } from "./AgentPolicy";

export type AgentPolicyConfigurationOperation =
  | { readonly type: "set-tool-access"; readonly toolAccess: AgentToolAccessPolicy }
  | { readonly type: "set-restricted-actions"; readonly restrictedActions: ReadonlyArray<string> }
  | { readonly type: "set-cost-limits"; readonly costLimits: AgentCostLimits }
  | { readonly type: "set-execution-limits"; readonly executionLimits: AgentExecutionLimits }
  | { readonly type: "set-safety-constraints"; readonly safetyConstraints: AgentSafetyConstraint }
  | { readonly type: "set-required-approvals"; readonly requiredApprovals: AgentSafetyConstraint["requiredApprovals"] }
  | { readonly type: "set-denied-permissions"; readonly deniedPermissionIds: AgentSafetyConstraint["deniedPermissionIds"] }
  | { readonly type: "set-sandbox-policy"; readonly sandbox: AgentSafetyConstraint["sandbox"] };

export function applyAgentPolicyConfiguration(
  policy: AgentPolicy,
  operations: ReadonlyArray<AgentPolicyConfigurationOperation>,
): AgentPolicy {
  const next = {
    toolAccess: policy.toolAccess,
    restrictedActions: policy.restrictedActions,
    costLimits: policy.costLimits,
    executionLimits: policy.executionLimits,
    safetyConstraints: policy.safetyConstraints,
  } as AgentPolicy;

  for (const operation of operations) {
    if (operation.type === "set-tool-access") {
      next.toolAccess = operation.toolAccess;
      continue;
    }
    if (operation.type === "set-restricted-actions") {
      next.restrictedActions = operation.restrictedActions;
      continue;
    }
    if (operation.type === "set-cost-limits") {
      next.costLimits = operation.costLimits;
      continue;
    }
    if (operation.type === "set-execution-limits") {
      next.executionLimits = operation.executionLimits;
      continue;
    }
    if (operation.type === "set-safety-constraints") {
      next.safetyConstraints = operation.safetyConstraints;
      continue;
    }
    if (operation.type === "set-required-approvals") {
      next.safetyConstraints = Object.freeze({
        ...next.safetyConstraints,
        requiredApprovals: operation.requiredApprovals,
      });
      continue;
    }
    if (operation.type === "set-denied-permissions") {
      next.safetyConstraints = Object.freeze({
        ...next.safetyConstraints,
        deniedPermissionIds: operation.deniedPermissionIds,
      });
      continue;
    }
    next.safetyConstraints = Object.freeze({
      ...next.safetyConstraints,
      sandbox: operation.sandbox,
    });
  }

  return normalizeAgentPolicy(next);
}
