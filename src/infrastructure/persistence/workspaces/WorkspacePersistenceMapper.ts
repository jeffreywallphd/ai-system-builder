import {
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceInvitationStatus,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
  type WorkspaceRoleAssignmentStatus,
  type WorkspaceStatus,
} from "../../../domain/workspaces/WorkspaceDomain";
import {
  WorkspaceVisibilities,
  type WorkspaceVisibility,
} from "../../../shared/workspaces/WorkspaceOwnership";

export interface WorkspaceRow {
  readonly workspace_id: string;
  readonly slug: string;
  readonly display_name: string;
  readonly description: string | null;
  readonly status: WorkspaceStatus;
  readonly owner_user_id: string;
  readonly visibility: WorkspaceVisibility;
  readonly created_by: string;
  readonly last_modified_by: string;
  readonly created_at: string;
  readonly last_modified_at: string;
}

export interface WorkspaceMembershipRow {
  readonly membership_id: string;
  readonly workspace_id: string;
  readonly user_identity_id: string;
  readonly status: WorkspaceMembershipStatus;
  readonly invited_by_user_id: string | null;
  readonly invitation_id: string | null;
  readonly joined_at: string | null;
  readonly suspended_at: string | null;
  readonly removed_at: string | null;
  readonly removed_by_user_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string;
  readonly last_modified_by: string;
}

export interface WorkspaceRoleAssignmentRow {
  readonly role_assignment_id: string;
  readonly workspace_id: string;
  readonly user_identity_id: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentStatus;
  readonly assigned_at: string;
  readonly assigned_by: string;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
}

export interface WorkspaceInvitationRow {
  readonly invitation_id: string;
  readonly workspace_id: string;
  readonly invited_email: string;
  readonly invited_by_user_id: string;
  readonly invited_roles_json: string;
  readonly status: WorkspaceInvitationStatus;
  readonly created_at: string;
  readonly expires_at: string;
  readonly responded_at: string | null;
  readonly accepted_by_user_identity_id: string | null;
  readonly last_modified_by: string;
  readonly last_modified_at: string;
}

export function mapWorkspaceRowToDomain(row: WorkspaceRow): Workspace {
  return Object.freeze({
    id: row.workspace_id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description ?? undefined,
    status: assertWorkspaceStatus(row.status),
    ownership: Object.freeze({
      workspaceId: row.workspace_id,
      ownerUserId: row.owner_user_id,
      visibility: assertWorkspaceVisibility(row.visibility),
      createdBy: row.created_by,
      lastModifiedBy: row.last_modified_by,
      createdAt: row.created_at,
      lastModifiedAt: row.last_modified_at,
    }),
  });
}

export function mapWorkspaceMembershipRowToDomain(row: WorkspaceMembershipRow): WorkspaceMembership {
  return Object.freeze({
    id: row.membership_id,
    workspaceId: row.workspace_id,
    userIdentityId: row.user_identity_id,
    status: assertWorkspaceMembershipStatus(row.status),
    invitedByUserId: row.invited_by_user_id ?? undefined,
    invitationId: row.invitation_id ?? undefined,
    joinedAt: row.joined_at ?? undefined,
    suspendedAt: row.suspended_at ?? undefined,
    removedAt: row.removed_at ?? undefined,
    removedByUserId: row.removed_by_user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by,
  });
}

export function mapWorkspaceRoleAssignmentRowToDomain(row: WorkspaceRoleAssignmentRow): WorkspaceRoleAssignment {
  return Object.freeze({
    id: row.role_assignment_id,
    workspaceId: row.workspace_id,
    userIdentityId: row.user_identity_id,
    role: assertWorkspaceRole(row.role),
    status: assertWorkspaceRoleAssignmentStatus(row.status),
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    revokedAt: row.revoked_at ?? undefined,
    revokedBy: row.revoked_by ?? undefined,
  });
}

export function mapWorkspaceInvitationRowToDomain(row: WorkspaceInvitationRow): WorkspaceInvitation {
  return Object.freeze({
    id: row.invitation_id,
    workspaceId: row.workspace_id,
    invitedEmail: row.invited_email,
    invitedByUserId: row.invited_by_user_id,
    invitedRoles: parseWorkspaceRolesJson(row.invited_roles_json),
    status: assertWorkspaceInvitationStatus(row.status),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at ?? undefined,
    acceptedByUserIdentityId: row.accepted_by_user_identity_id ?? undefined,
    lastModifiedBy: row.last_modified_by,
    lastModifiedAt: row.last_modified_at,
  });
}

export function mapWorkspaceToRowValues(workspace: Workspace): ReadonlyArray<unknown> {
  return Object.freeze([
    workspace.id,
    workspace.slug,
    workspace.displayName,
    workspace.description ?? null,
    workspace.status,
    workspace.ownership.ownerUserId,
    workspace.ownership.visibility,
    workspace.ownership.createdBy,
    workspace.ownership.lastModifiedBy,
    workspace.ownership.createdAt,
    workspace.ownership.lastModifiedAt,
  ]);
}

export function mapWorkspaceMembershipToRowValues(membership: WorkspaceMembership): ReadonlyArray<unknown> {
  return Object.freeze([
    membership.id,
    membership.workspaceId,
    membership.userIdentityId,
    membership.status,
    membership.invitedByUserId ?? null,
    membership.invitationId ?? null,
    membership.joinedAt ?? null,
    membership.suspendedAt ?? null,
    membership.removedAt ?? null,
    membership.removedByUserId ?? null,
    membership.createdAt,
    membership.updatedAt,
    membership.createdBy,
    membership.lastModifiedBy,
  ]);
}

export function mapWorkspaceRoleAssignmentToRowValues(
  roleAssignment: WorkspaceRoleAssignment,
): ReadonlyArray<unknown> {
  return Object.freeze([
    roleAssignment.id,
    roleAssignment.workspaceId,
    roleAssignment.userIdentityId,
    roleAssignment.role,
    roleAssignment.status,
    roleAssignment.assignedAt,
    roleAssignment.assignedBy,
    roleAssignment.revokedAt ?? null,
    roleAssignment.revokedBy ?? null,
  ]);
}

export function mapWorkspaceInvitationToRowValues(invitation: WorkspaceInvitation): ReadonlyArray<unknown> {
  return Object.freeze([
    invitation.id,
    invitation.workspaceId,
    invitation.invitedEmail,
    invitation.invitedByUserId,
    JSON.stringify(invitation.invitedRoles),
    invitation.status,
    invitation.createdAt,
    invitation.expiresAt,
    invitation.respondedAt ?? null,
    invitation.acceptedByUserIdentityId ?? null,
    invitation.lastModifiedBy,
    invitation.lastModifiedAt,
  ]);
}

export function normalizeLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function normalizeSlugLookup(value: string): string | undefined {
  const normalized = normalizeLookup(value)?.toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function normalizeEmailLookup(value: string): string | undefined {
  const normalized = normalizeLookup(value)?.toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function parseWorkspaceRolesJson(value: string): ReadonlyArray<WorkspaceRole> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }

    const roles = parsed
      .filter((entry): entry is WorkspaceRole => Object.values(WorkspaceRoles).includes(entry as WorkspaceRole));
    return Object.freeze([...new Set(roles)]);
  } catch {
    return Object.freeze([]);
  }
}

function assertWorkspaceStatus(value: string): WorkspaceStatus {
  if (Object.values(WorkspaceStatuses).includes(value as WorkspaceStatus)) {
    return value as WorkspaceStatus;
  }
  throw new Error(`Persisted workspace status '${value}' is invalid.`);
}

function assertWorkspaceVisibility(value: string): WorkspaceVisibility {
  if (Object.values(WorkspaceVisibilities).includes(value as WorkspaceVisibility)) {
    return value as WorkspaceVisibility;
  }
  throw new Error(`Persisted workspace visibility '${value}' is invalid.`);
}

function assertWorkspaceMembershipStatus(value: string): WorkspaceMembershipStatus {
  if (Object.values(WorkspaceMembershipStatuses).includes(value as WorkspaceMembershipStatus)) {
    return value as WorkspaceMembershipStatus;
  }
  throw new Error(`Persisted workspace membership status '${value}' is invalid.`);
}

function assertWorkspaceRole(value: string): WorkspaceRole {
  if (Object.values(WorkspaceRoles).includes(value as WorkspaceRole)) {
    return value as WorkspaceRole;
  }
  throw new Error(`Persisted workspace role '${value}' is invalid.`);
}

function assertWorkspaceRoleAssignmentStatus(value: string): WorkspaceRoleAssignmentStatus {
  if (Object.values(WorkspaceRoleAssignmentStatuses).includes(value as WorkspaceRoleAssignmentStatus)) {
    return value as WorkspaceRoleAssignmentStatus;
  }
  throw new Error(`Persisted workspace role assignment status '${value}' is invalid.`);
}

function assertWorkspaceInvitationStatus(value: string): WorkspaceInvitationStatus {
  if (Object.values(WorkspaceInvitationStatuses).includes(value as WorkspaceInvitationStatus)) {
    return value as WorkspaceInvitationStatus;
  }
  throw new Error(`Persisted workspace invitation status '${value}' is invalid.`);
}