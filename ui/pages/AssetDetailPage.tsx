import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type {
  RegistryDependencyGraph,
  RegistryDependencyGraphNode,
} from "../../application/asset-registry/RegistryDependencyGraphService";
import type { RegistryAsset } from "../../domain/asset-registry/RegistryAsset";
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
  const [asset, setAsset] = useState<RegistryAsset>();
  const [upstream, setUpstream] = useState<RegistryDependencyGraph>();
  const [downstream, setDownstream] = useState<RegistryDependencyGraph>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
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
  }, [assetId, service]);

  if (loading) {
    return <section className="ui-page"><p className="ui-text-secondary">Loading registry asset detail…</p></section>;
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

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="registry-asset-detail-page">
      <StandardAssetDetailView asset={asset} actionContext={actionContext} backPath={registryBackPath} />

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
