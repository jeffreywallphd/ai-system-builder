import type {
  IAsset,
  AssetKind,
  AssetLifecycleStatus,
} from "../../../domain/assets/interfaces/IAsset";

export interface IAssetSearchCriteria {
  readonly query?: string;
  readonly ids?: ReadonlyArray<string>;
  readonly kinds?: ReadonlyArray<AssetKind>;
  readonly statuses?: ReadonlyArray<AssetLifecycleStatus>;
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly executionId?: string;
  readonly parentAssetId?: string;
  readonly sourceTypes?: ReadonlyArray<IAsset["source"]["type"]>;
  readonly tags?: ReadonlyArray<string>;
  readonly languageCodes?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface IAssetCatalog {
  /**
   * Lists assets matching the given criteria.
   */
  list(criteria?: IAssetSearchCriteria): Promise<ReadonlyArray<IAsset>>;

  /**
   * Returns one asset by stable ID.
   */
  getById(id: string): Promise<IAsset | undefined>;

  /**
   * Saves or updates an asset record.
   */
  save(asset: IAsset): Promise<void>;

  /**
   * Removes an asset record by stable ID.
   * Returns true when a record was removed.
   */
  remove(id: string): Promise<boolean>;

  /**
   * Returns true when an asset record exists.
   */
  exists(id: string): Promise<boolean>;
}
