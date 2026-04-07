import type { AssetVersion } from "@domain/assets/AssetVersion";

export interface IAssetVersionRepository {
  saveVersion(version: AssetVersion): Promise<void>;
  getByVersionId(versionId: string): Promise<AssetVersion | undefined>;
  listVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>>;
}

