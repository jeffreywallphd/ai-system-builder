import { contextBridge, ipcRenderer } from "electron";

const bootstrap = ipcRenderer.sendSync("ai-loom-desktop:get-bootstrap-sync");

contextBridge.exposeInMainWorld("aiLoomDesktop", {
  bootstrap,
  storage: {
    getItem(key: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-storage:getItem", key) as string | null;
    },
    setItem(key: string, value: string) {
      ipcRenderer.sendSync("ai-loom-desktop-storage:setItem", key, value);
    },
    removeItem(key: string) {
      ipcRenderer.sendSync("ai-loom-desktop-storage:removeItem", key);
    },
  },
  workflows: {
    saveWorkflowRecord(recordJson: string) {
      ipcRenderer.sendSync("ai-loom-desktop-workflows:save-record", recordJson);
    },
    loadWorkflowRecord(id: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:load-record", id) as string | null;
    },
    listWorkflowSummaries() {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:list-summaries") as ReadonlyArray<string>;
    },
    deleteWorkflowRecord(id: string) {
      ipcRenderer.sendSync("ai-loom-desktop-workflows:delete-record", id);
    },
    workflowExists(id: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:exists", id) as boolean;
    },
    getWorkflowPersistenceStatus() {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:status") as {
        provider: string;
        workflowsDirectory: string;
        indexDatabasePath: string;
        degraded: boolean;
        detail: string;
      };
    },
  },
  executionRuns: {
    saveExecutionRun(runJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:save", runJson);
    },
    loadExecutionRun(runId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:load", runId) as Promise<string | null>;
    },
    listExecutionRuns(criteriaJson?: string) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:list", criteriaJson) as Promise<ReadonlyArray<string>>;
    },
  },
  modelFiles: {
    exists(path: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:exists", path) as boolean;
    },
    stat(path: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:stat", path) as { path: string; kind: "file" | "directory"; size?: number; modifiedAt?: string };
    },
    read(path: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:read", path) as Uint8Array;
    },
    write(request: { path: string; content: Uint8Array; overwrite?: boolean; createDirectories?: boolean }) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:write", request);
    },
    delete(path: string) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:delete", path);
    },
    list(path: string, options?: { recursive?: boolean }) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:list", path, options) as ReadonlyArray<{ path: string; kind: "file" | "directory"; size?: number; modifiedAt?: string }>;
    },
    move(request: { from: string; to: string; overwrite?: boolean }) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:move", request);
    },
    copy(request: { from: string; to: string; overwrite?: boolean }) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:copy", request);
    },
  },
  canonicalAssets: {
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
  },
});
