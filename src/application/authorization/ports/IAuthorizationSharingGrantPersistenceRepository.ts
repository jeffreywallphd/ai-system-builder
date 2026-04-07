import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationSharingGrantPersistenceLookupQuery,
  AuthorizationSharingGrantPersistenceRecord,
  RevokeAuthorizationSharingGrantPersistenceRecordInput,
  UpsertAuthorizationSharingGrantPersistenceRecordInput,
} from "@shared/dto/authorization/AuthorizationPersistenceDtos";

export interface IAuthorizationSharingGrantPersistenceRepository {
  findSharingGrantById(sharingGrantId: string): Promise<AuthorizationSharingGrantPersistenceRecord | undefined>;
  listSharingGrants(
    query: AuthorizationSharingGrantPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantPersistenceRecord>>;
  upsertSharingGrant(
    input: UpsertAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>>;
  revokeSharingGrant(
    input: RevokeAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>>;
}

