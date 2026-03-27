import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";
import { ROUTE_PATHS } from "../../routes/RouteConfig";

interface DetailPanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly testId: string;
}

function DetailPanel({ title, children, testId }: DetailPanelProps): JSX.Element {
  return (
    <section className="ui-card" data-testid={testId}>
      <div className="ui-card__body ui-stack ui-stack--xs">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function renderContractText(asset: RegistryAsset): string {
  const execution = asset.contract?.execution;
  if (!execution) {
    return "No contract execution posture was projected for this asset.";
  }

  return `${execution.invocationMode} invocation with ${execution.sideEffects} side effects.`;
}

export function AssetSummaryPanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  return (
    <DetailPanel title="Summary" testId="registry-asset-summary-panel">
      <div className="ui-text-secondary">{asset.assetId}</div>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <span className="ui-badge">{asset.taxonomy?.structuralKind ?? "n/a"}</span>
        <span className="ui-badge">{asset.taxonomy?.semanticRole ?? "n/a"}</span>
        <span className="ui-badge">{asset.taxonomy?.behaviorKind ?? "n/a"}</span>
      </div>
      <div className="ui-text-small ui-text-secondary">Kind: {asset.kind} · Status: {asset.status}</div>
      <div className="ui-text-small">Latest version: {asset.versionId ?? "unavailable"}</div>
    </DetailPanel>
  );
}

export function AssetContractPanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  return (
    <DetailPanel title="Contract" testId="registry-asset-contract-panel">
      <p className="ui-text-small" style={{ margin: 0 }}>{renderContractText(asset)}</p>
      <div className="ui-text-small ui-text-secondary">
        Parameters: {asset.contract?.parameters.map((parameter) => parameter.id).join(", ") || "None projected"}
      </div>
    </DetailPanel>
  );
}

export function AssetProvenancePanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  return (
    <DetailPanel title="Provenance" testId="registry-asset-provenance-panel">
      <div className="ui-text-small">Creator: {asset.provenance.creatorId ?? "unknown"}</div>
      <div className="ui-text-small">Source: {asset.provenance.sourceType ?? "unknown"} ({asset.provenance.sourceLabel ?? "unspecified"})</div>
      <div className="ui-text-small">Derivation context: {asset.provenance.derivationContext ?? "none"}</div>
      <div className="ui-text-small ui-text-secondary">
        Upstream assets: {asset.provenance.upstreamAssets.length} · Direct upstream versions: {asset.provenance.directUpstreamVersionIds.length}
      </div>
    </DetailPanel>
  );
}

export function AssetDependencySummaryPanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  const upstream = asset.dependencies.filter((entry) => entry.direction === "upstream");
  const downstream = asset.dependencies.filter((entry) => entry.direction === "downstream");

  return (
    <DetailPanel title="Dependency Summary" testId="registry-asset-dependency-summary-panel">
      <div className="ui-text-small">Direct dependencies (upstream): {upstream.length}</div>
      <div className="ui-text-small">Direct dependents (downstream): {downstream.length}</div>
      <div className="ui-text-small ui-text-secondary">
        Sources: {[...new Set(asset.dependencies.map((entry) => entry.source))].join(", ") || "none"}
      </div>
    </DetailPanel>
  );
}

export interface RegistryDependencyGraphProps {
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly upstreamNodes: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly name?: string }>;
  readonly downstreamNodes: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly name?: string }>;
  readonly registryContextQuery?: string;
}

function toDetailPath(assetId: string): string {
  return ROUTE_PATHS.registryAssetDetail.replace(":assetId", encodeURIComponent(assetId));
}

function NodeList({
  title,
  nodes,
  emptyMessage,
  registryContextQuery,
}: {
  readonly title: string;
  readonly nodes: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly name?: string }>;
  readonly emptyMessage: string;
  readonly registryContextQuery?: string;
}): JSX.Element {
  return (
    <div className="ui-stack ui-stack--2xs">
      <h3 style={{ margin: 0 }}>{title}</h3>
      {nodes.length === 0 ? (
        <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>{emptyMessage}</p>
      ) : (
        <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
          {nodes.map((node) => (
            <li key={`${node.assetId}:${node.versionId}`}>
              <Link
                to={registryContextQuery
                  ? `${toDetailPath(node.assetId)}?registryContext=${encodeURIComponent(registryContextQuery)}`
                  : toDetailPath(node.assetId)}
              >
                {node.name ?? node.assetId}
              </Link>
              <span className="ui-text-small ui-text-secondary"> · {node.versionId}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DependencyGraphPanel({
  rootAssetId,
  rootVersionId,
  upstreamNodes,
  downstreamNodes,
  registryContextQuery,
}: RegistryDependencyGraphProps): JSX.Element {
  return (
    <DetailPanel title="Dependency Graph" testId="registry-asset-graph-panel">
      <div className="ui-text-small ui-text-secondary">
        Root asset: {rootAssetId} · Version: {rootVersionId ?? "unavailable"}
      </div>
      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <NodeList
          title="Upstream dependencies"
          nodes={upstreamNodes}
          emptyMessage="No direct upstream dependencies were found."
          registryContextQuery={registryContextQuery}
        />
        <NodeList
          title="Downstream dependents"
          nodes={downstreamNodes}
          emptyMessage="No direct downstream dependents were found."
          registryContextQuery={registryContextQuery}
        />
      </div>
    </DetailPanel>
  );
}
