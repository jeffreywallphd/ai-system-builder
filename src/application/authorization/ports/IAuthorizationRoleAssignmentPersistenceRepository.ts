import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationRoleAssignmentPersistenceLookupQuery,
  AuthorizationRoleAssignmentPersistenceRecord,
  RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";

export interface IAuthorizationRoleAssignmentPersistenceRepository {
  findRoleAssignmentById(roleAssignmentId: string): Promise<AuthorizationRoleAssignmentPersistenceRecord | undefined>;
  listRoleAssignments(
    query: AuthorizationRoleAssignmentPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationRoleAssignmentPersistenceRecord>>;
  upsertRoleAssignment(
    input: UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>>;
  revokeRoleAssignment(
    input: RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>>;
}
