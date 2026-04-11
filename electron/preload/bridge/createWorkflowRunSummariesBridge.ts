import type { DesktopIpcRendererLike } from "./types";

export function createWorkflowRunSummariesBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    saveWorkflowRunSummary(summaryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:save", summaryJson);
    },
    loadWorkflowRunSummary(runId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:load", runId) as Promise<string | null>;
    },
    listWorkflowRunSummaries(queryJson?: string) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:list", queryJson) as Promise<ReadonlyArray<string>>;
    },
    saveWorkflowRunDetail(detailJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:save-detail", detailJson);
    },
    loadWorkflowRunDetail(runId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:load-detail", runId) as Promise<string | null>;
    },
  });
}
