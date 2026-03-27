import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";

export interface AssetListItemProps {
  readonly asset: RegistryAsset;
}

export function AssetListItem({ asset }: AssetListItemProps): JSX.Element {
  return (
    <article className="ui-card" data-testid="registry-asset-item">
      <div className="ui-card__body ui-stack ui-stack--xs">
        <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
          <strong>{asset.name}</strong>
          <span className="ui-text-small ui-text-secondary">{asset.status}</span>
        </div>
        <div className="ui-text-small ui-text-secondary">{asset.assetId}</div>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <span className="ui-badge">{asset.taxonomy?.structuralKind ?? "n/a"}</span>
          <span className="ui-badge">{asset.taxonomy?.semanticRole ?? "n/a"}</span>
          <span className="ui-badge">{asset.taxonomy?.behaviorKind ?? "n/a"}</span>
        </div>
        <div className="ui-text-small ui-text-secondary">
          Latest version: {asset.versionId ?? "unavailable"} · Dependencies: {asset.dependencies.length}
        </div>
      </div>
    </article>
  );
}
