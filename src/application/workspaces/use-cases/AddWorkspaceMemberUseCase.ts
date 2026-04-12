import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
  type WorkspaceRole,
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

export const WorkspaceMembershipAdditionErrorCodes = Object.freeze({
  invalidRequest: "workspace-membership-add-invalid-request",
  forbidden: "workspace-membership-add-forbidden",
  notFound: "workspace-membership-add-not-found",
  conflict: "workspace-membership-add-conflict",
  invalidState: "workspace-membership-add-invalid-state",
});

export type WorkspaceMembershipAdditionErrorCode =
  typeof WorkspaceMembershipAdditionErrorCodes[keyof typeof WorkspaceMembershipAdditionErrorCodes];

export interface WorkspaceMembershipAdditionError {
  readonly code: WorkspaceMembershipAdditionErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AddWorkspaceMemberUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
  readonly initialStatus?: WorkspaceMembershipStatus;
  readonly roles?: ReadonlyArray<WorkspaceRole>;
}

export interface AddWorkspaceMemberUseCaseResult {
  readonly membership: WorkspaceMembership;
  readonly roleAssignments: ReadonlyArray<WorkspaceRoleAssignment>;
}

export type AddWorkspaceMemberUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: AddWorkspaceMemberUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceMembershipAdditionError;
  };

export interface WorkspaceMembershipAdministrationClock {
  now(): Date;
}

export interface WorkspaceMembershipAdministrationIdGenerator {
  nextId(namespace: WorkspaceIdNamespace): string;
}

interface AddWorkspaceMemberUseCaseDependencies {
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceMembershipAdministrationIdGenerator;
  readonly clock: WorkspaceMembershipAdministrationClock;
  readonly auditSink?: WorkspaceAdministrationAuditSink;
}

export class AddWorkspaceMemberUseCase {
  public constructor(private readonly dependencies: AddWorkspaceMemberUseCaseDependencies) {}

  public async execute(input: AddWorkspaceMemberUseCaseInput): Promise<AddWorkspaceMemberUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceMembershipAdditionErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(WorkspaceMembershipAdditionErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const targetUserIdentityId = this.normalizeRequired(input.targetUserIdentityId);
    if (!targetUserIdentityId) {
      return this.failure(WorkspaceMembershipAdditionErrorCodes.invalidRequest, "targetUserIdentityId is required.");
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();
    const desiredStatus = input.initialStatus ?? WorkspaceMembershipStatuses.pending;
    if (desiredStatus !== WorkspaceMembershipStatuses.pending && desiredStatus !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.invalidRequest,
        "Membership additions only support initial statuses 'pending' or 'active'.",
      );
    }

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: nowIso,
    });
    if (!snapshot) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    const canAdministrate = snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    if (!canAdministrate) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.forbidden,
        "Actor must have owner or admin role to add members.",
      );
    }

    const existingMembership = await this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
      workspaceId,
      targetUserIdentityId,
    );
    if (existingMembership) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.conflict,
        `Membership already exists for user '${targetUserIdentityId}' in workspace '${workspaceId}'. Use membership status change flow instead.`,
        {
          membershipId: existingMembership.id,
          status: existingMembership.status,
        },
      );
    }

    let normalizedRoles: ReadonlyArray<WorkspaceRole>;
    try {
      normalizedRoles = this.normalizeRoles(input.roles);
    } catch (error) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Membership role input is invalid.",
      );
    }
    for (const role of normalizedRoles) {
      const existingActiveRole = await this.findActiveRoleAssignmentForUserRole({
        workspaceId,
        userIdentityId: targetUserIdentityId,
        role,
      });
      if (existingActiveRole) {
        return this.failure(
          WorkspaceMembershipAdditionErrorCodes.conflict,
          `User '${targetUserIdentityId}' already has active role '${role}' in workspace '${workspaceId}'.`,
          {
            roleAssignmentId: existingActiveRole.id,
            role,
          },
        );
      }
    }

    const membershipId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceMembership);
    if (!this.normalizeRequired(membershipId)) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.invalidState,
        "Id generator returned an empty workspace membership id.",
      );
    }

    let membership: WorkspaceMembership;
    try {
      membership = createWorkspaceMembership({
        id: membershipId,
        workspaceId,
        userIdentityId: targetUserIdentityId,
        status: desiredStatus,
        joinedAt: desiredStatus === WorkspaceMembershipStatuses.active ? nowIso : undefined,
        createdBy: actorUserIdentityId,
        now,
      });
    } catch (error) {
      return this.failure(
        WorkspaceMembershipAdditionErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Membership addition input is invalid.",
      );
    }

    const roleAssignments: WorkspaceRoleAssignment[] = [];
    for (const role of normalizedRoles) {
      const roleAssignmentId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceRoleAssignment);
      if (!this.normalizeRequired(roleAssignmentId)) {
        return this.failure(
          WorkspaceMembershipAdditionErrorCodes.invalidState,
          "Id generator returned an empty workspace role assignment id.",
        );
      }

      try {
        roleAssignments.push(createWorkspaceRoleAssignment({
          id: roleAssignmentId,
          workspaceId,
          userIdentityId: targetUserIdentityId,
          role,
          status: WorkspaceRoleAssignmentStatuses.active,
          assignedBy: actorUserIdentityId,
          assignedAt: nowIso,
        }));
      } catch (error) {
        return this.failure(
          WorkspaceMembershipAdditionErrorCodes.invalidRequest,
          error instanceof WorkspaceDomainError
            ? error.message
            : "Role assignment input is invalid.",
        );
      }
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.membershipRepository.saveMembership(membership);
      for (const roleAssignment of roleAssignments) {
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
        WorkspaceMembershipAdditionErrorCodes.invalidState,
        `Membership addition failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    await publishWorkspaceAdministrationAuditEventBestEffort(this.dependencies.auditSink, {
      type: WorkspaceAdministrationAuditEventTypes.membershipAdded,
      workspaceId,
      actorUserIdentityId,
      occurredAt: nowIso,
      details: Object.freeze({
        targetUserIdentityId,
        membershipId: membership.id,
        status: membership.status,
        roleAssignments: Object.freeze(roleAssignments.map((assignment) => assignment.role)),
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        membership,
        roleAssignments: Object.freeze(roleAssignments),
      }),
    };
  }

  private normalizeRequired(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized;
  }

  private normalizeRoles(roles?: ReadonlyArray<WorkspaceRole>): ReadonlyArray<WorkspaceRole> {
    if (!roles || roles.length === 0) {
      return Object.freeze([WorkspaceRoles.member]);
    }

    const normalized = new Set<WorkspaceRole>();
    for (const role of roles) {
      if (role === WorkspaceRoles.owner) {
        throw new WorkspaceDomainError("Membership add flow cannot assign owner role.");
      }
      if (!Object.values(WorkspaceRoles).includes(role)) {
        throw new WorkspaceDomainError(`Workspace role '${String(role)}' is invalid.`);
      }
      normalized.add(role);
    }

    return Object.freeze([...normalized.values()]);
  }

  private async findActiveRoleAssignmentForUserRole(input: {
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

  private failure(
    code: WorkspaceMembershipAdditionErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AddWorkspaceMemberUseCaseOutcome {
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

