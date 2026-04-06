import type {
  ResourceOwnershipScope,
  ResourceVisibility,
  RoleAssignmentScope,
  RoleAssignmentStatus,
  SharingPolicyMode,
  SharingSubject,
} from "../../../domain/authorization/AuthorizationDomain";
import type { AuthorizationRoleKey } from "../../../domain/authorization/AuthorizationDomain";
import type { PermissionKey } from "../../../domain/authorization/AuthorizationDomain";
import type { AuthorizationResourceFamily } from "../../../domain/authorization/AuthorizationPermissionCatalog";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export interface AuthorizationPersistenceAuditStamp {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface AuthorizationPersistenceWriteContext {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AuthorizationPersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: AuthorizationPersistenceWriteContext;
}

export interface AuthorizationPersistenceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export interface AuthorizationPersistenceResourceLocator {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}

export interface AuthorizationRoleAssignmentPersistenceRecord
  extends AuthorizationPersistenceAuditStamp {
  readonly id: string;
  readonly actorUserIdentityId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly scope: RoleAssignmentScope;
  readonly workspaceId?: string;
  readonly resourceFamily?: AuthorizationResourceFamily;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly status: RoleAssignmentStatus;
  readonly assignedAt: string;
  readonly assignedByUserIdentityId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly revision: number;
}

export interface AuthorizationRoleAssignmentPersistenceLookupQuery {
  readonly workspaceId?: string;
  readonly actorUserIdentityId?: string;
  readonly roleKey?: AuthorizationRoleKey;
  readonly scope?: RoleAssignmentScope;
  readonly resourceFamily?: AuthorizationResourceFamily;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly statuses?: ReadonlyArray<RoleAssignmentStatus>;
  readonly asOf?: string;
  readonly includeRevoked?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpsertAuthorizationRoleAssignmentPersistenceRecordInput {
  readonly record: AuthorizationRoleAssignmentPersistenceRecord;
  readonly mutation: AuthorizationPersistenceMutationEnvelope;
}

export interface RevokeAuthorizationRoleAssignmentPersistenceRecordInput {
  readonly roleAssignmentId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly mutation: AuthorizationPersistenceMutationEnvelope;
}

export interface AuthorizationSharingGrantPersistenceRecord
  extends AuthorizationPersistenceAuditStamp {
  readonly id: string;
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
  readonly subject: SharingSubject;
  readonly permissionKeys: ReadonlyArray<PermissionKey>;
  readonly grantedAt: string;
  readonly grantedByUserIdentityId: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly revision: number;
}

export interface AuthorizationSharingGrantPersistenceLookupQuery {
  readonly resource?: AuthorizationPersistenceResourceLocator;
  readonly workspaceId?: string;
  readonly subjectUserIdentityId?: string;
  readonly subjectWorkspaceId?: string;
  readonly subjectRoleKey?: AuthorizationRoleKey;
  readonly asOf?: string;
  readonly includeRevoked?: boolean;
  readonly includeExpired?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpsertAuthorizationSharingGrantPersistenceRecordInput {
  readonly record: AuthorizationSharingGrantPersistenceRecord;
  readonly mutation: AuthorizationPersistenceMutationEnvelope;
}

export interface RevokeAuthorizationSharingGrantPersistenceRecordInput {
  readonly sharingGrantId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly mutation: AuthorizationPersistenceMutationEnvelope;
}

export interface AuthorizationResourcePolicyMetadataPersistenceRecord
  extends AuthorizationPersistenceAuditStamp {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerUserIdentityId: string;
  readonly ownershipScope: ResourceOwnershipScope;
  readonly workspaceId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly allowResharing: boolean;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
  readonly deletedAt?: string;
  readonly deletedByUserIdentityId?: string;
  readonly revision: number;
}

export interface AuthorizationResourcePolicyMetadataPersistenceLookupQuery {
  readonly resource?: AuthorizationPersistenceResourceLocator;
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly visibility?: ResourceVisibility;
  readonly includeDeleted?: boolean;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput {
  readonly record: AuthorizationResourcePolicyMetadataPersistenceRecord;
  readonly mutation: AuthorizationPersistenceMutationEnvelope;
}

export interface SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput {
  readonly resource: AuthorizationPersistenceResourceLocator;
  readonly deletedAt?: string;
  readonly deletedByUserIdentityId?: string;
  readonly mutation: AuthorizationPersistenceMutationEnvelope;
}

export function toAuthorizationResourceLookupKey(locator: AuthorizationPersistenceResourceLocator): string {
  return `${locator.resourceFamily}:${locator.resourceType}:${locator.resourceId}`;
}

export function toAuthorizationSharingSubjectLookupKey(subject: SharingSubject): string {
  switch (subject.kind) {
    case "user":
      return `user:${subject.userIdentityId}`;
    case "workspace-role":
      return `workspace-role:${subject.workspaceId}:${subject.roleKey}`;
    case "workspace":
      return `workspace:${subject.workspaceId}`;
    case "public":
      return "public";
    default:
      return "unknown";
  }
}

export function normalizeAuthorizationMutationOperationKey(operationKey: string): string {
  try {
    return normalizePersistenceOperationKey(operationKey);
  } catch {
    throw new Error("Authorization persistence mutation operationKey is required.");
  }
}
