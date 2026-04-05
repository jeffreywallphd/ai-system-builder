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
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import {
  WorkspaceIdNamespaces,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";
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

export const WorkspaceRoleAssignmentErrorCodes = Object.freeze({
  invalidRequest: "workspace-role-assignment-invalid-request",
  forbidden: "workspace-role-assignment-forbidden",
  notFound: "workspace-role-assignment-not-found",
  conflict: "workspace-role-assignment-conflict",
  invalidState: "workspace-role-assignment-invalid-state",
});

export type WorkspaceRoleAssignmentErrorCode =
  typeof WorkspaceRoleAssignmentErrorCodes[keyof typeof WorkspaceRoleAssignmentErrorCodes];

export interface WorkspaceRoleAssignmentError {
  readonly code: WorkspaceRoleAssignmentErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AssignWorkspaceRoleUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly role: WorkspaceRole;
  readonly audit?: WorkspaceRoleAdministrationAuditContext;
}

export interface AssignWorkspaceRoleUseCaseResult {
  readonly roleAssignment: WorkspaceRoleAssignment;
  readonly changed: boolean;
  readonly audit?: WorkspaceRoleAdministrationAuditContext;
}

export type AssignWorkspaceRoleUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: AssignWorkspaceRoleUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceRoleAssignmentError;
  };

interface AssignWorkspaceRoleUseCaseDependencies {
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceRoleAdministrationIdGenerator;
  readonly clock: WorkspaceRoleAdministrationClock;
  readonly auditSink?: WorkspaceAdministrationAuditSink;
}

export class AssignWorkspaceRoleUseCase {
  public constructor(private readonly dependencies: AssignWorkspaceRoleUseCaseDependencies) {}

  public async execute(input: AssignWorkspaceRoleUseCaseInput): Promise<AssignWorkspaceRoleUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceRoleAssignmentErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const targetUserIdentityId = this.normalizeRequired(input.targetUserIdentityId);
    if (!targetUserIdentityId) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.invalidRequest,
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
        WorkspaceRoleAssignmentErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    if (!this.canManageRole(role, snapshot.effectiveRoles)) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.forbidden,
        `Actor is not allowed to assign workspace role '${role}'.`,
      );
    }

    const targetMembership = await this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
      workspaceId,
      targetUserIdentityId,
    );
    if (!targetMembership) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.notFound,
        `Membership for user '${targetUserIdentityId}' in workspace '${workspaceId}' was not found.`,
      );
    }
    if (targetMembership.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.conflict,
        "Workspace role assignment requires an active target membership.",
      );
    }

    const existingRole = await this.findActiveRoleAssignment({
      workspaceId,
      userIdentityId: targetUserIdentityId,
      role,
    });
    if (existingRole) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.conflict,
        `User '${targetUserIdentityId}' already has active role '${role}' in workspace '${workspaceId}'.`,
        {
          roleAssignmentId: existingRole.id,
          role,
        },
      );
    }

    const roleAssignmentId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceRoleAssignment);
    if (!this.normalizeRequired(roleAssignmentId)) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.invalidState,
        "Id generator returned an empty workspace role assignment id.",
      );
    }

    let roleAssignment: WorkspaceRoleAssignment;
    try {
      roleAssignment = createWorkspaceRoleAssignment({
        id: roleAssignmentId,
        workspaceId,
        userIdentityId: targetUserIdentityId,
        role,
        assignedBy: actorUserIdentityId,
        assignedAt: nowIso,
      });
    } catch (error) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Role assignment input is invalid.",
      );
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.roleAssignmentRepository.saveRoleAssignment(roleAssignment);
    };

    try {
      if (this.dependencies.transactionManager) {
        await this.dependencies.transactionManager.runInTransaction(persist);
      } else {
        await persist();
      }
    } catch (error) {
      return this.failure(
        WorkspaceRoleAssignmentErrorCodes.invalidState,
        `Workspace role assignment failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    await publishWorkspaceAdministrationAuditEventBestEffort(this.dependencies.auditSink, {
      type: WorkspaceAdministrationAuditEventTypes.roleAssigned,
      workspaceId,
      actorUserIdentityId,
      occurredAt: nowIso,
      details: Object.freeze({
        targetUserIdentityId,
        role,
        roleAssignmentId: roleAssignment.id,
        audit,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        roleAssignment,
        changed: true,
        audit,
      }),
    };
  }

  private validateManagedRole(
    role: WorkspaceRole,
  ): { readonly ok: true; readonly role: WorkspaceRole } | { readonly ok: false; readonly outcome: AssignWorkspaceRoleUseCaseOutcome } {
    if (!Object.values(WorkspaceRoles).includes(role)) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleAssignmentErrorCodes.invalidRequest,
          `Workspace role '${String(role)}' is invalid.`,
        ),
      };
    }

    if (role === WorkspaceRoles.owner) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceRoleAssignmentErrorCodes.invalidRequest,
          "Owner role assignment must use workspace ownership transfer flow.",
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
    code: WorkspaceRoleAssignmentErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssignWorkspaceRoleUseCaseOutcome {
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
