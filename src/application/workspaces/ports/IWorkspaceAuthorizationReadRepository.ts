import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface IWorkspaceAuthorizationReadRepository {
  getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined>;
}
