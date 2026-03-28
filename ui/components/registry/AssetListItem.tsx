import { Link } from "react-router-dom";
import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";
import { ROUTE_PATHS } from "../../routes/RouteConfig";
import { buildStudioHandoffQuery, resolveStudioRouteFromAsset } from "../../routes/StudioRouteMapping";

export interface AssetListItemProps {
  readonly asset: RegistryAsset;
  readonly registryContextQuery?: string;
}

function toAssetDetailPath(assetId: string, registryContextQuery?: string): string {
  const path = ROUTE_PATHS.registryAssetDetail.replace(":assetId", encodeURIComponent(assetId));
  if (!registryContextQuery) {
    return path;
  }

  return `${path}?registryContext=${encodeURIComponent(registryContextQuery)}`;
}

export function AssetListItem({ asset, registryContextQuery }: AssetListItemProps): JSX.Element {
  const studioRoute = resolveStudioRouteFromAsset(asset);

  return (
    <article className="ui-card" data-testid="registry-asset-item">
      <div className="ui-card__body ui-stack ui-stack--xs">
        <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
          <strong>{asset.name}</strong>
          <span className="ui-text-small ui-text-secondary">{asset.status}</span>
        </div>
        <div className="ui-text-small ui-text-secondary">{asset.assetId}</div>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <span className="ui-badge">Structure: {asset.taxonomy?.structuralKind ?? "n/a"}</span>
          <span className="ui-badge">Role: {asset.taxonomy?.semanticRole ?? "n/a"}</span>
          <span className="ui-badge">Behavior: {asset.taxonomy?.behaviorKind ?? "n/a"}</span>
        </div>
        <div className="ui-text-small ui-text-secondary">
          Latest version: {asset.versionId ?? "unavailable"} · Dependencies: {asset.dependencies.length}
        </div>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <Link to={toAssetDetailPath(asset.assetId, registryContextQuery)} className="ui-button ui-button--ghost ui-button--small">
            View details
          </Link>
          {studioRoute ? (
            <Link
              to={`${studioRoute}?${buildStudioHandoffQuery(asset, { registryContext: registryContextQuery, handoff: "registry" })}`}
              className="ui-button ui-button--ghost ui-button--small"
            >
              Open in studio
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
