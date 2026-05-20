import type { WorkspaceId } from "../workspace";
import type { EffectiveAssetProjectionId } from "./effective-asset-projection-identity";
import type { EffectiveAssetProjectionPolicy } from "./effective-asset-projection-policy";
import type { SafeEffectiveAssetProjectedFieldPatch } from "./effective-asset-projected-fields";
import type { EffectiveAssetProjectionSource, EffectiveAssetProjectionTarget } from "./effective-asset-projection-source";

export type EffectiveAssetProjectionRefreshReason = "source-updated"|"override-updated"|"override-disabled"|"draft-published"|"source-missing"|"conflict-detected"|"unsafe-field-detected"|"manual-refresh-requested";
export type EffectiveAssetProjectionInvalidationReason = EffectiveAssetProjectionRefreshReason;

export type CreateEffectiveAssetProjectionCommand = { targetWorkspaceId: WorkspaceId; source: EffectiveAssetProjectionSource; target: EffectiveAssetProjectionTarget; policy: EffectiveAssetProjectionPolicy; projectedFieldPatch?: SafeEffectiveAssetProjectedFieldPatch; };
export type RefreshEffectiveAssetProjectionCommand = { targetWorkspaceId: WorkspaceId; projectionId: EffectiveAssetProjectionId; reason: EffectiveAssetProjectionRefreshReason; };
export type InvalidateEffectiveAssetProjectionCommand = { targetWorkspaceId: WorkspaceId; projectionId: EffectiveAssetProjectionId; reason: EffectiveAssetProjectionInvalidationReason; };
export type ReadEffectiveAssetProjectionCommand = { targetWorkspaceId: WorkspaceId; projectionId: EffectiveAssetProjectionId; };
export type ListEffectiveAssetProjectionsCommand = { targetWorkspaceId: WorkspaceId; status?: string; sourceKind?: string; limit?: number; cursor?: string; };
export type PreviewDraftEffectiveAssetProjectionCommand = { targetWorkspaceId: WorkspaceId; source: EffectiveAssetProjectionSource; policy: "draft-preview-only"; projectedFieldPatch?: SafeEffectiveAssetProjectedFieldPatch; };
export type ValidateEffectiveAssetProjectionReadinessCommand = { targetWorkspaceId: WorkspaceId; projectionId: EffectiveAssetProjectionId; requiredPolicy?: EffectiveAssetProjectionPolicy; };
