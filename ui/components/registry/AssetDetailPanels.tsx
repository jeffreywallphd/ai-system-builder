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
    <DetailPanel title="Asset Summary" testId="registry-asset-summary-panel">
      <div className="ui-text-secondary">{asset.assetId}</div>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <span className="ui-badge">Structure: {asset.taxonomy?.structuralKind ?? "n/a"}</span>
        <span className="ui-badge">Role: {asset.taxonomy?.semanticRole ?? "n/a"}</span>
        <span className="ui-badge">Behavior: {asset.taxonomy?.behaviorKind ?? "n/a"}</span>
      </div>
      <div className="ui-text-small ui-text-secondary">Kind: {asset.kind} · Status: {asset.status}</div>
      <div className="ui-text-small">Latest version: {asset.versionId ?? "unavailable"}</div>
    </DetailPanel>
  );
}

export function AssetContractPanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  return (
    <DetailPanel title="Asset Contract" testId="registry-asset-contract-panel">
      <p className="ui-text-small" style={{ margin: 0 }}>{renderContractText(asset)}</p>
      <div className="ui-text-small ui-text-secondary">
        Parameters: {asset.contract?.parameters.map((parameter) => parameter.id).join(", ") || "None projected"}
      </div>
    </DetailPanel>
  );
}

export function AssetProvenancePanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  return (
    <DetailPanel title="Asset Provenance" testId="registry-asset-provenance-panel">
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

export function AssetVersionHistoryPanel({ asset }: { readonly asset: RegistryAsset }): JSX.Element {
  return (
    <DetailPanel title="Version History" testId="registry-asset-version-history-panel">
      {asset.versionHistory.length === 0 ? (
        <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>No published versions are available.</p>
      ) : (
        <ol className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
          {asset.versionHistory.map((entry) => (
            <li key={entry.versionId}>
              <div className="ui-text-small">
                {entry.versionLabel ? `${entry.versionLabel} · ` : ""}{entry.versionId}
              </div>
              <div className="ui-text-small ui-text-secondary">
                Created {entry.createdAt.toString()}
                {entry.parentVersionId ? ` · Parent ${entry.parentVersionId}` : ""}
              </div>
              <div className="ui-text-small ui-text-secondary">
                Upstream links: {entry.upstreamVersionIds.length}
                {entry.upstreamAdded.length ? ` · +${entry.upstreamAdded.length}` : ""}
                {entry.upstreamRemoved.length ? ` · -${entry.upstreamRemoved.length}` : ""}
              </div>
            </li>
          ))}
        </ol>
      )}
    </DetailPanel>
  );
}

export function AssetLineageView({ asset, registryContextQuery }: { readonly asset: RegistryAsset; readonly registryContextQuery?: string }): JSX.Element {
  return (
    <DetailPanel title="Lineage (Version-Level)" testId="registry-asset-lineage-panel">
      <div className="ui-text-small ui-text-secondary">Root version: {asset.lineage.rootVersionId ?? "unavailable"}</div>
      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <NodeList
          title="Upstream lineage"
          nodes={asset.lineage.upstream}
          emptyMessage="No upstream lineage entries were found."
          registryContextQuery={registryContextQuery}
        />
        <NodeList
          title="Downstream lineage"
          nodes={asset.lineage.downstream}
          emptyMessage="No downstream lineage entries were found."
          registryContextQuery={registryContextQuery}
        />
      </div>
    </DetailPanel>
  );
}

export interface RegistryDependencyGraphProps {
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly upstreamNodes: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly name?: string; readonly depth?: number }>;
  readonly downstreamNodes: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly name?: string; readonly depth?: number }>;
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
  readonly nodes: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly name?: string; readonly depth?: number }>;
  readonly emptyMessage: string;
  readonly registryContextQuery?: string;
}): JSX.Element {
  const sortedNodes = [...nodes].sort((left, right) => {
    const leftDepth = typeof left.depth === "number" ? left.depth : Number.MAX_SAFE_INTEGER;
    const rightDepth = typeof right.depth === "number" ? right.depth : Number.MAX_SAFE_INTEGER;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }

    const leftName = (left.name ?? left.assetId).toLowerCase();
    const rightName = (right.name ?? right.assetId).toLowerCase();
    if (leftName === rightName) {
      return left.versionId.localeCompare(right.versionId);
    }
    return leftName.localeCompare(rightName);
  });

  return (
    <div className="ui-stack ui-stack--2xs">
      <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="ui-text-small ui-text-secondary">{sortedNodes.length} node(s)</span>
      </div>
      {sortedNodes.length === 0 ? (
        <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>{emptyMessage}</p>
      ) : (
        <ul className="ui-stack ui-stack--2xs" style={{ margin: 0, paddingLeft: "1rem" }}>
          {sortedNodes.map((node) => (
            <li key={`${node.assetId}:${node.versionId}`}>
              <Link
                to={registryContextQuery
                  ? `${toDetailPath(node.assetId)}?registryContext=${encodeURIComponent(registryContextQuery)}`
                  : toDetailPath(node.assetId)}
              >
                {node.name ?? node.assetId}
              </Link>
              <span className="ui-text-small ui-text-secondary"> · {node.versionId}</span>
              {typeof node.depth === "number" ? (
                <span className="ui-text-small ui-text-secondary"> · depth {node.depth}</span>
              ) : null}
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
