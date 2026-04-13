import { DeferredFeatureApiUnavailableDetail } from "./deferredFeatureGuards";
import type { DesktopIpcRendererLike } from "./types";

interface WorkflowPersistenceStatus {
  provider: string;
  workflowsDirectory: string;
  indexDatabasePath: string;
  degraded: boolean;
  detail: string;
}

export interface WorkflowsBridgeDependencies {
  ipcRenderer: DesktopIpcRendererLike;
  isCapabilityReady(): boolean;
  startDeferredFeatureWarmupOnDemand(): void;
}

export function createWorkflowsBridge(deps: WorkflowsBridgeDependencies) {
  return Object.freeze({
    saveWorkflowRecord(recordJson: string) {
      deps.ipcRenderer.sendSync("ai-loom-desktop-workflows:save-record", recordJson);
    },
    loadWorkflowRecord(id: string) {
      return deps.ipcRenderer.sendSync("ai-loom-desktop-workflows:load-record", id) as string | null;
    },
    listWorkflowSummaries() {
      return deps.ipcRenderer.sendSync("ai-loom-desktop-workflows:list-summaries") as ReadonlyArray<string>;
    },
    deleteWorkflowRecord(id: string) {
      deps.ipcRenderer.sendSync("ai-loom-desktop-workflows:delete-record", id);
    },
    workflowExists(id: string) {
      return deps.ipcRenderer.sendSync("ai-loom-desktop-workflows:exists", id) as boolean;
    },
    getWorkflowPersistenceStatus() {
      if (!deps.isCapabilityReady()) {
        deps.startDeferredFeatureWarmupOnDemand();
        return Object.freeze({
          provider: "desktop-runtime-deferred",
          workflowsDirectory: "",
          indexDatabasePath: "",
          degraded: true,
          detail: DeferredFeatureApiUnavailableDetail,
        });
      }
      return deps.ipcRenderer.sendSync("ai-loom-desktop-workflows:status") as WorkflowPersistenceStatus;
    },
  });
}
