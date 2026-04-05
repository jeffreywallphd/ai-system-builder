import type { WorkspaceRole, WorkspaceRoleAssignment } from "../../../domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceRoleAssignmentListQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface IWorkspaceRoleAssignmentRepository {
  findRoleAssignmentById(roleAssignmentId: string): Promise<WorkspaceRoleAssignment | undefined>;
  listRoleAssignments(query: WorkspaceRoleAssignmentListQuery): Promise<ReadonlyArray<WorkspaceRoleAssignment>>;
  countActiveRoleAssignments(workspaceId: string, role?: WorkspaceRole): Promise<number>;
  saveRoleAssignment(roleAssignment: WorkspaceRoleAssignment): Promise<WorkspaceRoleAssignment>;
}
