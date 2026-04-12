import type {
  AuthorizationPolicyRecordedEvent,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationPolicyEventRecorder {
  recordPolicyEvaluationEvent(event: AuthorizationPolicyRecordedEvent): Promise<void>;
}
