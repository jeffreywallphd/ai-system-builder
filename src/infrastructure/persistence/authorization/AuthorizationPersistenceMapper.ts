import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
  SharingSubjectKinds,
  type ResourceOwnershipScope,
  type ResourceVisibility,
  type RoleAssignmentScope,
  type RoleAssignmentStatus,
  type SharingPolicyMode,
  type SharingSubject,
} from "../../../domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
  type AuthorizationResourceFamily,
} from "../../../domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationResourcePolicyMetadataPersistenceRecord,
  AuthorizationRoleAssignmentPersistenceRecord,
  AuthorizationSharingGrantPersistenceRecord,
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";

export interface AuthorizationRoleAssignmentRow {
  readonly role_assignment_id: string;
  readonly actor_user_identity_id: string;
  readonly role_key: string;
  readonly scope: RoleAssignmentScope;
  readonly workspace_id: string | null;
  readonly resource_family: AuthorizationResourceFamily | null;
  readonly resource_type: string | null;
  readonly resource_id: string | null;
  readonly status: RoleAssignmentStatus;
  readonly assigned_at: string;
  readonly assigned_by_user_identity_id: string;
  readonly revoked_at: string | null;
  readonly revoked_by_user_identity_id: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface AuthorizationSharingGrantRow {
  readonly sharing_grant_id: string;
  readonly resource_family: AuthorizationResourceFamily;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly workspace_id: string | null;
  readonly subject_kind: SharingSubject["kind"];
  readonly subject_user_identity_id: string | null;
  readonly subject_workspace_id: string | null;
  readonly subject_role_key: string | null;
  readonly permission_keys_json: string;
  readonly granted_at: string;
  readonly granted_by_user_identity_id: string;
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly revoked_by_user_identity_id: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface AuthorizationResourcePolicyMetadataRow {
  readonly resource_family: AuthorizationResourceFamily;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly owner_user_identity_id: string;
  readonly ownership_scope: ResourceOwnershipScope;
  readonly workspace_id: string | null;
  readonly visibility: ResourceVisibility;
  readonly sharing_policy_mode: SharingPolicyMode;
  readonly allow_resharing: number;
  readonly is_published_capable: number;
  readonly published_at: string | null;
  readonly deleted_at: string | null;
  readonly deleted_by_user_identity_id: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface AuthorizationMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: "role-assignment" | "sharing-grant" | "resource-policy";
  readonly record_snapshot_json: string;
  readonly created_at: string;
}

export function mapRoleAssignmentRowToRecord(row: AuthorizationRoleAssignmentRow): AuthorizationRoleAssignmentPersistenceRecord {
  return Object.freeze({
    id: row.role_assignment_id,
    actorUserIdentityId: row.actor_user_identity_id,
    roleKey: row.role_key,
    scope: assertRoleAssignmentScope(row.scope),
    workspaceId: row.workspace_id ?? undefined,
    resourceFamily: row.resource_family ? assertAuthorizationResourceFamily(row.resource_family) : undefined,
    resourceType: row.resource_type ?? undefined,
    resourceId: row.resource_id ?? undefined,
    status: assertRoleAssignmentStatus(row.status),
    assignedAt: row.assigned_at,
    assignedByUserIdentityId: row.assigned_by_user_identity_id,
    revokedAt: row.revoked_at ?? undefined,
    revokedByUserIdentityId: row.revoked_by_user_identity_id ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  });
}

export function mapRoleAssignmentRecordToRowValues(
  record: AuthorizationRoleAssignmentPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.id,
    record.actorUserIdentityId,
    record.roleKey,
    record.scope,
    record.workspaceId ?? null,
    record.resourceFamily ?? null,
    record.resourceType ?? null,
    record.resourceId ?? null,
    record.status,
    record.assignedAt,
    record.assignedByUserIdentityId,
    record.revokedAt ?? null,
    record.revokedByUserIdentityId ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapSharingGrantRowToRecord(row: AuthorizationSharingGrantRow): AuthorizationSharingGrantPersistenceRecord {
  return Object.freeze({
    id: row.sharing_grant_id,
    resourceFamily: assertAuthorizationResourceFamily(row.resource_family),
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    workspaceId: row.workspace_id ?? undefined,
    subject: toSharingSubject(row),
    permissionKeys: parsePermissionKeysJson(row.permission_keys_json),
    grantedAt: row.granted_at,
    grantedByUserIdentityId: row.granted_by_user_identity_id,
    expiresAt: row.expires_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    revokedByUserIdentityId: row.revoked_by_user_identity_id ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  });
}

export function mapSharingGrantRecordToRowValues(
  record: AuthorizationSharingGrantPersistenceRecord,
): ReadonlyArray<unknown> {
  const subjectColumns = toSharingSubjectRowColumns(record.subject);
  return Object.freeze([
    record.id,
    record.resourceFamily,
    record.resourceType,
    record.resourceId,
    record.workspaceId ?? null,
    subjectColumns.kind,
    subjectColumns.userIdentityId,
    subjectColumns.workspaceId,
    subjectColumns.roleKey,
    JSON.stringify(record.permissionKeys),
    record.grantedAt,
    record.grantedByUserIdentityId,
    record.expiresAt ?? null,
    record.revokedAt ?? null,
    record.revokedByUserIdentityId ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapResourcePolicyMetadataRowToRecord(
  row: AuthorizationResourcePolicyMetadataRow,
): AuthorizationResourcePolicyMetadataPersistenceRecord {
  return Object.freeze({
    resourceFamily: assertAuthorizationResourceFamily(row.resource_family),
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ownerUserIdentityId: row.owner_user_identity_id,
    ownershipScope: assertResourceOwnershipScope(row.ownership_scope),
    workspaceId: row.workspace_id ?? undefined,
    visibility: assertResourceVisibility(row.visibility),
    sharingPolicyMode: assertSharingPolicyMode(row.sharing_policy_mode),
    allowResharing: row.allow_resharing === 1,
    isPublishedCapable: row.is_published_capable === 1,
    publishedAt: row.published_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    deletedByUserIdentityId: row.deleted_by_user_identity_id ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  });
}

export function mapResourcePolicyMetadataRecordToRowValues(
  record: AuthorizationResourcePolicyMetadataPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.resourceFamily,
    record.resourceType,
    record.resourceId,
    record.ownerUserIdentityId,
    record.ownershipScope,
    record.workspaceId ?? null,
    record.visibility,
    record.sharingPolicyMode,
    record.allowResharing ? 1 : 0,
    record.isPublishedCapable ? 1 : 0,
    record.publishedAt ?? null,
    record.deletedAt ?? null,
    record.deletedByUserIdentityId ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function normalizeAuthorizationLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function parseMutationReplayRecord<TRecord>(row: AuthorizationMutationReplayRow): TRecord {
  try {
    return JSON.parse(row.record_snapshot_json) as TRecord;
  } catch {
    throw new Error(
      `Authorization mutation replay snapshot for operation '${row.operation_key}' is malformed.`,
    );
  }
}

function parsePermissionKeysJson(value: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }
    const keys = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return Object.freeze([...new Set(keys)]);
  } catch {
    return Object.freeze([]);
  }
}

function toSharingSubject(row: AuthorizationSharingGrantRow): SharingSubject {
  switch (row.subject_kind) {
    case SharingSubjectKinds.user:
      if (!row.subject_user_identity_id) {
        throw new Error("Persisted sharing subject kind 'user' is missing subject_user_identity_id.");
      }
      return Object.freeze({
        kind: SharingSubjectKinds.user,
        userIdentityId: row.subject_user_identity_id,
      });
    case SharingSubjectKinds.workspaceRole:
      if (!row.subject_workspace_id || !row.subject_role_key) {
        throw new Error("Persisted sharing subject kind 'workspace-role' is missing workspace or role fields.");
      }
      return Object.freeze({
        kind: SharingSubjectKinds.workspaceRole,
        workspaceId: row.subject_workspace_id,
        roleKey: row.subject_role_key,
      });
    case SharingSubjectKinds.workspace:
      if (!row.subject_workspace_id) {
        throw new Error("Persisted sharing subject kind 'workspace' is missing subject_workspace_id.");
      }
      return Object.freeze({
        kind: SharingSubjectKinds.workspace,
        workspaceId: row.subject_workspace_id,
      });
    case SharingSubjectKinds.public:
      return Object.freeze({
        kind: SharingSubjectKinds.public,
      });
    default:
      throw new Error(`Persisted sharing subject kind '${String(row.subject_kind)}' is invalid.`);
  }
}

function toSharingSubjectRowColumns(subject: SharingSubject): {
  readonly kind: SharingSubject["kind"];
  readonly userIdentityId: string | null;
  readonly workspaceId: string | null;
  readonly roleKey: string | null;
} {
  switch (subject.kind) {
    case SharingSubjectKinds.user:
      return Object.freeze({
        kind: SharingSubjectKinds.user,
        userIdentityId: subject.userIdentityId,
        workspaceId: null,
        roleKey: null,
      });
    case SharingSubjectKinds.workspaceRole:
      return Object.freeze({
        kind: SharingSubjectKinds.workspaceRole,
        userIdentityId: null,
        workspaceId: subject.workspaceId,
        roleKey: subject.roleKey,
      });
    case SharingSubjectKinds.workspace:
      return Object.freeze({
        kind: SharingSubjectKinds.workspace,
        userIdentityId: null,
        workspaceId: subject.workspaceId,
        roleKey: null,
      });
    case SharingSubjectKinds.public:
      return Object.freeze({
        kind: SharingSubjectKinds.public,
        userIdentityId: null,
        workspaceId: null,
        roleKey: null,
      });
    default:
      return Object.freeze({
        kind: SharingSubjectKinds.public,
        userIdentityId: null,
        workspaceId: null,
        roleKey: null,
      });
  }
}

function assertRoleAssignmentScope(value: string): RoleAssignmentScope {
  if (Object.values(RoleAssignmentScopes).includes(value as RoleAssignmentScope)) {
    return value as RoleAssignmentScope;
  }
  throw new Error(`Persisted role assignment scope '${value}' is invalid.`);
}

function assertRoleAssignmentStatus(value: string): RoleAssignmentStatus {
  if (Object.values(RoleAssignmentStatuses).includes(value as RoleAssignmentStatus)) {
    return value as RoleAssignmentStatus;
  }
  throw new Error(`Persisted role assignment status '${value}' is invalid.`);
}

function assertResourceOwnershipScope(value: string): ResourceOwnershipScope {
  if (Object.values(ResourceOwnershipScopes).includes(value as ResourceOwnershipScope)) {
    return value as ResourceOwnershipScope;
  }
  throw new Error(`Persisted resource ownership scope '${value}' is invalid.`);
}

function assertResourceVisibility(value: string): ResourceVisibility {
  if (Object.values(ResourceVisibilities).includes(value as ResourceVisibility)) {
    return value as ResourceVisibility;
  }
  throw new Error(`Persisted resource visibility '${value}' is invalid.`);
}

function assertSharingPolicyMode(value: string): SharingPolicyMode {
  if (Object.values(SharingPolicyModes).includes(value as SharingPolicyMode)) {
    return value as SharingPolicyMode;
  }
  throw new Error(`Persisted sharing policy mode '${value}' is invalid.`);
}

function assertAuthorizationResourceFamily(value: string): AuthorizationResourceFamily {
  if (Object.values(AuthorizationResourceFamilies).includes(value as AuthorizationResourceFamily)) {
    return value as AuthorizationResourceFamily;
  }
  throw new Error(`Persisted authorization resource family '${value}' is invalid.`);
}
