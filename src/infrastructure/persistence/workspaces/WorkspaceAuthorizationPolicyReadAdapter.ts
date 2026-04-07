import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "@application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "@application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "@application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { RoleAssignmentScopes, RoleAssignmentStatuses, type PermissionGrant, createRoleAssignment } from "@domain/authorization/AuthorizationDomain";
import { WorkspaceMembershipStatuses, WorkspaceRoleAssignmentStatuses } from "@domain/workspaces/WorkspaceDomain";

export interface WorkspaceAuthorizationPolicyReadAdapterDependencies {
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
}

export class WorkspaceAuthorizationPolicyReadAdapter
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public constructor(private readonly dependencies: WorkspaceAuthorizationPolicyReadAdapterDependencies) {}

  public async getActorRoleGrantSnapshot(
    query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    const actorUserIdentityId = normalizeOptional(query.actor.actorUserIdentityId);
    const workspaceId = normalizeOptional(query.actor.activeWorkspaceId);
    if (!actorUserIdentityId || !workspaceId) {
      return emptyRoleGrantSnapshot();
    }

    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: query.asOf,
    });
    if (!snapshot || snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return emptyRoleGrantSnapshot();
    }

    const roleAssignments = snapshot.activeRoleAssignments
      .filter((assignment) => assignment.status === WorkspaceRoleAssignmentStatuses.active)
      .map((assignment) => createRoleAssignment({
        id: assignment.id,
        actorUserIdentityId,
        roleKey: assignment.role,
        scope: RoleAssignmentScopes.workspace,
        workspaceId,
        status: RoleAssignmentStatuses.active,
        assignedByUserIdentityId: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
      }));

    return Object.freeze({
      roleAssignments: Object.freeze(roleAssignments),
      permissionGrants: Object.freeze([] as PermissionGrant[]),
    });
  }

  public async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return Object.freeze([]);
  }

  public async findResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return undefined;
  }

  public async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([]);
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function emptyRoleGrantSnapshot(): AuthorizationActorRoleGrantSnapshot {
  return Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
}

