import type {
  Workspace,
  WorkspaceEncryptionKeyScope,
  WorkspaceEncryptionMode,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceMembership,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceRoleAssignment,
  WorkspaceRoleAssignmentStatus,
  WorkspaceStatus,
} from "@domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "../../workspaces/WorkspaceOwnership";

export const WorkspaceIdNamespaces = Object.freeze({
  workspace: "workspace",
  workspaceMembership: "workspace-membership",
  workspaceRoleAssignment: "workspace-role-assignment",
  workspaceInvitation: "workspace-invitation",
});

export type WorkspaceIdNamespace = typeof WorkspaceIdNamespaces[keyof typeof WorkspaceIdNamespaces];

export interface WorkspaceAdministrativeAuthorizationContext {
  readonly scope?: string;
  readonly assertions?: ReadonlyArray<string>;
  readonly workspaceId?: string;
}

export interface WorkspaceAdministrativeAuditContext {
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceAdministrativeActionContext {
  readonly actorUserIdentityId: string;
  readonly actorWorkspaceId?: string;
  readonly occurredAt?: string;
  readonly authorization?: WorkspaceAdministrativeAuthorizationContext;
  readonly audit?: WorkspaceAdministrativeAuditContext;
}

export interface WorkspaceListQuery {
  readonly ownerUserId?: string;
  readonly memberUserIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceStatus>;
  readonly visibility?: WorkspaceVisibility;
  readonly slugPrefix?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspaceMembershipListQuery {
  readonly workspaceId: string;
  readonly userIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceMembershipStatus>;
  readonly invitationId?: string;
  readonly invitedByUserId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspaceRoleAssignmentListQuery {
  readonly workspaceId: string;
  readonly userIdentityId?: string;
  readonly roles?: ReadonlyArray<WorkspaceRole>;
  readonly statuses?: ReadonlyArray<WorkspaceRoleAssignmentStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspaceInvitationListQuery {
  readonly workspaceId: string;
  readonly invitedEmail?: string;
  readonly invitedByUserId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceInvitationStatus>;
  readonly activeOnly?: boolean;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspacePendingInvitationLookupQuery {
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly asOf?: string;
}

export interface WorkspacePendingInvitationByTokenHashLookupQuery {
  readonly workspaceId: string;
  readonly invitationTokenHash: string;
  readonly asOf?: string;
}

export interface WorkspaceAuthorizationSnapshotQuery {
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly asOf?: string;
}

export interface WorkspaceAuthorizationSnapshot {
  readonly workspace: Workspace;
  readonly membership?: WorkspaceMembership;
  readonly activeRoleAssignments: ReadonlyArray<WorkspaceRoleAssignment>;
  readonly effectiveRoles: ReadonlyArray<WorkspaceRole>;
  readonly isWorkspaceOwner: boolean;
}

export interface CreateWorkspaceRecordInput {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly encryptionPolicy?: {
    readonly encryptionMode?: WorkspaceEncryptionMode;
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: WorkspaceEncryptionKeyScope;
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
  };
  readonly ownerUserId: string;
  readonly visibility?: WorkspaceVisibility;
  readonly status?: WorkspaceStatus;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface UpdateWorkspaceRecordInput {
  readonly workspaceId: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly visibility?: WorkspaceVisibility;
  readonly encryptionPolicy?: {
    readonly encryptionMode?: WorkspaceEncryptionMode;
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: WorkspaceEncryptionKeyScope;
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
  };
  readonly status?: WorkspaceStatus;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface TransferWorkspaceOwnershipInput {
  readonly workspaceId: string;
  readonly newOwnerUserId: string;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface CreateWorkspaceMembershipRecordInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status?: WorkspaceMembershipStatus;
  readonly invitedByUserId?: string;
  readonly invitationId?: string;
  readonly joinedAt?: string;
  readonly suspendedAt?: string;
  readonly removedAt?: string;
  readonly removedByUserId?: string;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface MutateWorkspaceMembershipStatusInput {
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface CreateWorkspaceRoleAssignmentRecordInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status?: WorkspaceRoleAssignmentStatus;
  readonly assignedAt?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface RevokeWorkspaceRoleAssignmentInput {
  readonly workspaceId: string;
  readonly roleAssignmentId: string;
  readonly activeOwnerAssignmentCount: number;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface CreateWorkspaceInvitationRecordInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserId: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly invitationTokenHash?: string;
  readonly invitationTokenHint?: string;
  readonly targetUserIdentityIdHint?: string;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
  readonly status?: WorkspaceInvitationStatus;
  readonly createdAt?: string;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly acceptedByUserIdentityId?: string;
  readonly action: WorkspaceAdministrativeActionContext;
}

export const WorkspaceInvitationMutationActions = Object.freeze({
  accept: "accept",
  decline: "decline",
  revoke: "revoke",
  expire: "expire",
});

export type WorkspaceInvitationMutationAction =
  typeof WorkspaceInvitationMutationActions[keyof typeof WorkspaceInvitationMutationActions];

export interface MutateWorkspaceInvitationStatusInput {
  readonly workspaceId: string;
  readonly invitationId: string;
  readonly actionType: WorkspaceInvitationMutationAction;
  readonly acceptedByUserIdentityId?: string;
  readonly respondedAt?: string;
  readonly action: WorkspaceAdministrativeActionContext;
}

export interface WorkspaceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
}

export type WorkspaceRecord =
  | Workspace
  | WorkspaceMembership
  | WorkspaceRoleAssignment
  | WorkspaceInvitation;

