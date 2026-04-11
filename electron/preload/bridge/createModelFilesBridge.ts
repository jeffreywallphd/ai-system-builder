import type { DesktopIpcRendererLike } from "./types";

export function createModelFilesBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    exists(modelPath: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:exists", modelPath) as boolean;
    },
    stat(modelPath: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:stat", modelPath) as { path: string; kind: "file" | "directory"; size?: number; modifiedAt?: string };
    },
    read(modelPath: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:read", modelPath) as Uint8Array;
    },
    write(request: { path: string; content: Uint8Array; overwrite?: boolean; createDirectories?: boolean }) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:write", request);
    },
    delete(modelPath: string) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:delete", modelPath);
    },
    list(modelPath: string, options?: { recursive?: boolean }) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:list", modelPath, options) as ReadonlyArray<{ path: string; kind: "file" | "directory"; size?: number; modifiedAt?: string }>;
    },
    move(request: { from: string; to: string; overwrite?: boolean }) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:move", request);
    },
    copy(request: { from: string; to: string; overwrite?: boolean }) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:copy", request);
    },
  });
}
