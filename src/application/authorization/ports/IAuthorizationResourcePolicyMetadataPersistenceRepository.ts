import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationPersistenceResourceLocator,
  AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  AuthorizationResourcePolicyMetadataPersistenceRecord,
  SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";

export interface IAuthorizationResourcePolicyMetadataPersistenceRepository {
  findResourcePolicyMetadata(
    resource: AuthorizationPersistenceResourceLocator,
  ): Promise<AuthorizationResourcePolicyMetadataPersistenceRecord | undefined>;
  listResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadataPersistenceRecord>>;
  upsertResourcePolicyMetadata(
    input: UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>>;
  softDeleteResourcePolicyMetadata(
    input: SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>>;
}
