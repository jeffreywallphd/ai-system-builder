import { ipcRenderer, contextBridge } from "electron";
const bootstrap = ipcRenderer.sendSync("ai-loom-desktop:get-bootstrap-sync");
contextBridge.exposeInMainWorld("aiLoomDesktop", {
  bootstrap,
  storage: {
    getItem(key) {
      return ipcRenderer.sendSync("ai-loom-desktop-storage:getItem", key);
    },
    setItem(key, value) {
      ipcRenderer.sendSync("ai-loom-desktop-storage:setItem", key, value);
    },
    removeItem(key) {
      ipcRenderer.sendSync("ai-loom-desktop-storage:removeItem", key);
    }
  },
  secrets: {
    isAvailable() {
      return ipcRenderer.sendSync("ai-loom-desktop-secrets:is-available");
    },
    getSecret(key) {
      return ipcRenderer.sendSync("ai-loom-desktop-secrets:get", key);
    },
    setSecret(key, value) {
      ipcRenderer.sendSync("ai-loom-desktop-secrets:set", key, value);
    },
    removeSecret(key) {
      ipcRenderer.sendSync("ai-loom-desktop-secrets:remove", key);
    }
  },
  workflows: {
    saveWorkflowRecord(recordJson) {
      ipcRenderer.sendSync("ai-loom-desktop-workflows:save-record", recordJson);
    },
    loadWorkflowRecord(id) {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:load-record", id);
    },
    listWorkflowSummaries() {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:list-summaries");
    },
    deleteWorkflowRecord(id) {
      ipcRenderer.sendSync("ai-loom-desktop-workflows:delete-record", id);
    },
    workflowExists(id) {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:exists", id);
    },
    getWorkflowPersistenceStatus() {
      return ipcRenderer.sendSync("ai-loom-desktop-workflows:status");
    }
  },
  executionRuns: {
    saveExecutionRun(runJson) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:save", runJson);
    },
    loadExecutionRun(runId) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:load", runId);
    },
    listExecutionRuns(criteriaJson) {
      return ipcRenderer.invoke("ai-loom-desktop-execution-runs:list", criteriaJson);
    }
  },
  workflowRunSummaries: {
    saveWorkflowRunSummary(summaryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:save", summaryJson);
    },
    loadWorkflowRunSummary(runId) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:load", runId);
    },
    listWorkflowRunSummaries(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:list", queryJson);
    },
    saveWorkflowRunDetail(detailJson) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:save-detail", detailJson);
    },
    loadWorkflowRunDetail(runId) {
      return ipcRenderer.invoke("ai-loom-desktop-workflow-runs:load-detail", runId);
    }
  },
  modelFiles: {
    exists(path) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:exists", path);
    },
    stat(path) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:stat", path);
    },
    read(path) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:read", path);
    },
    write(request) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:write", request);
    },
    delete(path) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:delete", path);
    },
    list(path, options) {
      return ipcRenderer.sendSync("ai-loom-desktop-model-files:list", path, options);
    },
    move(request) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:move", request);
    },
    copy(request) {
      ipcRenderer.sendSync("ai-loom-desktop-model-files:copy", request);
    }
  },
  canonicalAssets: {
    listAssets(criteriaJson) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:list", criteriaJson);
    },
    loadAssetDetail(assetId) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:detail", assetId);
    },
    listVersionChain(assetId) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:version-chain", assetId);
    },
    evaluateDependencyState(versionId) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:dependency-state", versionId);
    },
    reconcileIdentity(entityType, entityId) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:reconcile-identity", entityType, entityId);
    },
    replayScopedProjection(entityType, entityId, versionId) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:replay-scope", entityType, entityId, versionId);
    },
    verifyProjection(assetId, versionIdsInScope) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:verify-projection", assetId, versionIdsInScope);
    },
    rebuildProjectionScopes(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:rebuild-scopes", requestJson);
    },
    loadManagementSnapshot(assetId, includeProjectionHealth = true, versionIdsInProjectionScope) {
      return ipcRenderer.invoke("ai-loom-desktop-canonical-assets:management-snapshot", assetId, includeProjectionHealth, versionIdsInProjectionScope);
    }
  },
  studioShell: {
    initializeStudio(studioId, name) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:initialize", studioId, name);
    },
    loadSnapshot(studioId) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:snapshot", studioId);
    },
    startSession(studioId) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:start-session", studioId);
    },
    createDraft(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:create-draft", requestJson);
    },
    updateDraft(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:update-draft", requestJson);
    },
    updateDependencies(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:update-dependencies", requestJson);
    },
    transitionLifecycle(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:transition-lifecycle", requestJson);
    },
    publishVersion(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:publish-version", requestJson);
    },
    validateDraft(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:validate-draft", requestJson);
    },
    getPersistedWorkflow(workflowId) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:get-persisted-workflow", workflowId);
    },
    duplicatePersistedWorkflow(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:duplicate-persisted-workflow", requestJson);
    },
    assessWorkflowExecutionReadiness(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-execution-readiness", requestJson);
    },
    runWorkflowDraft(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:run-workflow-draft", requestJson);
    },
    listWorkflowRuns(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:list", requestJson);
    },
    getWorkflowRunDetail(runId) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:get-detail", runId);
    },
    startWorkflowRunRerun(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:start-rerun", requestJson);
    },
    listSystemChildComponents(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:list", requestJson);
    },
    addSystemChildComponent(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:add", requestJson);
    },
    removeSystemChildComponent(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:remove", requestJson);
    },
    reorderSystemChildComponent(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:reorder", requestJson);
    },
    updateSystemInterfaces(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-interfaces:update", requestJson);
    },
    updateSystemParameters(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-parameters:update", requestJson);
    },
    updateSystemExecutionMetadata(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-execution-metadata:update", requestJson);
    },
    getSystemCompatibilityInsights(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-compatibility:insights", requestJson);
    },
    startSystemExecution(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:start", requestJson);
    },
    getSystemExecutionStatus(executionId) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:status", executionId);
    },
    getSystemExecutionTrace(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:trace", requestJson);
    },
    getSystemExecutionResult(executionId) {
      return ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:result", executionId);
    }
  },
  registry: {
    listAssets(limit) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:assets", limit);
    },
    filterAssets(filtersJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:assets-filter", filtersJson);
    },
    searchAssets(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:search", queryJson);
    },
    listExploreAssets(limit) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:explore-assets", limit);
    },
    searchExploreAssets(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:explore-search", queryJson);
    },
    getAssetDetail(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:asset-detail", queryJson);
    },
    getDependencies(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:dependencies", queryJson);
    },
    getDependents(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:dependents", queryJson);
    },
    traverseUpstream(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:traverse-upstream", queryJson);
    },
    traverseDownstream(queryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-registry:traverse-downstream", queryJson);
    }
  },
  agents: {
    createAgent(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:create", requestJson);
    },
    updateAgent(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:update", requestJson);
    },
    getAgent(agentId) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:get", agentId);
    },
    listAgents(includeArchived = true) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:list", includeArchived);
    },
    deleteAgent(agentId) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:delete", agentId);
    },
    archiveAgent(agentId) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:archive", agentId);
    },
    configureGoals(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-goals", requestJson);
    },
    configurePolicy(agentId, policyJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-policy", agentId, policyJson);
    },
    configureTools(agentId, toolAccessJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-tools", agentId, toolAccessJson);
    },
    configureMemory(agentId, memoryJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-memory", agentId, memoryJson);
    },
    configureStrategy(agentId, planningStrategyJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-strategy", agentId, planningStrategyJson);
    },
    validateConfiguration(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:validate", requestJson);
    },
    launchAgent(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:launch", requestJson);
    },
    triggerLaunch(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:trigger-launch", requestJson);
    },
    listSessions(agentId) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:list-sessions", agentId);
    },
    getSessionDetail(sessionId) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:get-session", sessionId);
    },
    controlRun(requestJson) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:control-run", requestJson);
    },
    getStudioSnapshot(agentId) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:studio-snapshot", agentId);
    }
  }
});
