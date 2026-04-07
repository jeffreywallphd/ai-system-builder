import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { AssetVersion } from "@domain/assets/AssetVersion";
import type { AssetTransformation } from "@domain/assets/AssetTransformation";
import type { AssetLineageEdge } from "@domain/assets/AssetLineageEdge";
import type { CanonicalAssetIdentityRecord, CanonicalEntityType } from "./ICanonicalAssetIdentityRepository";
import type { AssetLineageDirection } from "./IAssetLineageRepository";
import type {
  TaxonomyBehaviorKind,
  TaxonomySemanticRole,
  TaxonomyStructuralKind,
} from "@domain/taxonomy/CompositionTaxonomy";

export interface CanonicalAssetQueryCriteria {
  readonly kinds?: ReadonlyArray<IAsset["kind"]>;
  readonly sourceTypes?: ReadonlyArray<IAsset["source"]["type"]>;
  readonly statuses?: ReadonlyArray<IAsset["status"]>;
  readonly structuralKinds?: ReadonlyArray<TaxonomyStructuralKind>;
  readonly semanticRoles?: ReadonlyArray<TaxonomySemanticRole>;
  readonly behaviorKinds?: ReadonlyArray<TaxonomyBehaviorKind>;
  readonly limit?: number;
}

export interface IAssetSystemQueryRepository {
  listAssetsByCriteria(criteria?: CanonicalAssetQueryCriteria): Promise<ReadonlyArray<IAsset>>;
  getLatestVersionForAsset(assetId: string): Promise<AssetVersion | undefined>;
  listVersionChainByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>>;
  listTransformationsByAssetId(assetId: string): Promise<ReadonlyArray<AssetTransformation>>;
  listLineageEdgesByAssetId(assetId: string): Promise<ReadonlyArray<AssetLineageEdge>>;
  listAdjacentVersionIds(versionId: string, direction: AssetLineageDirection): Promise<ReadonlyArray<string>>;
  listCanonicalIdentities(params?: { readonly entityType?: CanonicalEntityType; readonly assetId?: string }): Promise<ReadonlyArray<CanonicalAssetIdentityRecord>>;
}

