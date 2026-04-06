import type {
  Asset,
  AssetKind,
  AssetLifecycleState,
  AssetVisibility,
} from "../../../domain/assets/AssetDomain";

export interface AssetListQuery {
  readonly workspaceId?: string;
  readonly ownerUserId?: string;
  readonly storageInstanceId?: string;
  readonly assetKinds?: ReadonlyArray<AssetKind>;
  readonly visibilities?: ReadonlyArray<AssetVisibility>;
  readonly lifecycleStates?: ReadonlyArray<AssetLifecycleState>;
  readonly sourceAssetId?: string;
  readonly sourceAssetVersionId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AssetSaveResult {
  readonly changed: boolean;
  readonly asset: Asset;
}

export interface IAssetRepository {
  findAssetById(assetId: string): Promise<Asset | undefined>;
  listAssets(query: AssetListQuery): Promise<ReadonlyArray<Asset>>;
  createAsset(asset: Asset): Promise<AssetSaveResult>;
  saveAsset(asset: Asset): Promise<AssetSaveResult>;
  replaceAssetLineage(
    assetId: string,
    lineage: ReadonlyArray<{
      readonly sourceAssetId: string;
      readonly sourceAssetVersionId?: string;
      readonly relation?: string;
    }>,
  ): Promise<void>;
}
