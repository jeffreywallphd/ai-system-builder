import type { IWorkspaceAuthorizationReadRepository } from "./IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "./IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "./IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "./IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "./IWorkspaceRoleAssignmentRepository";

export interface WorkspaceRepositoryPorts {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly invitationRepository: IWorkspaceInvitationRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
}
