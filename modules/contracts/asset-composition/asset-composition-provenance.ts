import type { WorkspaceId, WorkspaceActorRef } from "../workspace";
import type { AssetReference } from "../asset";
import type { EffectiveAssetProjectionId } from "../effective-asset-projections";
import type { AssetCompositionNodeId, AssetCompositionPlanId, AssetCompositionRelationshipId } from "./asset-composition-identity";
export type AssetCompositionProvenanceKind="plan-created"|"projection-selected"|"projection-removed"|"node-role-assigned"|"relationship-added"|"relationship-removed"|"compatibility-checked"|"plan-validated"|"plan-archived"|"plan-refreshed-from-projections";
export interface AssetCompositionProvenanceEvent{readonly kind:AssetCompositionProvenanceKind;readonly targetWorkspaceId:WorkspaceId;readonly operationAt:string;readonly planId?:AssetCompositionPlanId;readonly nodeId?:AssetCompositionNodeId;readonly relationshipId?:AssetCompositionRelationshipId;readonly projectionId?:EffectiveAssetProjectionId;readonly effectiveAssetReference?:AssetReference;readonly actor?:WorkspaceActorRef;}
