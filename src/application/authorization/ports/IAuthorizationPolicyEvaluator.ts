import type {
  AuthorizationPolicyEvaluatorRequest,
  AuthorizationPolicyEvaluatorResult,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationPolicyEvaluator {
  evaluatePolicy(
    request: AuthorizationPolicyEvaluatorRequest,
  ): Promise<AuthorizationPolicyEvaluatorResult>;
}
