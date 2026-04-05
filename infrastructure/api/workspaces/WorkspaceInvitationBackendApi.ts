import type {
  IssueWorkspaceInvitationUseCase,
  WorkspaceInvitationIssuanceErrorCode,
} from "../../src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase";
import type {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  WorkspaceAuthenticatedOnboardingErrorCode,
} from "../../src/application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";
import {
  WorkspaceInvitationApiErrorCodes,
  type AcceptWorkspaceInvitationOnboardingApiRequest,
  type AcceptWorkspaceInvitationOnboardingApiResponse,
  type IssueWorkspaceInvitationApiRequest,
  type IssueWorkspaceInvitationApiResponse,
  type WorkspaceInvitationApiError,
  type WorkspaceInvitationApiRecord,
  type WorkspaceInvitationApiResponse,
} from "./sdk/PublicWorkspaceInvitationApiContract";

interface WorkspaceInvitationBackendApiDependencies {
  readonly issueWorkspaceInvitationUseCase: IssueWorkspaceInvitationUseCase;
  readonly resolveAuthenticatedWorkspaceOnboardingUseCase: ResolveAuthenticatedWorkspaceOnboardingUseCase;
}

export class WorkspaceInvitationBackendApi {
  public constructor(private readonly dependencies: WorkspaceInvitationBackendApiDependencies) {}

  public async issueWorkspaceInvitation(
    request: IssueWorkspaceInvitationApiRequest,
  ): Promise<WorkspaceInvitationApiResponse<IssueWorkspaceInvitationApiResponse>> {
    const outcome = await this.dependencies.issueWorkspaceInvitationUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      invitedEmail: request.invitedEmail,
      invitedRoles: request.invitedRoles,
      expiresAt: request.expiresAt,
      expiresInMs: request.expiresInMs,
      targetUserIdentityIdHint: request.targetUserIdentityIdHint,
      onboardingMetadata: request.onboardingMetadata,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapIssuanceError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invitation: serializeInvitation(outcome.value.invitation),
        invitationToken: outcome.value.invitationToken,
      }),
    });
  }

  public async acceptWorkspaceInvitationOnboarding(
    request: AcceptWorkspaceInvitationOnboardingApiRequest,
  ): Promise<WorkspaceInvitationApiResponse<AcceptWorkspaceInvitationOnboardingApiResponse>> {
    const outcome = await this.dependencies.resolveAuthenticatedWorkspaceOnboardingUseCase.execute({
      workspaceId: request.workspaceId,
      invitationToken: request.invitationToken,
      session: request.session,
      onboardingMetadata: request.onboardingMetadata,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapOnboardingError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invitation: serializeInvitation(outcome.value.invitation),
        membership: outcome.value.membership
          ? Object.freeze({
              membershipId: outcome.value.membership.id,
              workspaceId: outcome.value.membership.workspaceId,
              userIdentityId: outcome.value.membership.userIdentityId,
              status: outcome.value.membership.status,
              invitationId: outcome.value.membership.invitationId,
              invitedByUserIdentityId: outcome.value.membership.invitedByUserId,
              joinedAt: outcome.value.membership.joinedAt,
              removedAt: outcome.value.membership.removedAt,
              removedByUserIdentityId: outcome.value.membership.removedByUserId,
            })
          : undefined,
        createdRoleAssignments: Object.freeze(outcome.value.createdRoleAssignments.map((assignment) => Object.freeze({
          roleAssignmentId: assignment.id,
          workspaceId: assignment.workspaceId,
          userIdentityId: assignment.userIdentityId,
          role: assignment.role,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          revokedAt: assignment.revokedAt,
          revokedByUserIdentityId: assignment.revokedBy,
        }))),
        resolvedMembershipStatus: outcome.value.resolvedMembershipStatus,
      }),
    });
  }

  private mapIssuanceError(
    code: WorkspaceInvitationIssuanceErrorCode,
    message: string,
  ): WorkspaceInvitationApiError {
    switch (code) {
      case "workspace-invitation-issue-invalid-request":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.invalidRequest,
          message,
        });
      case "workspace-invitation-issue-forbidden":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.forbidden,
          message,
        });
      case "workspace-invitation-issue-not-found":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.notFound,
          message,
        });
      case "workspace-invitation-issue-conflict":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.conflict,
          message,
        });
      default:
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.internal,
          message,
        });
    }
  }

  private mapOnboardingError(
    code: WorkspaceAuthenticatedOnboardingErrorCode,
    message: string,
  ): WorkspaceInvitationApiError {
    switch (code) {
      case "workspace-authenticated-onboarding-invalid-request":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.invalidRequest,
          message,
        });
      case "workspace-authenticated-onboarding-forbidden":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.forbidden,
          message,
        });
      case "workspace-authenticated-onboarding-not-found":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.notFound,
          message,
        });
      case "workspace-authenticated-onboarding-conflict":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.conflict,
          message,
        });
      case "workspace-authenticated-onboarding-invalid-invite":
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.invalidInvite,
          message,
        });
      default:
        return Object.freeze({
          code: WorkspaceInvitationApiErrorCodes.internal,
          message,
        });
    }
  }
}

function serializeInvitation(invitation: {
  readonly id: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserId: string;
  readonly invitedRoles: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
  readonly status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly acceptedByUserIdentityId?: string;
  readonly invitationTokenHint?: string;
  readonly targetUserIdentityIdHint?: string;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}): WorkspaceInvitationApiRecord {
  return Object.freeze({
    invitationId: invitation.id,
    workspaceId: invitation.workspaceId,
    invitedEmail: invitation.invitedEmail,
    invitedByUserIdentityId: invitation.invitedByUserId,
    invitedRoles: invitation.invitedRoles,
    status: invitation.status,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt,
    acceptedByUserIdentityId: invitation.acceptedByUserIdentityId,
    invitationTokenHint: invitation.invitationTokenHint,
    targetUserIdentityIdHint: invitation.targetUserIdentityIdHint,
    onboardingMetadata: invitation.onboardingMetadata,
  });
}

