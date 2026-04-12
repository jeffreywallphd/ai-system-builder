import type { Workspace } from "@domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceListQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface IWorkspaceRepository {
  findWorkspaceById(workspaceId: string): Promise<Workspace | undefined>;
  findWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  listWorkspaces(query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>>;
  saveWorkspace(workspace: Workspace): Promise<Workspace>;
}

