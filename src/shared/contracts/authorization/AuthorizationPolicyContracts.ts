import type {
  ActorContext,
  PermissionKey,
  PolicyDecision,
  ResourcePolicyContext,
} from "../../../domain/authorization/AuthorizationDomain";

export interface AuthorizationPolicyEvaluationRequest {
  readonly actor: ActorContext;
  readonly resource: ResourcePolicyContext;
  readonly requiredPermissionKey: PermissionKey;
  readonly asOf?: string;
}

export interface AuthorizationPolicyEvaluationResult {
  readonly decision: PolicyDecision;
}
