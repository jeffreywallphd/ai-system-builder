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
  workflowRunSummaries: {
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
  },
  modelFiles: {
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
    listImageWorkflowDefinitions(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:image-workflows:list", requestJson) as Promise<string>;
    },
    getImageWorkflowDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:image-workflows:get", requestJson) as Promise<string>;
    },
    listImageSystemDefinitions(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:image-systems:list", requestJson) as Promise<string>;
    },
    getImageSystemDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:image-systems:get", requestJson) as Promise<string>;
    },
    saveImageSystemDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:image-systems:save", requestJson) as Promise<string>;
    },
    getPersistedWorkflow(workflowId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:get-persisted-workflow", workflowId) as Promise<string>;
    },
    duplicatePersistedWorkflow(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:duplicate-persisted-workflow", requestJson) as Promise<string>;
    },
    assessWorkflowExecutionReadiness(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-execution-readiness", requestJson) as Promise<string>;
    },
    runWorkflowDraft(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:run-workflow-draft", requestJson) as Promise<string>;
    },
    assessDataStudioExecutionReadiness(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:data-execution-readiness", requestJson) as Promise<string>;
    },
    runDataStudioPipeline(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:run-data-pipeline", requestJson) as Promise<string>;
    },
    listDataStudioPipelines(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:data-pipelines:list", requestJson) as Promise<string>;
    },
    loadDataStudioPipeline(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:data-pipelines:load", requestJson) as Promise<string>;
    },
    listWorkflowRuns(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:list", requestJson) as Promise<string>;
    },
    getWorkflowRunDetail(runId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:get-detail", runId) as Promise<string>;
    },
    startWorkflowRunRerun(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:start-rerun", requestJson) as Promise<string>;
    },
    listSystemChildComponents(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:list", requestJson) as Promise<string>;
    },
    addSystemChildComponent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:add", requestJson) as Promise<string>;
    },
    removeSystemChildComponent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:remove", requestJson) as Promise<string>;
    },
    reorderSystemChildComponent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:reorder", requestJson) as Promise<string>;
    },
    updateSystemInterfaces(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-interfaces:update", requestJson) as Promise<string>;
    },
    updateSystemParameters(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-parameters:update", requestJson) as Promise<string>;
    },
    updateSystemExecutionMetadata(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-execution-metadata:update", requestJson) as Promise<string>;
    },
    saveSystemDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:save", requestJson) as Promise<string>;
    },
    loadSystemDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:load", requestJson) as Promise<string>;
    },
    duplicateSystemDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:duplicate", requestJson) as Promise<string>;
    },
    modifySystemDefinition(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:modify", requestJson) as Promise<string>;
    },
    getSystemCompatibilityInsights(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-compatibility:insights", requestJson) as Promise<string>;
    },
    startSystemExecution(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:start", requestJson) as Promise<string>;
    },
    getSystemExecutionStatus(executionId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:status", executionId) as Promise<string>;
    },
    getSystemExecutionTrace(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:trace", requestJson) as Promise<string>;
    },
    getSystemExecutionResult(executionId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:result", executionId) as Promise<string>;
    },
    ingestReferenceImageUpload(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:upload", requestJson) as Promise<string>;
    },
    persistReferenceImageOutputs(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:persist-outputs", requestJson) as Promise<string>;
    },
    listReferenceImageOutputs(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:list-outputs", requestJson) as Promise<string>;
    },
    getReferenceImageOutput(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:get-output", requestJson) as Promise<string>;
    },
    listReferenceImageDatasetItems(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:list-dataset-items", requestJson) as Promise<string>;
    },
    getReferenceImageDatasetItem(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:get-dataset-item", requestJson) as Promise<string>;
    },
    listReferenceImageRunHistory(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:list-run-history", requestJson) as Promise<string>;
    },
    chainReferenceImageDatasetItemToInput(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:chain-to-input", requestJson) as Promise<string>;
    },
    launchRuntimeWindow(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:runtime-window:launch", requestJson) as Promise<string>;
    },
  },
  registry: {
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
  },
  connectivity: {
    getConnectivityState() {
      return ipcRenderer.invoke("ai-loom-desktop-connectivity:get-state") as Promise<string>;
    },
    setOfflineMode(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-connectivity:set-offline-mode", requestJson) as Promise<string>;
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
