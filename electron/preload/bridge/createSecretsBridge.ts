import type { DesktopIpcRendererLike } from "./types";

export function createSecretsBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    isAvailable() {
      return ipcRenderer.sendSync("ai-loom-desktop-secrets:is-available") as boolean;
    },
    getSecret(key: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-secrets:get", key) as string | null;
    },
    setSecret(key: string, value: string) {
      ipcRenderer.sendSync("ai-loom-desktop-secrets:set", key, value);
    },
    removeSecret(key: string) {
      ipcRenderer.sendSync("ai-loom-desktop-secrets:remove", key);
    },
  });
}
