import type { AddProjectionToCompositionPlanCommand, AssetCompositionNode, AssetCompositionNodeRole, SelectedAssetProjectionReference } from "../../../contracts/asset-composition";
import type { EffectiveAssetProjectionRecord } from "../../../contracts/effective-asset-projections";

export const createSelectedProjectionReference = (
  projection: EffectiveAssetProjectionRecord,
  selectedAt: string,
): SelectedAssetProjectionReference => ({
  targetWorkspaceId: projection.targetWorkspaceId,
  projectionId: projection.projectionId,
  effectiveAssetReference: projection.effectiveAssetReference,
  projectionStatusAtSelection: projection.status,
  projectionSourceKind: projection.sourceKind,
  displayLabel: projection.target.displayLabel,
  selectedAt,
});

export const createCompositionNodeFromProjection = (d: {
  projection: EffectiveAssetProjectionRecord;
  selectedProjection: SelectedAssetProjectionReference;
  command: AddProjectionToCompositionPlanCommand;
  nodeId: string;
  now: string;
}): AssetCompositionNode => ({
  nodeId: d.nodeId as never,
  targetWorkspaceId: d.projection.targetWorkspaceId,
  selectedProjection: d.selectedProjection,
  effectiveAssetReference: d.projection.effectiveAssetReference,
  role: ((d.command as AddProjectionToCompositionPlanCommand & { role?: AssetCompositionNodeRole }).role ?? "supporting-asset") as AssetCompositionNodeRole,
  status: "ready-for-planning",
  requiredCapabilities: [],
  providedCapabilities: [],
  diagnostics: [],
  blockers: [],
  label: d.command.label ?? d.projection.target.displayLabel,
  summary: d.projection.target.effectiveSummary,
  createdAt: d.now,
  updatedAt: d.now,
});
