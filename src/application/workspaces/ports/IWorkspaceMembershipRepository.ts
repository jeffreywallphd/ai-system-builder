import type { WorkspaceMembership } from "@domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceMembershipListQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface IWorkspaceMembershipRepository {
  findMembershipById(membershipId: string): Promise<WorkspaceMembership | undefined>;
  findMembershipByWorkspaceAndUser(
    workspaceId: string,
    userIdentityId: string,
  ): Promise<WorkspaceMembership | undefined>;
  listMemberships(query: WorkspaceMembershipListQuery): Promise<ReadonlyArray<WorkspaceMembership>>;
  saveMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership>;
}

