import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
} from "../contracts/AuthorizationPolicyEvaluationContracts";

export interface IAuthorizationRoleGrantReadRepository {
  getActorRoleGrantSnapshot(
    query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot>;
}
