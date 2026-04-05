import type {
  AuthorizationPolicyEvaluationRecordedEvent,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationPolicyEventRecorder {
  recordPolicyEvaluationEvent(event: AuthorizationPolicyEvaluationRecordedEvent): Promise<void>;
}
