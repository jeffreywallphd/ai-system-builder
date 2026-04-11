import type { DesktopIpcRendererLike } from "./types";

export function createCanonicalAssetsBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    listAssets(criteriaJson?: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:list", criteriaJson) as Promise<ReadonlyArray<string>>;
    },
    loadAssetDetail(assetId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:detail", assetId) as Promise<string | null>;
    },
    listVersionChain(assetId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:version-chain", assetId) as Promise<ReadonlyArray<string>>;
    },
    evaluateDependencyState(versionId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:dependency-state", versionId) as Promise<string | null>;
    },
    reconcileIdentity(entityType: string, entityId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:reconcile-identity", entityType, entityId) as Promise<string | null>;
    },
    replayScopedProjection(entityType: string, entityId: string, versionId?: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:replay-scope", entityType, entityId, versionId) as Promise<string>;
    },
    verifyProjection(assetId: string, versionIdsInScope?: ReadonlyArray<string>) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:verify-projection", assetId, versionIdsInScope) as Promise<string | null>;
    },
    rebuildProjectionScopes(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:rebuild-scopes", requestJson) as Promise<string>;
    },
    loadManagementSnapshot(assetId: string, includeProjectionHealth = true, versionIdsInProjectionScope?: ReadonlyArray<string>) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:management-snapshot", assetId, includeProjectionHealth, versionIdsInProjectionScope) as Promise<string | null>;
    },
  });
}
