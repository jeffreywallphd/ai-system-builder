import type { EffectiveAssetProjectionProvenance, EffectiveAssetProjectionSource } from "../../../contracts/effective-asset-projections";
import type { WorkspaceId } from "../../../contracts/workspace";

export const createProjectionProvenance = (targetWorkspaceId: WorkspaceId, source: EffectiveAssetProjectionSource, operationAt: string): EffectiveAssetProjectionProvenance => ({
  targetWorkspaceId,
  sourceWorkspaceId: source.sourceWorkspaceId,
  authoredAssetId: source.authoredAssetId,
  revisionId: source.revisionId,
  draftId: source.draftId,
  operationAt,
  sourceKind: source.sourceKind,
});
