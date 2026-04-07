import type { AssetSelectorAssetReference, AssetSelectorRequest } from "../../../domain/studio-shell/AssetSelectorContract";

export interface AssetSelectorResultItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly badges?: ReadonlyArray<string>;
  readonly asset: AssetSelectorAssetReference;
}

export interface AssetSelectorQueryResponse {
  readonly items: ReadonlyArray<AssetSelectorResultItem>;
  readonly error?: string;
}

export interface AssetSelectorDataProvider {
  query(input: {
    readonly request: AssetSelectorRequest;
    readonly searchTerm: string;
  }): Promise<AssetSelectorQueryResponse>;
}
