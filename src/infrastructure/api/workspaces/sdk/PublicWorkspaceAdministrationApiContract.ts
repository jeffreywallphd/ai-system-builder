/* MIGRATION NOTE: prefer importing shared transport contracts from src/shared/contracts/* for new work. This SDK contract remains for compatibility during convergence. */
import type {
  WorkspaceInvitationStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceRoleAssignmentStatus,
  WorkspaceStatus,
} from "@domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";

export const WorkspaceAdministrationApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  invalidTransition: "invalid-transition",
  internal: "internal",
} as const);

export type WorkspaceAdministrationApiErrorCode =
  typeof WorkspaceAdministrationApiErrorCodes[keyof typeof WorkspaceAdministrationApiErrorCodes];

export interface WorkspaceAdministrationApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface WorkspaceAdministrationApiError {
  readonly code: WorkspaceAdministrationApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<WorkspaceAdministrationApiValidationError>;
}

export interface WorkspaceAdministrationApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: WorkspaceAdministrationApiError;
}

export interface WorkspaceAdministrationApiPagination {
  readonly limit: number;
  readonly offset: number;
  readonly returned: number;
  readonly hasMore: boolean;
}

export interface WorkspaceMembershipStatusSummaryApiRecord {
  readonly pending: number;
  readonly active: number;
  readonly suspended: number;
  readonly removed: number;
  readonly total: number;
}

export interface WorkspaceRoleSummaryApiRecord {
  readonly owner: number;
  readonly admin: number;
  readonly member: number;
  readonly viewer: number;
  readonly activeAssignments: number;
  readonly revokedAssignments: number;
  readonly totalAssignments: number;
}

export interface WorkspaceInvitationStatusSummaryApiRecord {
  readonly pending: number;
  readonly accepted: number;
  readonly declined: number;
  readonly revoked: number;
  readonly expired: number;
  readonly activePending: number;
  readonly total: number;
}

export interface WorkspaceAdministrativeActorAccessSummaryApiRecord {
  readonly membershipStatus?: WorkspaceMembershipStatus;
  readonly effectiveRoles: ReadonlyArray<WorkspaceRole>;
  readonly canAdministrate: boolean;
  readonly isWorkspaceOwner: boolean;
  readonly capabilities: WorkspaceAdministrativeActorCapabilitiesApiRecord;
}

export interface WorkspaceAdministrativeActorCapabilitiesApiRecord {
  readonly canManageWorkspaceSettings: boolean;
  readonly canManageMembers: boolean;
  readonly canManageInvitations: boolean;
  readonly canManageRoles: boolean;
}

export interface WorkspaceAdminListItemApiRecord {
  readonly workspaceId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly status: WorkspaceStatus;
  readonly ownerUserIdentityId: string;
  readonly visibility: WorkspaceVisibility;
  readonly createdAt: string;
  readonly lastModifiedAt: string;
  readonly membershipSummary: WorkspaceMembershipStatusSummaryApiRecord;
  readonly roleSummary: WorkspaceRoleSummaryApiRecord;
  readonly invitationSummary: WorkspaceInvitationStatusSummaryApiRecord;
  readonly actorAccess: WorkspaceAdministrativeActorAccessSummaryApiRecord;
}

export interface WorkspaceMembershipApiRecord {
  readonly membershipId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
  readonly invitedByUserIdentityId?: string;
  readonly invitationId?: string;
  readonly joinedAt?: string;
  readonly suspendedAt?: string;
  readonly removedAt?: string;
  readonly removedByUserIdentityId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserIdentityId: string;
  readonly lastModifiedByUserIdentityId: string;
  readonly activeRoles: ReadonlyArray<WorkspaceRole>;
  readonly hasAdministrativeRole: boolean;
  readonly isWorkspaceOwner: boolean;
}

export interface WorkspaceInvitationApiRecord {
  readonly invitationId: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserIdentityId: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly status: WorkspaceInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly acceptedByUserIdentityId?: string;
  readonly isActive: boolean;
  readonly isExpiredAsOfQuery: boolean;
}

export interface WorkspaceRoleAssignmentApiRecord {
  readonly roleAssignmentId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentStatus;
  readonly assignedAt: string;
  readonly assignedByUserIdentityId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly isAdministrativeRole: boolean;
}

export interface ListWorkspaceAdministrationWorkspacesApiRequest {
  readonly actorUserIdentityId: string;
  readonly ownerUserIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceStatus>;
  readonly visibility?: WorkspaceVisibility;
  readonly slugPrefix?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListWorkspaceAdministrationWorkspacesApiResponse {
  readonly workspaces: ReadonlyArray<WorkspaceAdminListItemApiRecord>;
  readonly pagination: WorkspaceAdministrationApiPagination;
}

export interface ReadWorkspaceAdministrationViewApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly asOf?: string;
}

export interface ReadWorkspaceAdministrationViewApiResponse {
  readonly workspace: WorkspaceAdminListItemApiRecord;
  readonly membershipSummary: WorkspaceMembershipStatusSummaryApiRecord;
  readonly roleSummary: WorkspaceRoleSummaryApiRecord;
  readonly invitationSummary: WorkspaceInvitationStatusSummaryApiRecord;
}

export interface ListWorkspaceAdministrationMembershipsApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly userIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceMembershipStatus>;
  readonly invitationId?: string;
  readonly invitedByUserIdentityId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListWorkspaceAdministrationMembershipsApiResponse {
  readonly memberships: ReadonlyArray<WorkspaceMembershipApiRecord>;
  readonly pagination: WorkspaceAdministrationApiPagination;
  readonly workspaceMembershipSummary: WorkspaceMembershipStatusSummaryApiRecord;
  readonly workspaceRoleSummary: WorkspaceRoleSummaryApiRecord;
}

export interface ListWorkspaceAdministrationInvitationsApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly invitedEmail?: string;
  readonly invitedByUserIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceInvitationStatus>;
  readonly activeOnly?: boolean;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListWorkspaceAdministrationInvitationsApiResponse {
  readonly invitations: ReadonlyArray<WorkspaceInvitationApiRecord>;
  readonly pagination: WorkspaceAdministrationApiPagination;
  readonly workspaceInvitationSummary: WorkspaceInvitationStatusSummaryApiRecord;
}

export interface ListWorkspaceAdministrationRoleAssignmentsApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly userIdentityId?: string;
  readonly roles?: ReadonlyArray<WorkspaceRole>;
  readonly statuses?: ReadonlyArray<WorkspaceRoleAssignmentStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListWorkspaceAdministrationRoleAssignmentsApiResponse {
  readonly roleAssignments: ReadonlyArray<WorkspaceRoleAssignmentApiRecord>;
  readonly pagination: WorkspaceAdministrationApiPagination;
  readonly workspaceRoleSummary: WorkspaceRoleSummaryApiRecord;
}

export interface CreateWorkspaceAdministrationApiRequest {
  readonly actorUserIdentityId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly visibility?: WorkspaceVisibility;
  readonly status?: WorkspaceStatus;
}

export interface CreateWorkspaceAdministrationApiResponse {
  readonly workspace: WorkspaceAdminListItemApiRecord;
}

export interface UpdateWorkspaceAdministrationApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly visibility?: WorkspaceVisibility;
}

export interface UpdateWorkspaceAdministrationApiResponse {
  readonly workspace: WorkspaceAdminListItemApiRecord;
  readonly changed: boolean;
}

export interface TransitionWorkspaceAdministrationLifecycleApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly action: "archive" | "reactivate" | "suspend" | "activate";
}

export interface TransitionWorkspaceAdministrationLifecycleApiResponse {
  readonly workspace: WorkspaceAdminListItemApiRecord;
  readonly changed: boolean;
}

export interface AddWorkspaceAdministrationMemberApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly initialStatus?: WorkspaceMembershipStatus;
  readonly roles?: ReadonlyArray<WorkspaceRole>;
}

export interface AddWorkspaceAdministrationMemberApiResponse {
  readonly membership: WorkspaceMembershipApiRecord;
  readonly roleAssignments: ReadonlyArray<WorkspaceRoleAssignmentApiRecord>;
}

export interface ChangeWorkspaceAdministrationMemberStatusApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
}

export interface ChangeWorkspaceAdministrationMemberStatusApiResponse {
  readonly membership: WorkspaceMembershipApiRecord;
  readonly changed: boolean;
  readonly revokedRoleAssignmentIds: ReadonlyArray<string>;
}

export interface RemoveWorkspaceAdministrationMemberApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
}

export interface RemoveWorkspaceAdministrationMemberApiResponse {
  readonly membership: WorkspaceMembershipApiRecord;
  readonly changed: boolean;
  readonly revokedRoleAssignmentIds: ReadonlyArray<string>;
}

export interface AssignWorkspaceAdministrationRoleApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly role: WorkspaceRole;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AssignWorkspaceAdministrationRoleApiResponse {
  readonly roleAssignment: WorkspaceRoleAssignmentApiRecord;
  readonly changed: boolean;
}

export interface ReassignWorkspaceAdministrationRoleApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly fromRole: WorkspaceRole;
  readonly toRole: WorkspaceRole;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ReassignWorkspaceAdministrationRoleApiResponse {
  readonly revokedRoleAssignment: WorkspaceRoleAssignmentApiRecord;
  readonly assignedRoleAssignment: WorkspaceRoleAssignmentApiRecord;
  readonly changed: boolean;
}

export interface RevokeWorkspaceAdministrationRoleApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly role: WorkspaceRole;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RevokeWorkspaceAdministrationRoleApiResponse {
  readonly roleAssignment: WorkspaceRoleAssignmentApiRecord;
  readonly changed: boolean;
}

export interface CancelWorkspaceAdministrationInvitationApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly invitationId: string;
}

export interface CancelWorkspaceAdministrationInvitationApiResponse {
  readonly invitation: WorkspaceInvitationApiRecord;
  readonly changed: boolean;
}

