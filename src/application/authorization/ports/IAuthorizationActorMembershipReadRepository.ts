import type {
  AuthorizationActorMembershipLookupQuery,
  AuthorizationActorMembershipRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationActorMembershipReadRepository {
  listActorMemberships(
    query: AuthorizationActorMembershipLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationActorMembershipRecord>>;
}
