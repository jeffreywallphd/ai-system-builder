import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";
import { AssetListItem } from "./AssetListItem";

export interface AssetListProps {
  readonly assets: ReadonlyArray<RegistryAsset>;
  readonly isLoading?: boolean;
  readonly error?: string;
}

export function AssetList({ assets, isLoading, error }: AssetListProps): JSX.Element {
  if (isLoading) {
    return <p className="ui-text-secondary">Loading registry assets…</p>;
  }

  if (error) {
    return <p className="ui-text-secondary">Registry error: {error}</p>;
  }

  if (assets.length === 0) {
    return <p className="ui-text-secondary">No registry assets match the current filters.</p>;
  }

  return (
    <div className="ui-stack ui-stack--sm" data-testid="registry-asset-list">
      {assets.map((asset) => <AssetListItem key={asset.assetId} asset={asset} />)}
    </div>
  );
}
