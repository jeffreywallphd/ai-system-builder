import type { WorkspaceInvitation } from "../../../domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceInvitationListQuery,
  WorkspacePendingInvitationLookupQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface IWorkspaceInvitationRepository {
  findInvitationById(invitationId: string): Promise<WorkspaceInvitation | undefined>;
  findPendingInvitationByEmail(
    query: WorkspacePendingInvitationLookupQuery,
  ): Promise<WorkspaceInvitation | undefined>;
  listInvitations(query: WorkspaceInvitationListQuery): Promise<ReadonlyArray<WorkspaceInvitation>>;
  saveInvitation(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation>;
}
