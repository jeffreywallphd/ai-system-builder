import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceMembershipLifecycleTransitionError,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  revokeWorkspaceRoleAssignment,
  transitionWorkspaceMembershipStatus,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";

export const WorkspaceMembershipStatusChangeErrorCodes = Object.freeze({
  invalidRequest: "workspace-membership-status-invalid-request",
  forbidden: "workspace-membership-status-forbidden",
  notFound: "workspace-membership-status-not-found",
  conflict: "workspace-membership-status-conflict",
  invalidTransition: "workspace-membership-status-invalid-transition",
  invalidState: "workspace-membership-status-invalid-state",
});

export type WorkspaceMembershipStatusChangeErrorCode =
  typeof WorkspaceMembershipStatusChangeErrorCodes[keyof typeof WorkspaceMembershipStatusChangeErrorCodes];

export interface WorkspaceMembershipStatusChangeError {
  readonly code: WorkspaceMembershipStatusChangeErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ChangeWorkspaceMembershipStatusUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
}

export interface ChangeWorkspaceMembershipStatusUseCaseResult {
  readonly membership: WorkspaceMembership;
  readonly changed: boolean;
  readonly revokedRoleAssignmentIds: ReadonlyArray<string>;
}

export type ChangeWorkspaceMembershipStatusUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: ChangeWorkspaceMembershipStatusUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceMembershipStatusChangeError;
  };

export interface WorkspaceMembershipStatusChangeClock {
  now(): Date;
}

interface ChangeWorkspaceMembershipStatusUseCaseDependencies {
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly clock: WorkspaceMembershipStatusChangeClock;
}

export class ChangeWorkspaceMembershipStatusUseCase {
  public constructor(private readonly dependencies: ChangeWorkspaceMembershipStatusUseCaseDependencies) {}

  public async execute(
    input: ChangeWorkspaceMembershipStatusUseCaseInput,
  ): Promise<ChangeWorkspaceMembershipStatusUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceMembershipStatusChangeErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const targetUserIdentityId = this.normalizeRequired(input.targetUserIdentityId);
    if (!targetUserIdentityId) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.invalidRequest,
        "targetUserIdentityId is required.",
      );
    }

    if (!Object.values(WorkspaceMembershipStatuses).includes(input.status)) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.invalidRequest,
        `Membership status '${String(input.status)}' is invalid.`,
      );
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: nowIso,
    });
    if (!snapshot) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    const canAdministrate = snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    if (!canAdministrate) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.forbidden,
        "Actor must have owner or admin role to change member status.",
      );
    }

    const membership = await this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
      workspaceId,
      targetUserIdentityId,
    );
    if (!membership) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.notFound,
        `Membership for user '${targetUserIdentityId}' in workspace '${workspaceId}' was not found.`,
      );
    }

    let updatedMembership: WorkspaceMembership;
    try {
      updatedMembership = transitionWorkspaceMembershipStatus(membership, {
        status: input.status,
        actorUserId: actorUserIdentityId,
        now,
      });
    } catch (error) {
      if (error instanceof WorkspaceMembershipLifecycleTransitionError) {
        return this.failure(
          WorkspaceMembershipStatusChangeErrorCodes.invalidTransition,
          error.message,
        );
      }

      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Membership status change input is invalid.",
      );
    }

    if (updatedMembership === membership) {
      return {
        ok: true,
        value: Object.freeze({
          membership,
          changed: false,
          revokedRoleAssignmentIds: Object.freeze([]),
        }),
      };
    }

    const activeTargetRoleAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId,
      userIdentityId: targetUserIdentityId,
      statuses: [WorkspaceRoleAssignmentStatuses.active],
    });

    const requiresAdminContinuityCheck = input.status !== WorkspaceMembershipStatuses.active;
    if (requiresAdminContinuityCheck) {
      const continuity = await this.assertAdministrativeContinuity({
        workspaceId,
        targetUserIdentityId,
        targetStatus: input.status,
        activeTargetRoleAssignments,
      });
      if (!continuity.ok) {
        return continuity;
      }
    }

    let updatedRoleAssignments = Object.freeze([]) as ReadonlyArray<WorkspaceRoleAssignment>;
    if (input.status === WorkspaceMembershipStatuses.removed && activeTargetRoleAssignments.length > 0) {
      const revokedAssignments: WorkspaceRoleAssignment[] = [];
      let activeOwnerAssignmentCount = await this.dependencies.roleAssignmentRepository.countActiveRoleAssignments(
        workspaceId,
        WorkspaceRoles.owner,
      );

      for (const assignment of activeTargetRoleAssignments) {
        try {
          const revokedAssignment = revokeWorkspaceRoleAssignment(assignment, {
            revokedBy: actorUserIdentityId,
            now,
            activeOwnerAssignmentCount,
          });
          revokedAssignments.push(revokedAssignment);
          if (assignment.role === WorkspaceRoles.owner) {
            activeOwnerAssignmentCount = Math.max(0, activeOwnerAssignmentCount - 1);
          }
        } catch (error) {
          return this.failure(
            WorkspaceMembershipStatusChangeErrorCodes.conflict,
            error instanceof WorkspaceDomainError
              ? error.message
              : "Membership removal cannot be applied because role revocation failed.",
          );
        }
      }

      updatedRoleAssignments = Object.freeze(revokedAssignments);
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.membershipRepository.saveMembership(updatedMembership);
      for (const roleAssignment of updatedRoleAssignments) {
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
        WorkspaceMembershipStatusChangeErrorCodes.invalidState,
        `Membership status change failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        membership: updatedMembership,
        changed: true,
        revokedRoleAssignmentIds: Object.freeze(updatedRoleAssignments.map((assignment) => assignment.id)),
      }),
    };
  }

  private async assertAdministrativeContinuity(input: {
    readonly workspaceId: string;
    readonly targetUserIdentityId: string;
    readonly targetStatus: WorkspaceMembershipStatus;
    readonly activeTargetRoleAssignments: ReadonlyArray<WorkspaceRoleAssignment>;
  }): Promise<ChangeWorkspaceMembershipStatusUseCaseOutcome | { readonly ok: true }> {
    const administrativeRoles: ReadonlyArray<WorkspaceRole> = Object.freeze([
      WorkspaceRoles.owner,
      WorkspaceRoles.admin,
    ]);
    const activeAdministrativeAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId: input.workspaceId,
      roles: administrativeRoles,
      statuses: [WorkspaceRoleAssignmentStatuses.active],
    });

    const activeMemberships = await this.dependencies.membershipRepository.listMemberships({
      workspaceId: input.workspaceId,
      statuses: [WorkspaceMembershipStatuses.active],
    });
    const activeMemberSet = new Set(activeMemberships.map((membership) => membership.userIdentityId));

    const administrativeUsers = new Set<string>();
    for (const assignment of activeAdministrativeAssignments) {
      if (activeMemberSet.has(assignment.userIdentityId)) {
        administrativeUsers.add(assignment.userIdentityId);
      }
    }

    const targetHasAdministrativeRole = input.activeTargetRoleAssignments.some((assignment) => (
      assignment.role === WorkspaceRoles.owner || assignment.role === WorkspaceRoles.admin
    ));
    const targetCurrentlyActive = activeMemberSet.has(input.targetUserIdentityId);

    const targetWillRemainActive = input.targetStatus === WorkspaceMembershipStatuses.active;
    const targetWillRetainAdministrativeAccess = targetWillRemainActive && targetHasAdministrativeRole;

    if (targetCurrentlyActive && targetHasAdministrativeRole && !targetWillRetainAdministrativeAccess) {
      administrativeUsers.delete(input.targetUserIdentityId);
    }

    if (administrativeUsers.size === 0) {
      return this.failure(
        WorkspaceMembershipStatusChangeErrorCodes.conflict,
        "Workspace must retain at least one active owner or admin membership. Assign an active replacement admin before this change.",
      );
    }

    return { ok: true };
  }

  private normalizeRequired(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized;
  }

  private failure(
    code: WorkspaceMembershipStatusChangeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ChangeWorkspaceMembershipStatusUseCaseOutcome {
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
