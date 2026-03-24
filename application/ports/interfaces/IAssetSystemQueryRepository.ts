import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import type { AssetLineageDirection } from "./IAssetLineageRepository";

export interface CanonicalAssetQueryCriteria {
  readonly kinds?: ReadonlyArray<IAsset["kind"]>;
  readonly sourceTypes?: ReadonlyArray<IAsset["source"]["type"]>;
  readonly statuses?: ReadonlyArray<IAsset["status"]>;
  readonly limit?: number;
}

export interface IAssetSystemQueryRepository {
  listAssetsByCriteria(criteria?: CanonicalAssetQueryCriteria): Promise<ReadonlyArray<IAsset>>;
  getLatestVersionForAsset(assetId: string): Promise<AssetVersion | undefined>;
  listTransformationsByAssetId(assetId: string): Promise<ReadonlyArray<AssetTransformation>>;
  listAdjacentVersionIds(versionId: string, direction: AssetLineageDirection): Promise<ReadonlyArray<string>>;
}
