import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  revokeWorkspaceRoleAssignment,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import {
  normalizeWorkspaceRoleAdministrationAuditContext,
  type WorkspaceRoleAdministrationAuditContext,
  type WorkspaceRoleAdministrationClock,
} from "./WorkspaceRoleAdministrationContext";

export const WorkspaceRoleRevocationErrorCodes = Object.freeze({
  invalidRequest: "workspace-role-revocation-invalid-request",
  forbidden: "workspace-role-revocation-forbidden",
  notFound: "workspace-role-revocation-not-found",
  conflict: "workspace-role-revocation-conflict",
  invalidState: "workspace-role-revocation-invalid-state",
});

export type WorkspaceRoleRevocationErrorCode =
  typeof WorkspaceRoleRevocationErrorCodes[keyof typeof WorkspaceRoleRevocationErrorCodes];

export interface WorkspaceRoleRevocationError {
  readonly code: WorkspaceRoleRevocationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RevokeWorkspaceRoleUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly role: WorkspaceRole;
  readonly audit?: WorkspaceRoleAdministrationAuditContext;
}

export interface RevokeWorkspaceRoleUseCaseResult {
  readonly roleAssignment: WorkspaceRoleAssignment;
  readonly changed: boolean;
  readonly audit?: WorkspaceRoleAdministrationAuditContext;
}

export type RevokeWorkspaceRoleUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: RevokeWorkspaceRoleUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceRoleRevocationError;
  };

interface RevokeWorkspaceRoleUseCaseDependencies {
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly clock: WorkspaceRoleAdministrationClock;
}

export class RevokeWorkspaceRoleUseCase {
  public constructor(private readonly dependencies: RevokeWorkspaceRoleUseCaseDependencies) {}

  public async execute(input: RevokeWorkspaceRoleUseCaseInput): Promise<RevokeWorkspaceRoleUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceRoleRevocationErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const targetUserIdentityId = this.normalizeRequired(input.targetUserIdentityId);
    if (!targetUserIdentityId) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.invalidRequest,
        "targetUserIdentityId is required.",
      );
    }

    const roleValidation = this.validateManagedRole(input.role);
    if (!roleValidation.ok) {
      return roleValidation.outcome;
    }
    const role = roleValidation.role;

    const audit = normalizeWorkspaceRoleAdministrationAuditContext(input.audit);
    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: nowIso,
    });
    if (!snapshot) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    if (!this.canManageRole(role, snapshot.effectiveRoles)) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.forbidden,
        `Actor is not allowed to revoke workspace role '${role}'.`,
      );
    }

    const targetMembership = await this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
      workspaceId,
      targetUserIdentityId,
    );
    if (!targetMembership) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.notFound,
        `Membership for user '${targetUserIdentityId}' in workspace '${workspaceId}' was not found.`,
      );
    }
    if (targetMembership.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.conflict,
        "Workspace role revocation requires an active target membership.",
      );
    }

    const activeRoleAssignment = await this.findActiveRoleAssignment({
      workspaceId,
      userIdentityId: targetUserIdentityId,
      role,
    });
    if (!activeRoleAssignment) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.notFound,
        `User '${targetUserIdentityId}' does not have active role '${role}' in workspace '${workspaceId}'.`,
      );
    }

    if (role === WorkspaceRoles.admin) {
      const continuity = await this.assertAdministrativeContinuityAfterAdminRoleRemoval({
        workspaceId,
        targetUserIdentityId,
      });
      if (!continuity.ok) {
        return continuity.outcome;
      }
    }

    let revokedRoleAssignment: WorkspaceRoleAssignment;
    try {
      revokedRoleAssignment = revokeWorkspaceRoleAssignment(activeRoleAssignment, {
        revokedBy: actorUserIdentityId,
        now,
        activeOwnerAssignmentCount: await this.dependencies.roleAssignmentRepository.countActiveRoleAssignments(
          workspaceId,
          WorkspaceRoles.owner,
        ),
      });
    } catch (error) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.conflict,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Workspace role revocation cannot be applied.",
      );
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.roleAssignmentRepository.saveRoleAssignment(revokedRoleAssignment);
    };

    try {
      if (this.dependencies.transactionManager) {
        await this.dependencies.transactionManager.runInTransaction(persist);
      } else {
        await persist();
      }
    } catch (error) {
      return this.failure(
        WorkspaceRoleRevocationErrorCodes.invalidState,
        `Workspace role revocation failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        roleAssignment: revokedRoleAssignment,
        changed: true,
        audit,
      }),
    };
  }

  private async assertAdministrativeContinuityAfterAdminRoleRemoval(input: {
    readonly workspaceId: string;
    readonly targetUserIdentityId: string;
  }): Promise<{ readonly ok: true } | { readonly ok: false; readonly outcome: RevokeWorkspaceRoleUseCaseOutcome }> {
    const activeAdministrativeAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId: input.workspaceId,
      roles: [WorkspaceRoles.owner, WorkspaceRoles.admin],
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

    const remainingTargetAdministrativeAssignment = activeAdministrativeAssignments.some((assignment) => (
      assignment.userIdentityId === input.targetUserIdentityId
      && assignment.role === WorkspaceRoles.owner
    ));
    if (!remainingTargetAdministrativeAssignment) {
      administrativeUsers.delete(input.targetUserIdentityId);
    }

    if (administrativeUsers.size === 0) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleRevocationErrorCodes.conflict,
          "Workspace must retain at least one active owner or admin membership. Assign an active replacement admin before this change.",
        ),
      };
    }

    return { ok: true };
  }

  private validateManagedRole(
    role: WorkspaceRole,
  ): { readonly ok: true; readonly role: WorkspaceRole } | { readonly ok: false; readonly outcome: RevokeWorkspaceRoleUseCaseOutcome } {
    if (!Object.values(WorkspaceRoles).includes(role)) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleRevocationErrorCodes.invalidRequest,
          `Workspace role '${String(role)}' is invalid.`,
        ),
      };
    }

    if (role === WorkspaceRoles.owner) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleRevocationErrorCodes.invalidRequest,
          "Owner role revocation must use workspace ownership transfer flow.",
        ),
      };
    }

    return { ok: true, role };
  }

  private canManageRole(role: WorkspaceRole, effectiveRoles: ReadonlyArray<string>): boolean {
    const isOwner = effectiveRoles.includes(WorkspaceRoles.owner);
    const isAdmin = effectiveRoles.includes(WorkspaceRoles.admin);
    if (!isOwner && !isAdmin) {
      return false;
    }
    return role !== WorkspaceRoles.owner;
  }

  private async findActiveRoleAssignment(input: {
    readonly workspaceId: string;
    readonly userIdentityId: string;
    readonly role: WorkspaceRole;
  }): Promise<WorkspaceRoleAssignment | undefined> {
    const assignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
      roles: [input.role],
      statuses: [WorkspaceRoleAssignmentStatuses.active],
      limit: 1,
    });
    return assignments[0];
  }

  private normalizeRequired(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized;
  }

  private failure(
    code: WorkspaceRoleRevocationErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): RevokeWorkspaceRoleUseCaseOutcome {
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
