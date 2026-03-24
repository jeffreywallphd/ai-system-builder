import type { IAsset } from "../../../domain/assets/interfaces/IAsset";

export interface IAssetRecordRepository {
  save(asset: IAsset): Promise<void>;
  getById(assetId: string): Promise<IAsset | undefined>;
  list(): Promise<ReadonlyArray<IAsset>>;
  exists(assetId: string): Promise<boolean>;
}
