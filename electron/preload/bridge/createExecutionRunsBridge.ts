import type { DesktopIpcRendererLike } from "./types";

export function createExecutionRunsBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    saveExecutionRun(runJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:save", runJson);
    },
    loadExecutionRun(runId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:load", runId) as Promise<string | null>;
    },
    listExecutionRuns(criteriaJson?: string) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:list", criteriaJson) as Promise<ReadonlyArray<string>>;
    },
  });
}
