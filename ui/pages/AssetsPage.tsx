import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { CanonicalAssetDetailReadModel } from "../../application/assets-system/AssetManagementReadModels";

export default function AssetsPage(): JSX.Element {
  const { settingsStore, canonicalAssetManagementService } = useUiDependencies();
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());
  const [assets, setAssets] = useState<ReadonlyArray<CanonicalAssetDetailReadModel>>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Loading canonical assets…");

  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);
  useEffect(() => {
    let active = true;
    canonicalAssetManagementService.listAssets()
      .then((items) => {
        if (!active) return;
        setAssets(items);
        setStatusMessage(items.length > 0 ? `Loaded ${items.length} canonical asset record(s).` : "No canonical asset records were found in this runtime.");
      })
      .catch((error) => {
        if (!active) return;
        setStatusMessage(error instanceof Error ? error.message : "Canonical asset listing failed.");
      });
    return () => { active = false; };
  }, [canonicalAssetManagementService]);

  const [entityType, setEntityType] = useState<"workflow-definition" | "installed-model" | "dataset-version">("workflow-definition");
  const [entityId, setEntityId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [managementSnapshot, setManagementSnapshot] = useState<Awaited<ReturnType<typeof canonicalAssetManagementService.loadManagementSnapshot>>>();

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Assets</h1>
          <p className="ui-page__subtitle">
            Browse generated and stored workflow assets.
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <p className="ui-text-secondary">
            Canonical asset management now exposes bounded dependency and reconciliation operations without requiring graph infrastructure in the UI.
          </p>
          <p className="ui-text-small ui-text-secondary">{statusMessage}</p>
          {assets.length > 0 ? (
            <ul className="ui-stack ui-stack--xs">
              {assets.slice(0, 6).map((asset) => (
                <li key={asset.assetId}>
                  <strong>{asset.name}</strong> ({asset.kind}) · latest={asset.latestVersionId ?? "unavailable"} · versions={asset.versionCount}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ui-settings-page__path-summary">
            <div>
              <strong>Inputs:</strong> {settingsState.settings.workspace.inputsDirectory}
            </div>
            <div>
              <strong>Outputs:</strong> {settingsState.settings.workspace.outputsDirectory}
            </div>
          </div>
          <p className="ui-text-small ui-text-secondary">
            Need to move these folders? Update them in <Link to={ROUTE_PATHS.settings}>Settings</Link>.
          </p>
          <div className="ui-stack ui-stack--xs">
            <label className="ui-text-small">
              Canonical entity type
              <select value={entityType} onChange={(event) => setEntityType(event.target.value as typeof entityType)}>
                <option value="workflow-definition">workflow-definition</option>
                <option value="installed-model">installed-model</option>
                <option value="dataset-version">dataset-version</option>
              </select>
            </label>
            <label className="ui-text-small">
              Canonical entity id
              <input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="entity id" />
            </label>
            <label className="ui-text-small">
              Version id (optional)
              <input value={versionId} onChange={(event) => setVersionId(event.target.value)} placeholder="version id" />
            </label>
            <label className="ui-text-small">
              Canonical asset id (for verification)
              <input value={assetId} onChange={(event) => setAssetId(event.target.value)} placeholder="asset id" />
            </label>
            <div className="ui-row">
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={async () => {
                  const result = await canonicalAssetManagementService.reconcileIdentity({ entityType, entityId });
                  setStatusMessage(result?.reason ?? "Reconciliation is unavailable in this runtime.");
                }}
                disabled={!entityId.trim()}
              >
                Reconcile identity
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={async () => {
                  const result = await canonicalAssetManagementService.replayScopedProjection({ entityType, entityId, versionId: versionId || undefined });
                  setStatusMessage(result.replayed ? "Scoped projection replay completed." : (result.reason ?? "Scoped projection replay unavailable."));
                }}
                disabled={!entityId.trim()}
              >
                Replay scoped projection
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={async () => {
                  const result = await canonicalAssetManagementService.verifyProjection({
                    assetId,
                    versionIdsInScope: versionId ? [versionId] : undefined,
                  });
                  if (!result) {
                    setStatusMessage("Projection verification is unavailable in this runtime.");
                    return;
                  }
                  setStatusMessage(result.matched
                    ? `Projection verification passed for '${assetId}'.`
                    : `Projection verification failed with ${result.failedChecks.length} issue(s).`);
                }}
                disabled={!assetId.trim()}
              >
                Verify projection
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={async () => {
                  const result = await canonicalAssetManagementService.rebuildProjectionScopes({
                    scopes: [{
                      scopeType: "entity",
                      entityType,
                      entityId,
                      versionId: versionId || undefined,
                    }],
                    verifyBeforeReplay: true,
                    verifyAfterReplay: true,
                    replayMismatchedVersionsOnly: true,
                  });
                  if (!result) {
                    setStatusMessage("Scoped rebuild orchestration is unavailable in this runtime.");
                    return;
                  }
                  setStatusMessage(`Scoped rebuild processed ${result.totalScopes} scope(s), replayed ${result.replayedScopes}, verified ${result.verifiedScopes}.`);
                }}
                disabled={!entityId.trim()}
              >
                Rebuild + verify scope
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={async () => {
                  const snapshot = await canonicalAssetManagementService.loadManagementSnapshot({
                    assetId,
                    includeProjectionHealth: true,
                    versionIdsInProjectionScope: versionId ? [versionId] : undefined,
                  });
                  setManagementSnapshot(snapshot);
                  if (!snapshot) {
                    setStatusMessage("Canonical management snapshot is unavailable in this runtime.");
                    return;
                  }
                  setStatusMessage(`Loaded management snapshot for '${snapshot.asset.assetId}' with ${snapshot.versions.length} version(s).`);
                }}
                disabled={!assetId.trim()}
              >
                Load management snapshot
              </button>
            </div>
            {managementSnapshot ? (
              <div className="ui-stack ui-stack--xs">
                <p className="ui-text-small">
                  <strong>Lifecycle summary:</strong> healthy={managementSnapshot.dependencyLifecycleSummary.healthy}, impacted={managementSnapshot.dependencyLifecycleSummary.impacted}, stale={managementSnapshot.dependencyLifecycleSummary.stale}, partial={managementSnapshot.dependencyLifecycleSummary.partiallyTrusted}, reconcile={managementSnapshot.dependencyLifecycleSummary.reconciliationNeeded}
                </p>
                {managementSnapshot.existenceExplanation ? (
                  <p className="ui-text-small ui-text-secondary">
                    <strong>Latest version explanation:</strong> {managementSnapshot.existenceExplanation.explanation}
                  </p>
                ) : null}
                {managementSnapshot.projectionHealth ? (
                  <p className="ui-text-small ui-text-secondary">
                    <strong>Projection health:</strong> {managementSnapshot.projectionHealth.matched
                      ? `matched (${managementSnapshot.projectionHealth.trustState})`
                      : `mismatch (${managementSnapshot.projectionHealth.failedChecks.length} check(s) failed, ${managementSnapshot.projectionHealth.mismatchedVersionIds.length} mismatched version(s))`}
                  </p>
                ) : null}
                <p className="ui-text-small ui-text-secondary">
                  <strong>Operational summary:</strong> {managementSnapshot.operationalSummary.explanation}
                </p>
                {managementSnapshot.operationalSummary.recommendedActions.length > 0 ? (
                  <ul className="ui-stack ui-stack--xs">
                    {managementSnapshot.operationalSummary.recommendedActions.map((action) => (
                      <li key={action} className="ui-text-small ui-text-secondary">
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
