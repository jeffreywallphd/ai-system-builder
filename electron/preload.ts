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
  secrets: {
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
    loadManagementSnapshot(assetId: string, includeProjectionHealth = true, versionIdsInProjectionScope?: ReadonlyArray<string>) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:management-snapshot", assetId, includeProjectionHealth, versionIdsInProjectionScope) as Promise<string | null>;
    },
  },
  studioShell: {
    initializeStudio(studioId: string, name: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:initialize", studioId, name) as Promise<string>;
    },
    loadSnapshot(studioId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:snapshot", studioId) as Promise<string>;
    },
    startSession(studioId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:start-session", studioId) as Promise<string>;
    },
    createDraft(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:create-draft", requestJson) as Promise<string>;
    },
    updateDraft(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:update-draft", requestJson) as Promise<string>;
    },
    updateDependencies(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:update-dependencies", requestJson) as Promise<string>;
    },
    transitionLifecycle(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:transition-lifecycle", requestJson) as Promise<string>;
    },
    publishVersion(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:publish-version", requestJson) as Promise<string>;
    },
    validateDraft(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:validate-draft", requestJson) as Promise<string>;
    },
  },
  agents: {
    createAgent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:create", requestJson) as Promise<string>;
    },
    updateAgent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:update", requestJson) as Promise<string>;
    },
    getAgent(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:get", agentId) as Promise<string>;
    },
    listAgents(includeArchived = true) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:list", includeArchived) as Promise<string>;
    },
    deleteAgent(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:delete", agentId) as Promise<string>;
    },
    archiveAgent(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:archive", agentId) as Promise<string>;
    },
    configureGoals(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-goals", requestJson) as Promise<string>;
    },
    configurePolicy(agentId: string, policyJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-policy", agentId, policyJson) as Promise<string>;
    },
    configureTools(agentId: string, toolAccessJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-tools", agentId, toolAccessJson) as Promise<string>;
    },
    configureMemory(agentId: string, memoryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-memory", agentId, memoryJson) as Promise<string>;
    },
    configureStrategy(agentId: string, planningStrategyJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-strategy", agentId, planningStrategyJson) as Promise<string>;
    },
    validateConfiguration(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:validate", requestJson) as Promise<string>;
    },
    launchAgent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:launch", requestJson) as Promise<string>;
    },
    triggerLaunch(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:trigger-launch", requestJson) as Promise<string>;
    },
    listSessions(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:list-sessions", agentId) as Promise<string>;
    },
    getSessionDetail(sessionId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:get-session", sessionId) as Promise<string>;
    },
    controlRun(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:control-run", requestJson) as Promise<string>;
    },
    getStudioSnapshot(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:studio-snapshot", agentId) as Promise<string>;
    },
  },
});
