import { Link } from "react-router-dom";
import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";
import { ROUTE_PATHS } from "../../routes/RouteConfig";
import { StudioEntryService } from "../../routes/StudioRouteMapping";
import { UxStudioEntryLabelResolver } from "../../taxonomy/UxTaxonomySuppression";

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
  const studioEntryService = new StudioEntryService();
  const labelResolver = new UxStudioEntryLabelResolver();
  const studioRoute = studioEntryService.buildStudioRoute({
    requestedRole: asset.taxonomy?.semanticRole,
    mode: "asset",
    asset: { assetId: asset.assetId, versionId: asset.versionId, taxonomy: asset.taxonomy },
    entryContext: { source: "registry", registryContext: registryContextQuery },
  });

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
              to={studioRoute}
              className="ui-button ui-button--ghost ui-button--small"
            >
              {labelResolver.resolveOpenLabel(asset.taxonomy)}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
