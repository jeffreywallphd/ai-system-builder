import { Link } from "react-router-dom";
import type { ExploreAssetSummary } from "../../../application/asset-registry/ExploreAssetQueryService";
import { ROUTE_PATHS } from "../../routes/RouteConfig";

export interface ExploreAssetListProps {
  readonly assets: ReadonlyArray<ExploreAssetSummary>;
  readonly isLoading?: boolean;
  readonly error?: string;
  readonly registryContextQuery?: string;
}

function buildDetailPath(assetId: string, registryContextQuery?: string): string {
  const encoded = encodeURIComponent(assetId);
  const base = ROUTE_PATHS.registryAssetDetail.replace(":assetId", encoded);
  if (!registryContextQuery) {
    return base;
  }

  return `${base}?${registryContextQuery}`;
}

export function ExploreAssetList({ assets, isLoading, error, registryContextQuery }: ExploreAssetListProps): JSX.Element {
  if (isLoading) {
    return <p className="ui-text-secondary">Loading explore assets…</p>;
  }

  if (error) {
    return <p className="ui-text-secondary">Explore error: {error}</p>;
  }

  if (assets.length === 0) {
    return <p className="ui-text-secondary">No assets match the current explore query.</p>;
  }

  return (
    <div className="ui-stack ui-stack--sm" data-testid="explore-asset-list">
      {assets.map((asset) => (
        <article key={asset.id.assetId} className="ui-card" data-testid="explore-asset-item">
          <div className="ui-card__body ui-stack ui-stack--xs">
            <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{asset.displayName}</h3>
              <span className="ui-pill ui-pill--neutral">{asset.primaryLabel}</span>
            </div>
            <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>{asset.id.assetId}</p>
            <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
              <span className="ui-pill ui-pill--neutral">{asset.assetKind}</span>
              {asset.metadata.sourceType ? <span className="ui-pill ui-pill--neutral">source: {asset.metadata.sourceType}</span> : null}
              <span className="ui-pill ui-pill--neutral">status: {asset.status}</span>
              {asset.taxonomy?.semanticRole ? <span className="ui-pill ui-pill--neutral">taxonomy: {asset.taxonomy.semanticRole}</span> : null}
            </div>
            <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="ui-text-small ui-text-secondary">{asset.metadata.dependencyCount} upstream dep(s) • {asset.metadata.versionCount} version(s)</span>
              <Link className="ui-button ui-button--ghost ui-button--small" to={buildDetailPath(asset.id.assetId, registryContextQuery)}>
                View details
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
