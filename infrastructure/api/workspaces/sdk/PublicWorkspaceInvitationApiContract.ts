import type { WorkspaceInvitationStatus, WorkspaceMembershipStatus, WorkspaceRole, WorkspaceRoleAssignmentStatus } from "../../../../src/domain/workspaces/WorkspaceDomain";

export const WorkspaceInvitationApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  invalidInvite: "invalid-invite",
  internal: "internal",
} as const);

export type WorkspaceInvitationApiErrorCode =
  typeof WorkspaceInvitationApiErrorCodes[keyof typeof WorkspaceInvitationApiErrorCodes];

export interface WorkspaceInvitationApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface WorkspaceInvitationApiError {
  readonly code: WorkspaceInvitationApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<WorkspaceInvitationApiValidationError>;
}

export interface WorkspaceInvitationApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: WorkspaceInvitationApiError;
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
  readonly invitationTokenHint?: string;
  readonly targetUserIdentityIdHint?: string;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceMembershipApiRecord {
  readonly membershipId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
  readonly invitationId?: string;
  readonly invitedByUserIdentityId?: string;
  readonly joinedAt?: string;
  readonly removedAt?: string;
  readonly removedByUserIdentityId?: string;
}

export interface WorkspaceRoleAssignmentApiRecord {
  readonly roleAssignmentId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentStatus;
  readonly assignedAt: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
}

export interface IssueWorkspaceInvitationApiRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly invitedEmail: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly expiresAt?: string;
  readonly expiresInMs?: number;
  readonly targetUserIdentityIdHint?: string;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}

export interface IssueWorkspaceInvitationApiResponse {
  readonly invitation: WorkspaceInvitationApiRecord;
  readonly invitationToken: string;
}

export interface AuthenticatedWorkspaceOnboardingSessionApiContext {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly email: string;
  readonly assuranceLevel?: string;
  readonly trustedDeviceId?: string;
  readonly externalIdentityProvider?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AcceptWorkspaceInvitationOnboardingApiRequest {
  readonly workspaceId: string;
  readonly invitationToken: string;
  readonly session: AuthenticatedWorkspaceOnboardingSessionApiContext;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}

export interface AcceptWorkspaceInvitationOnboardingApiResponse {
  readonly invitation: WorkspaceInvitationApiRecord;
  readonly membership?: WorkspaceMembershipApiRecord;
  readonly createdRoleAssignments: ReadonlyArray<WorkspaceRoleAssignmentApiRecord>;
  readonly resolvedMembershipStatus: WorkspaceMembershipStatus;
}

