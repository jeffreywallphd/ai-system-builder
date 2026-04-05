import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type Workspace,
  type WorkspaceMembership,
  type WorkspaceRoleAssignment,
  type WorkspaceStatus,
} from "../../../domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  WorkspaceIdNamespaces,
  type WorkspaceIdNamespace,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";

export const WorkspaceCreationErrorCodes = Object.freeze({
  invalidRequest: "workspace-invalid-request",
  forbidden: "workspace-forbidden",
  duplicate: "workspace-duplicate",
  invalidState: "workspace-invalid-state",
});

export type WorkspaceCreationErrorCode =
  typeof WorkspaceCreationErrorCodes[keyof typeof WorkspaceCreationErrorCodes];

export interface WorkspaceCreationError {
  readonly code: WorkspaceCreationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CreateWorkspaceUseCaseInput {
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly visibility?: WorkspaceVisibility;
  readonly status?: WorkspaceStatus;
  readonly actorUserIdentityId: string;
}

export interface CreateWorkspaceUseCaseResult {
  readonly workspace: Workspace;
  readonly creatorMembership: WorkspaceMembership;
  readonly creatorRoleAssignment: WorkspaceRoleAssignment;
}

export type CreateWorkspaceUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: CreateWorkspaceUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceCreationError;
  };

export interface WorkspaceCreationIdGenerator {
  nextId(namespace: WorkspaceIdNamespace): string;
}

export interface WorkspaceCreationClock {
  now(): Date;
}

export interface WorkspaceCreationAuthorizationHook {
  assertCanCreateWorkspace(input: {
    readonly actorUserIdentityId: string;
    readonly slug: string;
    readonly displayName: string;
  }): Promise<void>;
}

export interface WorkspaceCreationAuditSink {
  recordWorkspaceCreated(event: {
    readonly workspaceId: string;
    readonly slug: string;
    readonly actorUserIdentityId: string;
    readonly occurredAt: string;
  }): Promise<void>;
}

interface CreateWorkspaceUseCaseDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceCreationIdGenerator;
  readonly clock: WorkspaceCreationClock;
  readonly authorizationHook?: WorkspaceCreationAuthorizationHook;
  readonly auditSink?: WorkspaceCreationAuditSink;
}

export class CreateWorkspaceUseCase {
  public constructor(private readonly dependencies: CreateWorkspaceUseCaseDependencies) {}

  public async execute(input: CreateWorkspaceUseCaseInput): Promise<CreateWorkspaceUseCaseOutcome> {
    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceCreationErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();
    const workspaceId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspace);
    const membershipId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceMembership);
    const roleAssignmentId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceRoleAssignment);

    if (!this.normalizeRequired(workspaceId)) {
      return this.failure(WorkspaceCreationErrorCodes.invalidState, "Id generator returned an empty workspace id.");
    }
    if (!this.normalizeRequired(membershipId)) {
      return this.failure(WorkspaceCreationErrorCodes.invalidState, "Id generator returned an empty workspace membership id.");
    }
    if (!this.normalizeRequired(roleAssignmentId)) {
      return this.failure(WorkspaceCreationErrorCodes.invalidState, "Id generator returned an empty workspace role assignment id.");
    }

    let workspace: Workspace;
    let membership: WorkspaceMembership;
    let roleAssignment: WorkspaceRoleAssignment;
    try {
      workspace = createWorkspace({
        id: workspaceId,
        slug: input.slug,
        displayName: input.displayName,
        description: input.description,
        ownerUserId: actorUserIdentityId,
        visibility: input.visibility,
        createdBy: actorUserIdentityId,
        status: input.status ?? WorkspaceStatuses.active,
        now,
      });
      membership = createWorkspaceMembership({
        id: membershipId,
        workspaceId,
        userIdentityId: actorUserIdentityId,
        status: WorkspaceMembershipStatuses.active,
        joinedAt: nowIso,
        createdBy: actorUserIdentityId,
        now,
      });
      roleAssignment = createWorkspaceRoleAssignment({
        id: roleAssignmentId,
        workspaceId,
        userIdentityId: actorUserIdentityId,
        role: WorkspaceRoles.owner,
        assignedBy: actorUserIdentityId,
        assignedAt: nowIso,
      });
    } catch (error) {
      const message = error instanceof WorkspaceDomainError ? error.message : "Workspace creation input is invalid.";
      return this.failure(WorkspaceCreationErrorCodes.invalidRequest, message);
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanCreateWorkspace({
          actorUserIdentityId,
          slug: workspace.slug,
          displayName: workspace.displayName,
        });
      }
    } catch (error) {
      return this.failure(
        WorkspaceCreationErrorCodes.forbidden,
        error instanceof Error ? error.message : "Workspace creation is not authorized.",
      );
    }

    const duplicateWorkspace = await this.dependencies.workspaceRepository.findWorkspaceBySlug(workspace.slug);
    if (duplicateWorkspace) {
      return this.failure(
        WorkspaceCreationErrorCodes.duplicate,
        `Workspace slug '${workspace.slug}' is already in use.`,
        {
          workspaceId: duplicateWorkspace.id,
          slug: duplicateWorkspace.slug,
        },
      );
    }

    if (await this.dependencies.workspaceRepository.findWorkspaceById(workspace.id)) {
      return this.failure(
        WorkspaceCreationErrorCodes.duplicate,
        `Workspace id '${workspace.id}' already exists.`,
      );
    }

    if (await this.dependencies.membershipRepository.findMembershipById(membership.id)) {
      return this.failure(
        WorkspaceCreationErrorCodes.duplicate,
        `Workspace membership id '${membership.id}' already exists.`,
      );
    }

    if (await this.dependencies.roleAssignmentRepository.findRoleAssignmentById(roleAssignment.id)) {
      return this.failure(
        WorkspaceCreationErrorCodes.duplicate,
        `Workspace role assignment id '${roleAssignment.id}' already exists.`,
      );
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.workspaceRepository.saveWorkspace(workspace);
      await this.dependencies.membershipRepository.saveMembership(membership);
      await this.dependencies.roleAssignmentRepository.saveRoleAssignment(roleAssignment);
    };

    try {
      if (this.dependencies.transactionManager) {
        await this.dependencies.transactionManager.runInTransaction(persist);
      } else {
        await persist();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workspace initialization failure.";
      const duplicateError = this.asDuplicateErrorIfPossible(message, workspace.slug);
      if (duplicateError) {
        return duplicateError;
      }
      return this.failure(
        WorkspaceCreationErrorCodes.invalidState,
        `Workspace initialization failed: ${message}`,
      );
    }

    await this.publishWorkspaceCreatedAuditRecordBestEffort({
      workspaceId: workspace.id,
      slug: workspace.slug,
      actorUserIdentityId,
      occurredAt: nowIso,
    });

    return {
      ok: true,
      value: Object.freeze({
        workspace,
        creatorMembership: membership,
        creatorRoleAssignment: roleAssignment,
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

  private asDuplicateErrorIfPossible(
    message: string,
    slug: string,
  ): CreateWorkspaceUseCaseOutcome | undefined {
    const normalized = message.toLowerCase();
    if (!normalized.includes("unique")) {
      return undefined;
    }

    if (normalized.includes("slug")) {
      return this.failure(
        WorkspaceCreationErrorCodes.duplicate,
        `Workspace slug '${slug}' is already in use.`,
      );
    }

    return this.failure(
      WorkspaceCreationErrorCodes.duplicate,
      "Workspace initialization failed because a duplicate record already exists.",
    );
  }

  private async publishWorkspaceCreatedAuditRecordBestEffort(event: {
    readonly workspaceId: string;
    readonly slug: string;
    readonly actorUserIdentityId: string;
    readonly occurredAt: string;
  }): Promise<void> {
    if (!this.dependencies.auditSink) {
      return;
    }

    try {
      await this.dependencies.auditSink.recordWorkspaceCreated(event);
    } catch {
      // Intentionally best-effort until the audit pipeline is integrated in a dedicated story.
    }
  }

  private failure(
    code: WorkspaceCreationErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): CreateWorkspaceUseCaseOutcome {
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
