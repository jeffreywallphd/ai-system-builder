import {
  type OfflineResourceClass,
  type OfflineResourcePolicyEvaluation,
  type OfflineResourcePolicyEvaluationInput,
  evaluateOfflineResourcePolicy,
  listOfflineResourceEligibilityPolicies,
} from "@domain/platform/OfflineLocalModeBoundaries";

export interface OfflineResourceClassificationRequest {
  readonly resourceClass: OfflineResourceClass | string;
  readonly policy: OfflineResourcePolicyEvaluationInput;
}

export function classifyOfflineResourceLocalModePolicy(
  request: OfflineResourceClassificationRequest,
): OfflineResourcePolicyEvaluation {
  return evaluateOfflineResourcePolicy(request.resourceClass, request.policy);
}

export function classifyOfflineResourcePolicyMatrix(input: {
  readonly policy: OfflineResourcePolicyEvaluationInput;
}): ReadonlyArray<OfflineResourcePolicyEvaluation> {
  return Object.freeze(
    listOfflineResourceEligibilityPolicies().map((entry) => (
      classifyOfflineResourceLocalModePolicy({
        resourceClass: entry.resourceClass,
        policy: input.policy,
      })
    )),
  );
}
