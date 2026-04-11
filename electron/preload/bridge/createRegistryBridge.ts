import type { DesktopIpcRendererLike } from "./types";

export function createRegistryBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    listAssets(limit?: number) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:assets", limit) as Promise<string>;
    },
    filterAssets(filtersJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:assets-filter", filtersJson) as Promise<string>;
    },
    searchAssets(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:search", queryJson) as Promise<string>;
    },
    listExploreAssets(limit?: number) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:explore-assets", limit) as Promise<string>;
    },
    searchExploreAssets(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:explore-search", queryJson) as Promise<string>;
    },
    getAssetDetail(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:asset-detail", queryJson) as Promise<string>;
    },
    getDependencies(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:dependencies", queryJson) as Promise<string>;
    },
    getDependents(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:dependents", queryJson) as Promise<string>;
    },
    traverseUpstream(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:traverse-upstream", queryJson) as Promise<string>;
    },
    traverseDownstream(queryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:traverse-downstream", queryJson) as Promise<string>;
    },
  });
}
