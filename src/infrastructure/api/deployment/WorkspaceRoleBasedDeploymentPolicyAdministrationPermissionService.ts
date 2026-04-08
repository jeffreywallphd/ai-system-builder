import type { IWorkspaceRoleAssignmentRepository } from "@application/workspaces/ports/IWorkspaceRoleAssignmentRepository";
import {
  DeploymentPolicyAdministrationPermissionKeys,
  type DeploymentPolicyAdministrationPermissionDecision,
  type DeploymentPolicyAdministrationPermissionKey,
  type IDeploymentPolicyAdministrationPermissionService,
} from "@application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import {
  DeploymentPolicyPersistenceScopeKinds,
  type DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
} from "@domain/workspaces/WorkspaceDomain";

export interface WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionServiceDependencies {
  readonly workspaceRoleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
}

export class WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService
implements IDeploymentPolicyAdministrationPermissionService {
  public constructor(
    private readonly dependencies: WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionServiceDependencies,
  ) {}

  public async evaluatePermission(input: {
    readonly actorUserIdentityId: string;
    readonly requiredPermission: DeploymentPolicyAdministrationPermissionKey;
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly asOf?: string;
  }): Promise<DeploymentPolicyAdministrationPermissionDecision> {
    const actorUserIdentityId = input.actorUserIdentityId.trim();
    const workspaceId = input.scope.scopeId.trim().toLowerCase();
    if (!actorUserIdentityId || !workspaceId) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-policy-permission-invalid-actor-or-scope",
        reason: "Actor identity and workspace scope are required for deployment-policy administration.",
      });
    }

    if (input.scope.kind !== DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-policy-permission-unsupported-scope",
        reason: `Unsupported scope kind '${input.scope.kind}'.`,
      });
    }

    const allowedRoles = input.requiredPermission === DeploymentPolicyAdministrationPermissionKeys.readState
      ? Object.freeze([WorkspaceRoles.owner, WorkspaceRoles.admin])
      : Object.freeze([WorkspaceRoles.owner]);

    const roleAssignments = await this.dependencies.workspaceRoleAssignmentRepository.listRoleAssignments({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      statuses: Object.freeze([WorkspaceRoleAssignmentStatuses.active]),
      roles: allowedRoles,
      limit: 1,
    });

    if (roleAssignments.length > 0) {
      return Object.freeze({
        allowed: true,
      });
    }

    return Object.freeze({
      allowed: false,
      reasonCode: "deployment-policy-permission-admin-role-required",
      reason: input.requiredPermission === DeploymentPolicyAdministrationPermissionKeys.readState
        ? `Workspace owner or admin role is required for '${input.requiredPermission}'.`
        : `Workspace owner role is required for '${input.requiredPermission}'.`,
    });
  }
}
