import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceEncryptionKeyScope,
  WorkspaceEncryptionMode,
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
} from "@domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";
import {
  WorkspaceIdNamespaces,
  type WorkspaceIdNamespace,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  WorkspaceAdministrationAuditEventTypes,
  publishWorkspaceAdministrationAuditEventBestEffort,
  type WorkspaceAdministrationAuditSink,
} from "./WorkspaceAdministrationAudit";
import type {
  DeploymentPolicyEvaluationContext,
  DeploymentWorkspaceVisibility,
} from "@application/policy-administration/DeploymentPolicyEvaluationContracts";
import type { IDeploymentAuthorizationPolicyEvaluationPort } from "@application/policy-administration/DeploymentPolicyEvaluationPorts";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

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
  readonly encryptionPolicy?: {
    readonly encryptionMode?: WorkspaceEncryptionMode;
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: WorkspaceEncryptionKeyScope;
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
  };
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

export interface WorkspaceCreationDeploymentPolicyContextResolver {
  resolveContext(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceSlug: string;
    readonly occurredAt: string;
  }): Promise<DeploymentPolicyEvaluationContext | undefined>;
}

export type WorkspaceCreationAuditSink = WorkspaceAdministrationAuditSink;

interface CreateWorkspaceUseCaseDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceCreationIdGenerator;
  readonly clock: WorkspaceCreationClock;
  readonly authorizationHook?: WorkspaceCreationAuthorizationHook;
  readonly deploymentAuthorizationPolicyPort?: IDeploymentAuthorizationPolicyEvaluationPort;
  readonly deploymentPolicyContextResolver?: WorkspaceCreationDeploymentPolicyContextResolver;
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
      const resolvedVisibility = await this.resolveWorkspaceVisibility({
        requestedVisibility: input.visibility,
        actorUserIdentityId,
        slug: input.slug,
        occurredAt: nowIso,
      });
      workspace = createWorkspace({
        id: workspaceId,
        slug: input.slug,
        displayName: input.displayName,
        description: input.description,
        encryptionPolicy: input.encryptionPolicy,
        ownerUserId: actorUserIdentityId,
        visibility: resolvedVisibility,
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

    await publishWorkspaceAdministrationAuditEventBestEffort(this.dependencies.auditSink, {
      type: WorkspaceAdministrationAuditEventTypes.workspaceCreated,
      workspaceId: workspace.id,
      actorUserIdentityId,
      occurredAt: nowIso,
      details: Object.freeze({
        slug: workspace.slug,
        status: workspace.status,
        visibility: workspace.ownership.visibility,
        encryptionPolicy: workspace.encryptionPolicy,
      }),
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

  private async resolveWorkspaceVisibility(input: {
    readonly requestedVisibility: WorkspaceVisibility | undefined;
    readonly actorUserIdentityId: string;
    readonly slug: string;
    readonly occurredAt: string;
  }): Promise<WorkspaceVisibility | undefined> {
    if (input.requestedVisibility) {
      return input.requestedVisibility;
    }
    if (!this.dependencies.deploymentAuthorizationPolicyPort || !this.dependencies.deploymentPolicyContextResolver) {
      return undefined;
    }

    const context = await this.dependencies.deploymentPolicyContextResolver.resolveContext({
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceSlug: input.slug,
      occurredAt: input.occurredAt,
    });
    if (!context) {
      return undefined;
    }

    const authorizationPolicy = await this.dependencies.deploymentAuthorizationPolicyPort.evaluateAuthorizationPolicy(context);
    return this.mapDeploymentVisibility(authorizationPolicy.defaultWorkspaceVisibility.value);
  }

  private mapDeploymentVisibility(value: DeploymentWorkspaceVisibility): WorkspaceVisibility {
    if (value === "private") {
      return WorkspaceVisibilities.private;
    }
    if (value === "workspace") {
      return WorkspaceVisibilities.team;
    }
    return WorkspaceVisibilities.public;
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

