import type {
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationSharingGrantReadRepository {
  listSharingGrants(
    query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>>;
}
