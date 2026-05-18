import type { AssetReference } from "../asset";
import type { WorkspaceId } from "../workspace";
import type { UserLibraryDiagnostic, UserLibraryFailure } from "./user-library-diagnostics";
import type { UserLibraryProvenanceSummary } from "./user-library-provenance";
import type { UserLibraryAssetReference } from "./user-library-source";
import type { WorkspaceUserLibraryLinkRecord } from "./workspace-user-library-link";

export const USER_LIBRARY_OPERATION_RESULT_STATUSES = [
  "created",
  "existing",
  "linked",
  "copied",
  "imported",
  "skipped",
] as const;

export type UserLibraryOperationResultStatus =
  (typeof USER_LIBRARY_OPERATION_RESULT_STATUSES)[number];

export interface UserLibraryOperationResultBase {
  readonly ok: boolean;
  readonly status?: UserLibraryOperationResultStatus;
  readonly provenance?: UserLibraryProvenanceSummary;
  readonly diagnostics?: readonly UserLibraryDiagnostic[];
  readonly failure?: UserLibraryFailure;
}

export interface PromoteWorkspaceAssetToUserLibraryResult
  extends UserLibraryOperationResultBase {
  readonly userLibraryAssetReference?: UserLibraryAssetReference;
}

export interface LinkUserLibraryAssetToWorkspaceResult
  extends UserLibraryOperationResultBase {
  readonly linkRecord?: WorkspaceUserLibraryLinkRecord;
}

export interface CopyUserLibraryAssetToWorkspaceResult
  extends UserLibraryOperationResultBase {
  readonly targetWorkspaceId?: WorkspaceId;
  readonly copiedAssetReference?: AssetReference;
  readonly relationshipStatus?: "detached-workspace-owned-copy";
}

export interface ImportWorkspaceAssetToWorkspaceResult
  extends UserLibraryOperationResultBase {
  readonly sourceWorkspaceId?: WorkspaceId;
  readonly targetWorkspaceId?: WorkspaceId;
  readonly importedAssetReference?: AssetReference;
  readonly relationshipStatus?: "detached-workspace-owned-copy";
}

export function isUserLibraryOperationResultStatus(
  value: string,
): value is UserLibraryOperationResultStatus {
  return USER_LIBRARY_OPERATION_RESULT_STATUSES.includes(
    value as UserLibraryOperationResultStatus,
  );
}
