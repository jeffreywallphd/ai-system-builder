import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  createWorkspaceRoleAssignment,
  revokeWorkspaceRoleAssignment,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import {
  WorkspaceIdNamespaces,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  normalizeWorkspaceRoleAdministrationAuditContext,
  type WorkspaceRoleAdministrationAuditContext,
  type WorkspaceRoleAdministrationClock,
  type WorkspaceRoleAdministrationIdGenerator,
} from "./WorkspaceRoleAdministrationContext";
import {
  WorkspaceAdministrationAuditEventTypes,
  publishWorkspaceAdministrationAuditEventBestEffort,
  type WorkspaceAdministrationAuditSink,
} from "./WorkspaceAdministrationAudit";

export const WorkspaceRoleReassignmentErrorCodes = Object.freeze({
  invalidRequest: "workspace-role-reassignment-invalid-request",
  forbidden: "workspace-role-reassignment-forbidden",
  notFound: "workspace-role-reassignment-not-found",
  conflict: "workspace-role-reassignment-conflict",
  invalidState: "workspace-role-reassignment-invalid-state",
});

export type WorkspaceRoleReassignmentErrorCode =
  typeof WorkspaceRoleReassignmentErrorCodes[keyof typeof WorkspaceRoleReassignmentErrorCodes];

export interface WorkspaceRoleReassignmentError {
  readonly code: WorkspaceRoleReassignmentErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ReassignWorkspaceRoleUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly fromRole: WorkspaceRole;
  readonly toRole: WorkspaceRole;
  readonly audit?: WorkspaceRoleAdministrationAuditContext;
}

export interface ReassignWorkspaceRoleUseCaseResult {
  readonly revokedRoleAssignment: WorkspaceRoleAssignment;
  readonly assignedRoleAssignment: WorkspaceRoleAssignment;
  readonly changed: boolean;
  readonly audit?: WorkspaceRoleAdministrationAuditContext;
}

export type ReassignWorkspaceRoleUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: ReassignWorkspaceRoleUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceRoleReassignmentError;
  };

interface ReassignWorkspaceRoleUseCaseDependencies {
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceRoleAdministrationIdGenerator;
  readonly clock: WorkspaceRoleAdministrationClock;
  readonly auditSink?: WorkspaceAdministrationAuditSink;
}

export class ReassignWorkspaceRoleUseCase {
  public constructor(private readonly dependencies: ReassignWorkspaceRoleUseCaseDependencies) {}

  public async execute(input: ReassignWorkspaceRoleUseCaseInput): Promise<ReassignWorkspaceRoleUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceRoleReassignmentErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const targetUserIdentityId = this.normalizeRequired(input.targetUserIdentityId);
    if (!targetUserIdentityId) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.invalidRequest,
        "targetUserIdentityId is required.",
      );
    }

    const fromRoleValidation = this.validateManagedRole(input.fromRole, "fromRole");
    if (!fromRoleValidation.ok) {
      return fromRoleValidation.outcome;
    }
    const fromRole = fromRoleValidation.role;

    const toRoleValidation = this.validateManagedRole(input.toRole, "toRole");
    if (!toRoleValidation.ok) {
      return toRoleValidation.outcome;
    }
    const toRole = toRoleValidation.role;

    if (fromRole === toRole) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.invalidRequest,
        "Role reassignment requires different fromRole and toRole values.",
      );
    }

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
        WorkspaceRoleReassignmentErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    if (!this.canManageRole(fromRole, snapshot.effectiveRoles) || !this.canManageRole(toRole, snapshot.effectiveRoles)) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.forbidden,
        `Actor is not allowed to reassign roles '${fromRole}' -> '${toRole}'.`,
      );
    }

    const targetMembership = await this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
      workspaceId,
      targetUserIdentityId,
    );
    if (!targetMembership) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.notFound,
        `Membership for user '${targetUserIdentityId}' in workspace '${workspaceId}' was not found.`,
      );
    }
    if (targetMembership.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.conflict,
        "Workspace role reassignment requires an active target membership.",
      );
    }

    const activeFromAssignment = await this.findActiveRoleAssignment({
      workspaceId,
      userIdentityId: targetUserIdentityId,
      role: fromRole,
    });
    if (!activeFromAssignment) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.notFound,
        `User '${targetUserIdentityId}' does not have active role '${fromRole}' in workspace '${workspaceId}'.`,
      );
    }

    const existingToAssignment = await this.findActiveRoleAssignment({
      workspaceId,
      userIdentityId: targetUserIdentityId,
      role: toRole,
    });
    if (existingToAssignment) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.conflict,
        `User '${targetUserIdentityId}' already has active role '${toRole}' in workspace '${workspaceId}'.`,
        {
          roleAssignmentId: existingToAssignment.id,
          role: toRole,
        },
      );
    }

    if (fromRole === WorkspaceRoles.admin && toRole !== WorkspaceRoles.admin) {
      const continuity = await this.assertAdministrativeContinuityAfterAdminRoleRemoval({
        workspaceId,
        targetUserIdentityId,
      });
      if (!continuity.ok) {
        return continuity.outcome;
      }
    }

    const nextRoleAssignmentId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceRoleAssignment);
    if (!this.normalizeRequired(nextRoleAssignmentId)) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.invalidState,
        "Id generator returned an empty workspace role assignment id.",
      );
    }

    let revokedRoleAssignment: WorkspaceRoleAssignment;
    let assignedRoleAssignment: WorkspaceRoleAssignment;
    try {
      revokedRoleAssignment = revokeWorkspaceRoleAssignment(activeFromAssignment, {
        revokedBy: actorUserIdentityId,
        now,
        activeOwnerAssignmentCount: await this.dependencies.roleAssignmentRepository.countActiveRoleAssignments(
          workspaceId,
          WorkspaceRoles.owner,
        ),
      });

      assignedRoleAssignment = createWorkspaceRoleAssignment({
        id: nextRoleAssignmentId,
        workspaceId,
        userIdentityId: targetUserIdentityId,
        role: toRole,
        assignedBy: actorUserIdentityId,
        assignedAt: nowIso,
      });
    } catch (error) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.conflict,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Workspace role reassignment cannot be applied.",
      );
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.roleAssignmentRepository.saveRoleAssignment(revokedRoleAssignment);
      await this.dependencies.roleAssignmentRepository.saveRoleAssignment(assignedRoleAssignment);
    };

    try {
      if (this.dependencies.transactionManager) {
        await this.dependencies.transactionManager.runInTransaction(persist);
      } else {
        await persist();
      }
    } catch (error) {
      return this.failure(
        WorkspaceRoleReassignmentErrorCodes.invalidState,
        `Workspace role reassignment failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    await publishWorkspaceAdministrationAuditEventBestEffort(this.dependencies.auditSink, {
      type: WorkspaceAdministrationAuditEventTypes.roleReassigned,
      workspaceId,
      actorUserIdentityId,
      occurredAt: nowIso,
      details: Object.freeze({
        targetUserIdentityId,
        fromRole,
        toRole,
        revokedRoleAssignmentId: revokedRoleAssignment.id,
        assignedRoleAssignmentId: assignedRoleAssignment.id,
        audit,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        revokedRoleAssignment,
        assignedRoleAssignment,
        changed: true,
        audit,
      }),
    };
  }

  private async assertAdministrativeContinuityAfterAdminRoleRemoval(input: {
    readonly workspaceId: string;
    readonly targetUserIdentityId: string;
  }): Promise<{ readonly ok: true } | { readonly ok: false; readonly outcome: ReassignWorkspaceRoleUseCaseOutcome }> {
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
          WorkspaceRoleReassignmentErrorCodes.conflict,
          "Workspace must retain at least one active owner or admin membership. Assign an active replacement admin before this change.",
        ),
      };
    }

    return { ok: true };
  }

  private validateManagedRole(
    role: WorkspaceRole,
    fieldName: "fromRole" | "toRole",
  ): { readonly ok: true; readonly role: WorkspaceRole } | { readonly ok: false; readonly outcome: ReassignWorkspaceRoleUseCaseOutcome } {
    if (!Object.values(WorkspaceRoles).includes(role)) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleReassignmentErrorCodes.invalidRequest,
          `Workspace role '${String(role)}' is invalid.`,
        ),
      };
    }

    if (role === WorkspaceRoles.owner) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleReassignmentErrorCodes.invalidRequest,
          `${fieldName} cannot be 'owner'; owner role changes must use workspace ownership transfer flow.`,
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
    code: WorkspaceRoleReassignmentErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ReassignWorkspaceRoleUseCaseOutcome {
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

