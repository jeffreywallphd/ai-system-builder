import { useState } from "react";
import type { CanonicalAssetDetailReadModel, CanonicalVersionChainItemReadModel } from "@application/assets-system/AssetManagementReadModels";
import type { CanonicalAssetManagementService } from "../../services/CanonicalAssetManagementService";

interface OutputAssetExplorerPanelProps {
  readonly title: string;
  readonly canonicalAssetManagementService: CanonicalAssetManagementService;
  readonly assetIds: ReadonlyArray<string>;
  readonly emptyMessage: string;
}

export function OutputAssetExplorerPanel(props: OutputAssetExplorerPanelProps): JSX.Element {
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [assetDetail, setAssetDetail] = useState<CanonicalAssetDetailReadModel | undefined>();
  const [versions, setVersions] = useState<ReadonlyArray<CanonicalVersionChainItemReadModel>>([]);
  const [status, setStatus] = useState<string>("");

  if (props.assetIds.length < 1) {
    return (
      <div className="ui-card ui-stack ui-stack--xs" data-testid="output-asset-explorer-panel">
        <h4 className="ui-heading-4">{props.title}</h4>
        <p className="ui-text-secondary">{props.emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className="ui-card ui-stack ui-stack--xs" data-testid="output-asset-explorer-panel">
      <h4 className="ui-heading-4">{props.title}</h4>
      <div className="ui-row ui-row--wrap">
        {props.assetIds.map((assetId) => (
          <button
            key={assetId}
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={async () => {
              setSelectedAssetId(assetId);
              setStatus(`Loading canonical detail for ${assetId}...`);
              const [detail, versionChain] = await Promise.all([
                props.canonicalAssetManagementService.loadAssetDetail(assetId),
                props.canonicalAssetManagementService.listVersionChain(assetId),
              ]);
              setAssetDetail(detail);
              setVersions(versionChain);
              setStatus(detail ? `Loaded canonical asset ${detail.assetId}.` : `No canonical asset detail found for ${assetId}.`);
            }}
            aria-pressed={selectedAssetId === assetId}
          >
            {assetId}
          </button>
        ))}
      </div>
      {status ? <p className="ui-text-small ui-text-secondary">{status}</p> : null}
      {assetDetail ? (
        <div className="ui-stack ui-stack--2xs">
          <p className="ui-text-small">
            <strong>{assetDetail.name}</strong> ({assetDetail.kind}) Â· status={assetDetail.status} Â· latest={assetDetail.latestVersionId ?? "n/a"}
          </p>
          {assetDetail.taxonomy ? (
            <p className="ui-text-small ui-text-secondary">
              taxonomy {assetDetail.taxonomy.structuralKind}/{assetDetail.taxonomy.semanticRole}/{assetDetail.taxonomy.behaviorKind}
            </p>
          ) : null}
          <p className="ui-text-small ui-text-secondary">
            versions={assetDetail.versionCount}, transforms={assetDetail.transformationCount}, lineageEdges={assetDetail.lineageEdgeCount}
          </p>
          {versions.length > 0 ? (
            <details>
              <summary><strong>Version lineage ({versions.length})</strong></summary>
              <ul className="ui-stack ui-stack--xs">
                {versions.map((version) => (
                  <li key={version.versionId} className="ui-text-small ui-text-secondary">
                    {version.versionId}
                    {version.parentVersionId ? ` <- ${version.parentVersionId}` : ""}
                    {version.dependencyState ? ` Â· ${version.dependencyState.state}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

