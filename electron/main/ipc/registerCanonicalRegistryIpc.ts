/**
 * Registers canonical registry IPC handlers used by the renderer to browse, create, and manage local registry-backed assets.
 */
import type { CanonicalRegistryIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerCanonicalRegistryIpc(params: CanonicalRegistryIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;

  ipcMain.handle("ai-loom-desktop-canonical-assets:list", async (_event, criteriaJson?: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return [];
    }
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const assets = await canonicalRuntime.listCanonicalAssetsUseCase.execute(criteria);
    const details = await Promise.all(assets.map((asset: { id: string }) => canonicalRuntime.loadCanonicalAssetDetailUseCase.execute(asset.id)));
    return details
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .map((entry) => JSON.stringify({
        assetId: entry.assetId,
        name: entry.name,
        kind: entry.kind,
        status: entry.status,
        latestVersionId: entry.latestVersion?.versionId,
        versionCount: entry.versionCount,
        transformationCount: entry.transformationCount,
        lineageEdgeCount: entry.lineageEdgeCount,
      }));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets", async (_event, limit?: number) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    return JSON.stringify(await registryBackendApi.listAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets-filter", async (_event, filtersJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const filters = JSON.parse(filtersJson);
    return JSON.stringify(await registryBackendApi.filterAssets(filters));
  });
  ipcMain.handle("ai-loom-desktop-registry:search", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.searchAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:explore-assets", async (_event, limit?: number) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    return JSON.stringify(await registryBackendApi.listExploreAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:explore-search", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.searchExploreAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:asset-detail", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getAssetDetail(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependencies", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependents", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-upstream", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.traverseDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-downstream", async (_event, queryJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.traverseDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:detail", async (_event, assetId: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const detail = await canonicalRuntime.loadCanonicalAssetDetailUseCase.execute(assetId);
    if (!detail) return null;
    return JSON.stringify({
      assetId: detail.assetId,
      name: detail.name,
      kind: detail.kind,
      status: detail.status,
      latestVersionId: detail.latestVersion?.versionId,
      versionCount: detail.versionCount,
      transformationCount: detail.transformationCount,
      lineageEdgeCount: detail.lineageEdgeCount,
    });
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:version-chain", async (_event, assetId: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return [];
    }
    const chain = await canonicalRuntime.getVersionHistoryUseCase.execute(assetId);
    const withState = await Promise.all(chain.map(async (version) => {
      const dependencyState = await canonicalRuntime.dependencyStateUseCase.execute({
        versionId: version.versionId,
        preferPersistedIfFreshMs: 300_000,
      }).catch(() => undefined);
      return JSON.stringify({
        versionId: version.versionId,
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt.toISOString(),
        label: version.versionLabel,
        dependencyState: dependencyState
          ? {
            state: dependencyState.state,
            reasons: dependencyState.reasons,
            nextActions: dependencyState.nextActions,
          }
          : undefined,
      });
    }));
    return withState;
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:dependency-state", async (_event, versionId: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const summary = await canonicalRuntime.dependencyStateUseCase.execute({
      versionId,
      preferPersistedIfFreshMs: 300_000,
    });
    return JSON.stringify({
      versionId: summary.versionId,
      state: summary.state,
      lineageConfidence: summary.lineageConfidence,
      lifecycle: {
        source: summary.lifecycle.source,
        computedAt: summary.lifecycle.computedAt.toISOString(),
        reason: summary.lifecycle.reason,
      },
      reasons: summary.reasons,
      nextActions: summary.nextActions,
    });
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:reconcile-identity", async (_event, entityType: string, entityId: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const reconciled = await canonicalRuntime.reconcileIdentityUseCase.execute({
      entityType: entityType as any,
      entityId,
    });
    return JSON.stringify(reconciled);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:replay-scope", async (_event, entityType: string, entityId: string, versionId?: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return JSON.stringify({ replayed: false, reason: "Canonical asset system is unavailable." });
    }
    const replay = await canonicalRuntime.replayScopedProjectionUseCase.execute({ entityType: entityType as any, entityId, versionId });
    return JSON.stringify(replay);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:verify-projection", async (_event, assetId: string, versionIdsInScope?: ReadonlyArray<string>) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const verification = await canonicalRuntime.verifyProjectionUseCase.execute({ assetId, versionIdsInScope });
    return JSON.stringify(canonicalRuntime.projectionTrustReadModelService.summarize(verification));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:rebuild-scopes", async (_event, requestJson: string) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return JSON.stringify({ totalScopes: 0, replayedScopes: 0, verifiedScopes: 0, results: [] });
    }
    const request = JSON.parse(requestJson);
    const result = await canonicalRuntime.rebuildProjectionOrchestrationUseCase.execute(request);
    return JSON.stringify(result);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:management-snapshot", async (_event, assetId: string, includeProjectionHealth = true, versionIdsInProjectionScope?: ReadonlyArray<string>) => {
    const canonicalRuntime = await onDemand.getCanonicalRegistryRuntime();
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const snapshot = await canonicalRuntime.loadManagementSnapshotUseCase.execute({
      assetId,
      includeProjectionHealth,
      versionIdsInProjectionScope,
    });
    if (!snapshot) {
      return null;
    }
    return JSON.stringify({
      ...snapshot,
      versions: snapshot.versions.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  });
}
