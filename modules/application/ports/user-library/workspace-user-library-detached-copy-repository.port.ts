import type { AssetMetadata, AssetReference } from "../../../contracts/asset";
import type { WorkspaceId } from "../../../contracts/workspace";
import type { UserLibraryAssetReference, UserLibraryProvenanceSummary } from "../../../contracts/user-library";

export type WorkspaceUserLibraryDetachedCopyStatus = "active" | "archived" | "deleting";

export interface WorkspaceUserLibraryDetachedCopyRecord {
  readonly copyId: string;
  readonly targetWorkspaceId: WorkspaceId;
  readonly copiedAssetReference: AssetReference;
  readonly sourceUserLibraryAssetReference: UserLibraryAssetReference;
  readonly selectedVersion: string;
  readonly relationshipStatus: "detached-workspace-owned-copy";
  readonly status: WorkspaceUserLibraryDetachedCopyStatus;
  readonly provenance: UserLibraryProvenanceSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata?: AssetMetadata;
}

export interface WorkspaceUserLibraryDetachedCopyFindQuery {
  readonly targetWorkspaceId: WorkspaceId;
  readonly sourceUserLibraryAssetReference: UserLibraryAssetReference;
  readonly selectedVersion: string;
}

export interface WorkspaceUserLibraryDetachedCopyRepositoryPort {
  saveWorkspaceUserLibraryDetachedCopyRecord(
    record: WorkspaceUserLibraryDetachedCopyRecord,
  ): Promise<WorkspaceUserLibraryDetachedCopyRecord>;
  findWorkspaceUserLibraryDetachedCopyRecord(
    query: WorkspaceUserLibraryDetachedCopyFindQuery,
  ): Promise<WorkspaceUserLibraryDetachedCopyRecord | undefined>;
}
