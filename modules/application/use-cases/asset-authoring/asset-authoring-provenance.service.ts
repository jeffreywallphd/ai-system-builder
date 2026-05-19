import type { AssetAuthoringProvenance } from "../../../contracts/asset-authoring";
import type { WorkspaceId } from "../../../contracts/workspace";

export const createAuthoredFromScratchProvenance = (targetWorkspaceId: WorkspaceId, operationAt: string): AssetAuthoringProvenance => ({ kind: "authored-from-scratch", targetWorkspaceId, operationAt });
export const createRevisedAuthoredAssetProvenance = (targetWorkspaceId: WorkspaceId, operationAt: string): AssetAuthoringProvenance => ({ kind: "revised-authored-asset", targetWorkspaceId, operationAt });
export const createEditedAuthoredAssetProvenance = (targetWorkspaceId: WorkspaceId, operationAt: string): AssetAuthoringProvenance => ({ kind: "edited-authored-asset", targetWorkspaceId, operationAt });
