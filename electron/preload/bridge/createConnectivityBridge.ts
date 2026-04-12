import type { DesktopIpcRendererLike } from "./types";

export function createConnectivityBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    getConnectivityState() {
      return ipcRenderer.invoke("ai-loom-desktop-connectivity:get-state") as Promise<string>;
    },
    setOfflineMode(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-connectivity:set-offline-mode", requestJson) as Promise<string>;
    },
  });
}
