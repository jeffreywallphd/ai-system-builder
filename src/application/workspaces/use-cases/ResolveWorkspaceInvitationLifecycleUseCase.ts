import { createHash } from "node:crypto";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceInvitationLifecycleTransitionError,
  WorkspaceInvitationStatuses,
  WorkspaceMembershipLifecycleTransitionError,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  acceptWorkspaceInvitation,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  declineWorkspaceInvitation,
  expireWorkspaceInvitation,
  revokeWorkspaceInvitation,
  transitionWorkspaceMembershipStatus,
  withWorkspaceInvitationOnboardingMetadata,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
  type WorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import {
  WorkspaceIdNamespaces,
  type WorkspaceIdNamespace,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  WorkspaceAdministrationAuditEventTypes,
  publishWorkspaceAdministrationAuditEventBestEffort,
  type WorkspaceAdministrationAuditSink,
} from "./WorkspaceAdministrationAudit";

export const WorkspaceInvitationLifecycleErrorCodes = Object.freeze({
  invalidRequest: "workspace-invitation-lifecycle-invalid-request",
  forbidden: "workspace-invitation-lifecycle-forbidden",
  notFound: "workspace-invitation-lifecycle-not-found",
  conflict: "workspace-invitation-lifecycle-conflict",
  invalidToken: "workspace-invitation-lifecycle-invalid-token",
  invalidState: "workspace-invitation-lifecycle-invalid-state",
});

export type WorkspaceInvitationLifecycleErrorCode =
  typeof WorkspaceInvitationLifecycleErrorCodes[keyof typeof WorkspaceInvitationLifecycleErrorCodes];

export interface WorkspaceInvitationLifecycleError {
  readonly code: WorkspaceInvitationLifecycleErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export const WorkspaceInvitationLifecycleActions = Object.freeze({
  accept: "accept",
  decline: "decline",
  cancel: "cancel",
});

export type WorkspaceInvitationLifecycleAction =
  typeof WorkspaceInvitationLifecycleActions[keyof typeof WorkspaceInvitationLifecycleActions];

interface WorkspaceInvitationLifecycleInputBase {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
}

export interface AcceptWorkspaceInvitationLifecycleInput extends WorkspaceInvitationLifecycleInputBase {
  readonly action: typeof WorkspaceInvitationLifecycleActions.accept;
  readonly invitationToken: string;
  readonly actorEmail: string;
  readonly acceptedMembershipStatus?: WorkspaceMembershipStatus;
  readonly resolvedOnboardingMetadata?: Readonly<Record<string, unknown>>;
}

export interface DeclineWorkspaceInvitationLifecycleInput extends WorkspaceInvitationLifecycleInputBase {
  readonly action: typeof WorkspaceInvitationLifecycleActions.decline;
  readonly invitationToken: string;
  readonly actorEmail: string;
}

export interface CancelWorkspaceInvitationLifecycleInput extends WorkspaceInvitationLifecycleInputBase {
  readonly action: typeof WorkspaceInvitationLifecycleActions.cancel;
  readonly invitationId: string;
}

export type ResolveWorkspaceInvitationLifecycleUseCaseInput =
  | AcceptWorkspaceInvitationLifecycleInput
  | DeclineWorkspaceInvitationLifecycleInput
  | CancelWorkspaceInvitationLifecycleInput;

export interface ResolveWorkspaceInvitationLifecycleUseCaseResult {
  readonly invitation: WorkspaceInvitation;
  readonly membership?: WorkspaceMembership;
  readonly createdRoleAssignments: ReadonlyArray<WorkspaceRoleAssignment>;
  readonly changed: boolean;
}

export type ResolveWorkspaceInvitationLifecycleUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: ResolveWorkspaceInvitationLifecycleUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceInvitationLifecycleError;
  };

export interface WorkspaceInvitationLifecycleClock {
  now(): Date;
}

export interface WorkspaceInvitationLifecycleIdGenerator {
  nextId(namespace: WorkspaceIdNamespace): string;
}

interface ResolveWorkspaceInvitationLifecycleUseCaseDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly invitationRepository: IWorkspaceInvitationRepository;
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceInvitationLifecycleIdGenerator;
  readonly clock: WorkspaceInvitationLifecycleClock;
  readonly auditSink?: WorkspaceAdministrationAuditSink;
}

export class ResolveWorkspaceInvitationLifecycleUseCase {
  public constructor(private readonly dependencies: ResolveWorkspaceInvitationLifecycleUseCaseDependencies) {}

  public async execute(
    input: ResolveWorkspaceInvitationLifecycleUseCaseInput,
  ): Promise<ResolveWorkspaceInvitationLifecycleUseCaseOutcome> {
    const workspaceId = normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceInvitationLifecycleErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    if (input.action === WorkspaceInvitationLifecycleActions.accept) {
      return this.acceptInvitation({
        ...input,
        workspaceId,
        actorUserIdentityId,
      });
    }

    if (input.action === WorkspaceInvitationLifecycleActions.decline) {
      return this.declineInvitation({
        ...input,
        workspaceId,
        actorUserIdentityId,
      });
    }

    if (input.action === WorkspaceInvitationLifecycleActions.cancel) {
      return this.cancelInvitation({
        ...input,
        workspaceId,
        actorUserIdentityId,
      });
    }

    return this.failure(
      WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
      `Unsupported invitation lifecycle action '${String((input as { readonly action?: string }).action)}'.`,
    );
  }

  private async acceptInvitation(
    input: AcceptWorkspaceInvitationLifecycleInput,
  ): Promise<ResolveWorkspaceInvitationLifecycleUseCaseOutcome> {
    const actorEmail = normalizeEmail(input.actorEmail);
    if (!actorEmail) {
      return this.failure(WorkspaceInvitationLifecycleErrorCodes.invalidRequest, "actorEmail is required.");
    }

    const desiredMembershipStatus = input.acceptedMembershipStatus ?? WorkspaceMembershipStatuses.active;
    if (
      desiredMembershipStatus !== WorkspaceMembershipStatuses.active
      && desiredMembershipStatus !== WorkspaceMembershipStatuses.pending
    ) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
        "acceptedMembershipStatus must be 'active' or 'pending' when provided.",
      );
    }

    const invitationToken = normalizeRequired(input.invitationToken);
    if (!invitationToken) {
      return this.failure(WorkspaceInvitationLifecycleErrorCodes.invalidRequest, "invitationToken is required.");
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();

    const invitation = await this.findPendingInvitationByToken({
      workspaceId: input.workspaceId,
      invitationToken,
    });

    if (!invitation) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidToken,
        "Invitation token is invalid, expired, or already used.",
      );
    }

    if (this.isExpired(invitation, now)) {
      const expired = await this.expireInvitation(invitation, now);
      if (!expired.ok) {
        return expired;
      }

      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidToken,
        "Invitation token is invalid, expired, or already used.",
      );
    }

    const compatibility = this.assertInvitationActorCompatibility(invitation, {
      actorUserIdentityId: input.actorUserIdentityId,
      actorEmail,
    });
    if (!compatibility.ok) {
      return compatibility;
    }

    const workspace = await this.dependencies.workspaceRepository.findWorkspaceById(input.workspaceId);
    if (!workspace) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.notFound,
        `Workspace '${input.workspaceId}' was not found.`,
      );
    }

    if (workspace.status !== WorkspaceStatuses.active) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidState,
        `Workspace '${workspace.id}' is not accepting invitation joins while status is '${workspace.status}'.`,
      );
    }

    const existingMembership = await this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
      input.workspaceId,
      input.actorUserIdentityId,
    );

    let membership: WorkspaceMembership;
    let membershipChanged = false;
    if (!existingMembership) {
      const membershipId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceMembership);
      if (!normalizeRequired(membershipId)) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.invalidState,
          "Id generator returned an empty workspace membership id.",
        );
      }

      try {
        membership = createWorkspaceMembership({
          id: membershipId,
          workspaceId: invitation.workspaceId,
          userIdentityId: input.actorUserIdentityId,
          status: desiredMembershipStatus,
          invitationId: invitation.id,
          invitedByUserId: invitation.invitedByUserId,
          joinedAt: desiredMembershipStatus === WorkspaceMembershipStatuses.active ? nowIso : undefined,
          createdBy: input.actorUserIdentityId,
          now,
        });
      } catch (error) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
          error instanceof WorkspaceDomainError
            ? error.message
            : "Invitation acceptance membership input is invalid.",
        );
      }
      membershipChanged = true;
    } else {
      if (
        existingMembership.status === WorkspaceMembershipStatuses.removed
        || existingMembership.status === WorkspaceMembershipStatuses.suspended
      ) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.conflict,
          `Membership for user '${input.actorUserIdentityId}' is '${existingMembership.status}' and cannot accept invitations.`,
          {
            membershipId: existingMembership.id,
            membershipStatus: existingMembership.status,
          },
        );
      }

      if (
        existingMembership.status === WorkspaceMembershipStatuses.active
        && desiredMembershipStatus === WorkspaceMembershipStatuses.pending
      ) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.conflict,
          "Accepted invitation cannot downgrade an active membership to pending.",
          {
            membershipId: existingMembership.id,
            membershipStatus: existingMembership.status,
          },
        );
      }

      if (
        existingMembership.status === WorkspaceMembershipStatuses.pending
        && desiredMembershipStatus === WorkspaceMembershipStatuses.active
      ) {
        try {
          membership = transitionWorkspaceMembershipStatus(existingMembership, {
            status: WorkspaceMembershipStatuses.active,
            actorUserId: input.actorUserIdentityId,
            now,
          });
          membershipChanged = membership !== existingMembership;
        } catch (error) {
          if (error instanceof WorkspaceMembershipLifecycleTransitionError) {
            return this.failure(
              WorkspaceInvitationLifecycleErrorCodes.conflict,
              error.message,
            );
          }

          return this.failure(
            WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
            error instanceof WorkspaceDomainError
              ? error.message
              : "Invitation acceptance membership input is invalid.",
          );
        }
      } else {
        membership = existingMembership;
      }
    }

    const activeAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId: invitation.workspaceId,
      userIdentityId: input.actorUserIdentityId,
      statuses: [WorkspaceRoleAssignmentStatuses.active],
    });
    const activeRoleSet = new Set(activeAssignments.map((assignment) => assignment.role));

    const createdRoleAssignments: WorkspaceRoleAssignment[] = [];
    for (const invitedRole of invitation.invitedRoles) {
      if (activeRoleSet.has(invitedRole)) {
        continue;
      }

      const roleAssignmentId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceRoleAssignment);
      if (!normalizeRequired(roleAssignmentId)) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.invalidState,
          "Id generator returned an empty workspace role assignment id.",
        );
      }

      try {
        createdRoleAssignments.push(createWorkspaceRoleAssignment({
          id: roleAssignmentId,
          workspaceId: invitation.workspaceId,
          userIdentityId: input.actorUserIdentityId,
          role: invitedRole,
          status: WorkspaceRoleAssignmentStatuses.active,
          assignedBy: input.actorUserIdentityId,
          assignedAt: nowIso,
        }));
      } catch (error) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
          error instanceof WorkspaceDomainError
            ? error.message
            : "Invitation acceptance role projection input is invalid.",
        );
      }
    }

    let acceptedInvitation: WorkspaceInvitation;
    try {
      acceptedInvitation = acceptWorkspaceInvitation(invitation, {
        acceptedByUserIdentityId: input.actorUserIdentityId,
        now,
      });
    } catch (error) {
      if (error instanceof WorkspaceInvitationLifecycleTransitionError) {
        return this.failure(WorkspaceInvitationLifecycleErrorCodes.conflict, error.message);
      }

      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Invitation acceptance input is invalid.",
      );
    }

    if (input.resolvedOnboardingMetadata && Object.keys(input.resolvedOnboardingMetadata).length > 0) {
      try {
        acceptedInvitation = withWorkspaceInvitationOnboardingMetadata(acceptedInvitation, {
          onboardingMetadata: input.resolvedOnboardingMetadata,
          actorUserId: input.actorUserIdentityId,
          now,
          merge: true,
        });
      } catch (error) {
        return this.failure(
          WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
          error instanceof WorkspaceDomainError
            ? error.message
            : "Invitation acceptance onboarding metadata is invalid.",
        );
      }
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.invitationRepository.saveInvitation(acceptedInvitation);
      if (membershipChanged) {
        await this.dependencies.membershipRepository.saveMembership(membership);
      }
      for (const roleAssignment of createdRoleAssignments) {
        await this.dependencies.roleAssignmentRepository.saveRoleAssignment(roleAssignment);
      }
    };

    try {
      if (this.dependencies.transactionManager) {
        await this.dependencies.transactionManager.runInTransaction(persist);
      } else {
        await persist();
      }
    } catch (error) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidState,
        `Invitation acceptance failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    await publishWorkspaceAdministrationAuditEventBestEffort(this.dependencies.auditSink, {
      type: WorkspaceAdministrationAuditEventTypes.invitationAccepted,
      workspaceId: invitation.workspaceId,
      actorUserIdentityId: input.actorUserIdentityId,
      occurredAt: nowIso,
      details: Object.freeze({
        invitationId: acceptedInvitation.id,
        membershipId: membership.id,
        membershipStatus: membership.status,
        createdRoleAssignmentIds: Object.freeze(createdRoleAssignments.map((assignment) => assignment.id)),
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        invitation: acceptedInvitation,
        membership,
        createdRoleAssignments: Object.freeze(createdRoleAssignments),
        changed: true,
      }),
    };
  }

  private async declineInvitation(
    input: DeclineWorkspaceInvitationLifecycleInput,
  ): Promise<ResolveWorkspaceInvitationLifecycleUseCaseOutcome> {
    const actorEmail = normalizeEmail(input.actorEmail);
    if (!actorEmail) {
      return this.failure(WorkspaceInvitationLifecycleErrorCodes.invalidRequest, "actorEmail is required.");
    }

    const invitationToken = normalizeRequired(input.invitationToken);
    if (!invitationToken) {
      return this.failure(WorkspaceInvitationLifecycleErrorCodes.invalidRequest, "invitationToken is required.");
    }

    const now = this.dependencies.clock.now();

    const invitation = await this.findPendingInvitationByToken({
      workspaceId: input.workspaceId,
      invitationToken,
    });

    if (!invitation) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidToken,
        "Invitation token is invalid, expired, or already used.",
      );
    }

    if (this.isExpired(invitation, now)) {
      const expired = await this.expireInvitation(invitation, now);
      if (!expired.ok) {
        return expired;
      }

      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidToken,
        "Invitation token is invalid, expired, or already used.",
      );
    }

    const compatibility = this.assertInvitationActorCompatibility(invitation, {
      actorUserIdentityId: input.actorUserIdentityId,
      actorEmail,
    });
    if (!compatibility.ok) {
      return compatibility;
    }

    let declinedInvitation: WorkspaceInvitation;
    try {
      declinedInvitation = declineWorkspaceInvitation(invitation, {
        actorUserId: input.actorUserIdentityId,
        now,
      });
    } catch (error) {
      if (error instanceof WorkspaceInvitationLifecycleTransitionError) {
        return this.failure(WorkspaceInvitationLifecycleErrorCodes.conflict, error.message);
      }
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Invitation decline input is invalid.",
      );
    }

    try {
      await this.dependencies.invitationRepository.saveInvitation(declinedInvitation);
    } catch (error) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidState,
        `Invitation decline failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        invitation: declinedInvitation,
        createdRoleAssignments: Object.freeze([]),
        changed: true,
      }),
    };
  }

  private async cancelInvitation(
    input: CancelWorkspaceInvitationLifecycleInput,
  ): Promise<ResolveWorkspaceInvitationLifecycleUseCaseOutcome> {
    const invitationId = normalizeRequired(input.invitationId);
    if (!invitationId) {
      return this.failure(WorkspaceInvitationLifecycleErrorCodes.invalidRequest, "invitationId is required.");
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId: input.workspaceId,
      userIdentityId: input.actorUserIdentityId,
      asOf: nowIso,
    });
    if (!snapshot) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.notFound,
        `Workspace '${input.workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    const canAdministrate = snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    if (!canAdministrate) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.forbidden,
        "Actor must have owner or admin role to cancel invitations.",
      );
    }

    const invitation = await this.dependencies.invitationRepository.findInvitationById(invitationId);
    if (!invitation || invitation.workspaceId !== input.workspaceId) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.notFound,
        `Invitation '${invitationId}' was not found in workspace '${input.workspaceId}'.`,
      );
    }

    if (invitation.status !== WorkspaceInvitationStatuses.pending) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.conflict,
        `Only pending invitations may be canceled; invitation '${invitation.id}' is '${invitation.status}'.`,
      );
    }

    if (this.isExpired(invitation, now)) {
      const expired = await this.expireInvitation(invitation, now);
      if (!expired.ok) {
        return expired;
      }

      return {
        ok: true,
        value: Object.freeze({
          invitation: expired.value,
          createdRoleAssignments: Object.freeze([]),
          changed: true,
        }),
      };
    }

    let canceledInvitation: WorkspaceInvitation;
    try {
      canceledInvitation = revokeWorkspaceInvitation(invitation, {
        actorUserId: input.actorUserIdentityId,
        now,
      });
    } catch (error) {
      if (error instanceof WorkspaceInvitationLifecycleTransitionError) {
        return this.failure(WorkspaceInvitationLifecycleErrorCodes.conflict, error.message);
      }

      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Invitation cancel input is invalid.",
      );
    }

    try {
      await this.dependencies.invitationRepository.saveInvitation(canceledInvitation);
    } catch (error) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidState,
        `Invitation cancellation failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        invitation: canceledInvitation,
        createdRoleAssignments: Object.freeze([]),
        changed: true,
      }),
    };
  }

  private async findPendingInvitationByToken(input: {
    readonly workspaceId: string;
    readonly invitationToken: string;
  }): Promise<WorkspaceInvitation | undefined> {
    const tokenHash = hashInvitationToken(input.invitationToken);
    return this.dependencies.invitationRepository.findPendingInvitationByTokenHash({
      workspaceId: input.workspaceId,
      invitationTokenHash: tokenHash,
    });
  }

  private assertInvitationActorCompatibility(
    invitation: WorkspaceInvitation,
    actor: {
      readonly actorUserIdentityId: string;
      readonly actorEmail: string;
    },
  ): ResolveWorkspaceInvitationLifecycleUseCaseOutcome | { readonly ok: true } {
    if (invitation.invitedEmail !== actor.actorEmail) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.forbidden,
        "Invitation actor identity does not match invitee identity.",
      );
    }

    if (
      invitation.targetUserIdentityIdHint
      && invitation.targetUserIdentityIdHint !== actor.actorUserIdentityId
    ) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.forbidden,
        "Invitation actor identity does not match invitation target identity.",
      );
    }

    return { ok: true };
  }

  private async expireInvitation(
    invitation: WorkspaceInvitation,
    now: Date,
  ): Promise<ResolveWorkspaceInvitationLifecycleUseCaseOutcome | { readonly ok: true; readonly value: WorkspaceInvitation }> {
    let expiredInvitation: WorkspaceInvitation;
    try {
      expiredInvitation = expireWorkspaceInvitation(invitation, now);
    } catch (error) {
      if (error instanceof WorkspaceInvitationLifecycleTransitionError) {
        return this.failure(WorkspaceInvitationLifecycleErrorCodes.conflict, error.message);
      }

      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Invitation expiry resolution input is invalid.",
      );
    }

    try {
      await this.dependencies.invitationRepository.saveInvitation(expiredInvitation);
    } catch (error) {
      return this.failure(
        WorkspaceInvitationLifecycleErrorCodes.invalidState,
        `Invitation expiry resolution failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    return {
      ok: true,
      value: expiredInvitation,
    };
  }

  private isExpired(invitation: WorkspaceInvitation, now: Date): boolean {
    return new Date(invitation.expiresAt).getTime() <= now.getTime();
  }

  private failure(
    code: WorkspaceInvitationLifecycleErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ResolveWorkspaceInvitationLifecycleUseCaseOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeEmail(value: string): string | undefined {
  const normalized = normalizeRequired(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function hashInvitationToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

