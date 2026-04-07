import { useEffect, useMemo, useState } from "react";
import ContextualRecommendationsPanel from "../components/navigation/ContextualRecommendationsPanel";
import { ContextualRecommendationService, ContextualRecommendationSurfaces } from "../routes/ContextualRecommendations";
import { RecentAndFavoritesService } from "../routes/RecentAndFavorites";
import { Link, useLocation, useParams } from "react-router-dom";
import type {
  RegistryDependencyGraph,
  RegistryDependencyGraphNode,
} from "@application/asset-registry/RegistryDependencyGraphService";
import type { RegistryAsset } from "@domain/asset-registry/RegistryAsset";
import {
  AssetContractPanel,
  AssetDependencySummaryPanel,
  AssetLineageView,
  AssetProvenancePanel,
  AssetSummaryPanel,
  SystemAssetDetailsPanel,
  AssetVersionHistoryPanel,
  DependencyGraphPanel,
} from "../components/registry/AssetDetailPanels";
import { AssetValidationSummary, DependencyCompatibilityPanel } from "../components/registry/AssetValidationPanels";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { RegistryService } from "../services/RegistryService";
import { StandardAssetDetailView } from "../components/registry/StandardAssetDetailView";
import AuthorizationSharingManagementPanel from "../components/authorization/AuthorizationSharingManagementPanel";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import { buildAuthorizationSharingDesktopPath, buildAuthorizationSharingThinClientPath } from "../web/authorization/AuthorizationSharingRoutes";

function removeRoot(
  nodes: ReadonlyArray<RegistryDependencyGraphNode>,
  rootVersionId: string | undefined,
): ReadonlyArray<RegistryDependencyGraphNode> {
  return nodes.filter((node) => node.versionId !== rootVersionId);
}

export default function AssetDetailPage(): JSX.Element {
  const { assetId } = useParams<{ assetId: string }>();
  const location = useLocation();
  const service = useMemo(() => new RegistryService(), []);
  const recommendationService = useMemo(() => new ContextualRecommendationService(), []);
  const recentAndFavoritesService = useMemo(() => new RecentAndFavoritesService(), []);
  const [asset, setAsset] = useState<RegistryAsset>();
  const [upstream, setUpstream] = useState<RegistryDependencyGraph>();
  const [downstream, setDownstream] = useState<RegistryDependencyGraph>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [favoriteRevision, setFavoriteRevision] = useState(0);
  const [session] = useState(() => new IdentityAuthSessionStore().getSession());
  const sessionToken = session?.sessionToken;
  const registryContextQuery = useMemo(() => new URLSearchParams(location.search).get("registryContext")?.trim(), [location.search]);
  const registryBackPath = registryContextQuery
    ? `${ROUTE_PATHS.registry}?${registryContextQuery}`
    : ROUTE_PATHS.registry;
  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setLoading(true);
      const normalizedAssetId = decodeURIComponent(assetId ?? "").trim();
      if (!normalizedAssetId) {
        setError("Asset id is required.");
        setLoading(false);
        return;
      }

      const detailResponse = await service.getAssetDetail({ assetId: normalizedAssetId });
      if (!active) {
        return;
      }

      if (!detailResponse.ok || !detailResponse.data) {
        setAsset(undefined);
        setError(detailResponse.error?.message ?? "Failed to load asset detail.");
        setLoading(false);
        return;
      }

      const detail = detailResponse.data;
      setAsset(detail);
      recentAndFavoritesService.recordRecentAsset({
        assetId: detail.assetId,
        title: detail.displayName || detail.assetId,
        launchPath: `/studio-shell/registry/assets/${encodeURIComponent(detail.assetId)}?assetId=${encodeURIComponent(detail.assetId)}`,
      });
      setError(undefined);

      if (!detail.versionId) {
        setUpstream({ nodes: [], edges: [] });
        setDownstream({ nodes: [], edges: [] });
        setLoading(false);
        return;
      }

      const [upstreamResponse, downstreamResponse] = await Promise.all([
        service.getDependencies({ assetId: detail.assetId }),
        service.getDependents({ assetId: detail.assetId }),
      ]);

      if (!active) {
        return;
      }

      if (!upstreamResponse.ok || !downstreamResponse.ok || !upstreamResponse.data || !downstreamResponse.data) {
        setError(upstreamResponse.error?.message ?? downstreamResponse.error?.message ?? "Failed to load dependency graph.");
        setLoading(false);
        return;
      }

      setUpstream(upstreamResponse.data);
      setDownstream(downstreamResponse.data);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [assetId, recentAndFavoritesService, service]);

  if (loading) {
    return <section className="ui-page"><p className="ui-text-secondary">Loading registry asset detailâ€¦</p></section>;
  }

  if (error || !asset) {
    return (
      <section className="ui-page ui-stack ui-stack--sm" data-testid="registry-asset-detail-page">
        <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
          <h1 className="ui-page__title" style={{ margin: 0 }}>Registry Asset</h1>
          <Link className="ui-button ui-button--ghost ui-button--small" to={registryBackPath}>Back to results</Link>
        </div>
        <p className="ui-text-secondary">{error ?? "Asset detail is unavailable."}</p>
      </section>
    );
  }

  const actionContext = {
    asset: {
      assetId: asset.assetId,
      versionId: asset.versionId,
      taxonomy: asset.taxonomy,
    },
    source: "detail" as const,
    registryContextQuery: registryContextQuery ?? undefined,
    buildFlowSessionId: new URLSearchParams(location.search).get("buildFlowSessionId")?.trim() || undefined,
    buildIntent: new URLSearchParams(location.search).get("buildIntent")?.trim() || undefined,
    buildIntentSelectedAt: new URLSearchParams(location.search).get("buildIntentSelectedAt")?.trim() || undefined,
  };
  const relatedAssetIds = [
    ...(upstream?.nodes.map((node) => node.assetId) ?? []),
    ...(downstream?.nodes.map((node) => node.assetId) ?? []),
  ].filter((entry) => entry !== asset.assetId);
  const recommendations = recommendationService.resolve({
    surface: ContextualRecommendationSurfaces.assetDetail,
    assetActionContext: actionContext,
    relatedAssetIds,
  });
  const favoriteItemId = `asset:${asset.assetId}`;
  const isFavorite = useMemo(() => recentAndFavoritesService.isFavorite(favoriteItemId), [favoriteItemId, favoriteRevision, recentAndFavoritesService]);

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="registry-asset-detail-page">
      <StandardAssetDetailView asset={asset} actionContext={actionContext} backPath={registryBackPath} />

      <section className="ui-card">
        <div className="ui-card__header ui-row ui-row--wrap" style={{ justifyContent: "space-between", gap: "var(--space-sm)" }}>
          <div className="ui-stack ui-stack--2xs">
            <h2 className="ui-card__title">Sharing and visibility</h2>
            <p className="ui-card__subtitle">Manage who can access this asset and review effective permission decisions.</p>
          </div>
          <div className="ui-page__actions">
            <Link
              className="ui-button ui-button--secondary ui-button--sm"
              to={buildAuthorizationSharingDesktopPath({
                resourceFamily: "asset",
                resourceType: "asset",
                resourceId: asset.assetId,
              })}
            >
              Open full sharing manager
            </Link>
            <Link
              className="ui-button ui-button--secondary ui-button--sm"
              to={buildAuthorizationSharingThinClientPath({
                resourceFamily: "asset",
                resourceType: "asset",
                resourceId: asset.assetId,
              })}
            >
              Open compact sharing view
            </Link>
          </div>
        </div>
        <div className="ui-card__body">
          {sessionToken ? (
            <AuthorizationSharingManagementPanel
              sessionToken={sessionToken}
              compact
              allowResourceEditing={false}
              initialResource={Object.freeze({
                resourceFamily: "asset",
                resourceType: "asset",
                resourceId: asset.assetId,
              })}
            />
          ) : (
            <p className="ui-text-secondary">Sign in again to load sharing and visibility controls for this asset.</p>
          )}
        </div>
      </section>

      <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between", gap: "0.75rem" }}>
        <ContextualRecommendationsPanel recommendations={recommendations} />
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--small"
          onClick={() => {
            recentAndFavoritesService.toggleFavorite({
              itemId: favoriteItemId,
              title: asset.displayName || asset.assetId,
              launchPath: `/studio-shell/registry/assets/${encodeURIComponent(asset.assetId)}?assetId=${encodeURIComponent(asset.assetId)}` ,
            });
            setFavoriteRevision((value) => value + 1);
          }}
        >
          {isFavorite ? "Remove favorite" : "Add to favorites"}
        </button>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <AssetSummaryPanel asset={asset} />
        <AssetContractPanel asset={asset} />
        <AssetProvenancePanel asset={asset} />
        <AssetDependencySummaryPanel asset={asset} />
        <SystemAssetDetailsPanel asset={asset} />
        <AssetVersionHistoryPanel asset={asset} />
        <AssetLineageView asset={asset} registryContextQuery={registryContextQuery ?? undefined} />
        <AssetValidationSummary asset={asset} />
        <DependencyCompatibilityPanel asset={asset} />
      </div>

      <DependencyGraphPanel
        rootAssetId={asset.assetId}
        rootVersionId={asset.versionId}
        upstreamNodes={removeRoot(upstream?.nodes ?? [], asset.versionId)}
        downstreamNodes={removeRoot(downstream?.nodes ?? [], asset.versionId)}
        registryContextQuery={registryContextQuery}
      />
    </section>
  );
}

