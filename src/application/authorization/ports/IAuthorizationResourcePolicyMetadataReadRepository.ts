import type {
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataLookupQuery,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationResourcePolicyMetadataReadRepository {
  findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined>;
}
