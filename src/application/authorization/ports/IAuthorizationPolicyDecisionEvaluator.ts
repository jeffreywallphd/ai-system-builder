import type {
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationPolicyDecisionEvaluator {
  evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult>;
}
