"use strict";
const electron = require("electron");
const bootstrap = electron.ipcRenderer.sendSync("ai-loom-desktop:get-bootstrap-sync");
electron.contextBridge.exposeInMainWorld("aiLoomDesktop", {
  bootstrap,
  storage: {
    getItem(key) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-storage:getItem", key);
    },
    setItem(key, value) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-storage:setItem", key, value);
    },
    removeItem(key) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-storage:removeItem", key);
    }
  },
  secrets: {
    isAvailable() {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-secrets:is-available");
    },
    getSecret(key) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-secrets:get", key);
    },
    setSecret(key, value) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-secrets:set", key, value);
    },
    removeSecret(key) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-secrets:remove", key);
    }
  },
  workflows: {
    saveWorkflowRecord(recordJson) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-workflows:save-record", recordJson);
    },
    loadWorkflowRecord(id) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-workflows:load-record", id);
    },
    listWorkflowSummaries() {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-workflows:list-summaries");
    },
    deleteWorkflowRecord(id) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-workflows:delete-record", id);
    },
    workflowExists(id) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-workflows:exists", id);
    },
    getWorkflowPersistenceStatus() {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-workflows:status");
    }
  },
  executionRuns: {
    saveExecutionRun(runJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-execution-runs:save", runJson);
    },
    loadExecutionRun(runId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-execution-runs:load", runId);
    },
    listExecutionRuns(criteriaJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-execution-runs:list", criteriaJson);
    }
  },
  workflowRunSummaries: {
    saveWorkflowRunSummary(summaryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-workflow-runs:save", summaryJson);
    },
    loadWorkflowRunSummary(runId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-workflow-runs:load", runId);
    },
    listWorkflowRunSummaries(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-workflow-runs:list", queryJson);
    },
    saveWorkflowRunDetail(detailJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-workflow-runs:save-detail", detailJson);
    },
    loadWorkflowRunDetail(runId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-workflow-runs:load-detail", runId);
    }
  },
  modelFiles: {
    exists(modelPath) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:exists", modelPath);
    },
    stat(modelPath) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:stat", modelPath);
    },
    read(modelPath) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:read", modelPath);
    },
    write(request) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:write", request);
    },
    delete(modelPath) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:delete", modelPath);
    },
    list(modelPath, options) {
      return electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:list", modelPath, options);
    },
    move(request) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:move", request);
    },
    copy(request) {
      electron.ipcRenderer.sendSync("ai-loom-desktop-model-files:copy", request);
    }
  },
  canonicalAssets: {
    listAssets(criteriaJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:list", criteriaJson);
    },
    loadAssetDetail(assetId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:detail", assetId);
    },
    listVersionChain(assetId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:version-chain", assetId);
    },
    evaluateDependencyState(versionId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:dependency-state", versionId);
    },
    reconcileIdentity(entityType, entityId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:reconcile-identity", entityType, entityId);
    },
    replayScopedProjection(entityType, entityId, versionId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:replay-scope", entityType, entityId, versionId);
    },
    verifyProjection(assetId, versionIdsInScope) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:verify-projection", assetId, versionIdsInScope);
    },
    rebuildProjectionScopes(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:rebuild-scopes", requestJson);
    },
    loadManagementSnapshot(assetId, includeProjectionHealth = true, versionIdsInProjectionScope) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-canonical-assets:management-snapshot", assetId, includeProjectionHealth, versionIdsInProjectionScope);
    }
  },
  studioShell: {
    initializeStudio(studioId, name) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:initialize", studioId, name);
    },
    loadSnapshot(studioId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:snapshot", studioId);
    },
    startSession(studioId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:start-session", studioId);
    },
    createDraft(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:create-draft", requestJson);
    },
    updateDraft(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:update-draft", requestJson);
    },
    updateDependencies(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:update-dependencies", requestJson);
    },
    transitionLifecycle(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:transition-lifecycle", requestJson);
    },
    publishVersion(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:publish-version", requestJson);
    },
    validateDraft(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:validate-draft", requestJson);
    },
    getPersistedWorkflow(workflowId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:get-persisted-workflow", workflowId);
    },
    duplicatePersistedWorkflow(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:duplicate-persisted-workflow", requestJson);
    },
    assessWorkflowExecutionReadiness(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-execution-readiness", requestJson);
    },
    runWorkflowDraft(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:run-workflow-draft", requestJson);
    },
    assessDataStudioExecutionReadiness(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:data-execution-readiness", requestJson);
    },
    runDataStudioPipeline(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:run-data-pipeline", requestJson);
    },
    listDataStudioPipelines(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:data-pipelines:list", requestJson);
    },
    loadDataStudioPipeline(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:data-pipelines:load", requestJson);
    },
    listWorkflowRuns(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:list", requestJson);
    },
    getWorkflowRunDetail(runId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:get-detail", runId);
    },
    startWorkflowRunRerun(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:workflow-runs:start-rerun", requestJson);
    },
    listSystemChildComponents(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:list", requestJson);
    },
    addSystemChildComponent(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:add", requestJson);
    },
    removeSystemChildComponent(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:remove", requestJson);
    },
    reorderSystemChildComponent(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-components:reorder", requestJson);
    },
    updateSystemInterfaces(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-interfaces:update", requestJson);
    },
    updateSystemParameters(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-parameters:update", requestJson);
    },
    updateSystemExecutionMetadata(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-execution-metadata:update", requestJson);
    },
    saveSystemDefinition(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:save", requestJson);
    },
    loadSystemDefinition(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:load", requestJson);
    },
    duplicateSystemDefinition(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:duplicate", requestJson);
    },
    modifySystemDefinition(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-definition:modify", requestJson);
    },
    getSystemCompatibilityInsights(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-compatibility:insights", requestJson);
    },
    startSystemExecution(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:start", requestJson);
    },
    getSystemExecutionStatus(executionId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:status", executionId);
    },
    getSystemExecutionTrace(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:trace", requestJson);
    },
    getSystemExecutionResult(executionId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:system-runtime:result", executionId);
    },
    ingestReferenceImageUpload(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:upload", requestJson);
    },
    persistReferenceImageOutputs(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:persist-outputs", requestJson);
    },
    listReferenceImageOutputs(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:list-outputs", requestJson);
    },
    getReferenceImageOutput(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:get-output", requestJson);
    },
    listReferenceImageDatasetItems(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:list-dataset-items", requestJson);
    },
    getReferenceImageDatasetItem(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:get-dataset-item", requestJson);
    },
    listReferenceImageRunHistory(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:list-run-history", requestJson);
    },
    chainReferenceImageDatasetItemToInput(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:reference-image:chain-to-input", requestJson);
    },
    launchRuntimeWindow(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-studio-shell:runtime-window:launch", requestJson);
    }
  },
  registry: {
    listAssets(limit) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:assets", limit);
    },
    filterAssets(filtersJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:assets-filter", filtersJson);
    },
    searchAssets(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:search", queryJson);
    },
    listExploreAssets(limit) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:explore-assets", limit);
    },
    searchExploreAssets(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:explore-search", queryJson);
    },
    getAssetDetail(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:asset-detail", queryJson);
    },
    getDependencies(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:dependencies", queryJson);
    },
    getDependents(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:dependents", queryJson);
    },
    traverseUpstream(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:traverse-upstream", queryJson);
    },
    traverseDownstream(queryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-registry:traverse-downstream", queryJson);
    }
  },
  agents: {
    createAgent(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:create", requestJson);
    },
    updateAgent(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:update", requestJson);
    },
    getAgent(agentId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:get", agentId);
    },
    listAgents(includeArchived = true) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:list", includeArchived);
    },
    deleteAgent(agentId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:delete", agentId);
    },
    archiveAgent(agentId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:archive", agentId);
    },
    configureGoals(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:configure-goals", requestJson);
    },
    configurePolicy(agentId, policyJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:configure-policy", agentId, policyJson);
    },
    configureTools(agentId, toolAccessJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:configure-tools", agentId, toolAccessJson);
    },
    configureMemory(agentId, memoryJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:configure-memory", agentId, memoryJson);
    },
    configureStrategy(agentId, planningStrategyJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:configure-strategy", agentId, planningStrategyJson);
    },
    validateConfiguration(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:validate", requestJson);
    },
    launchAgent(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:launch", requestJson);
    },
    triggerLaunch(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:trigger-launch", requestJson);
    },
    listSessions(agentId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:list-sessions", agentId);
    },
    getSessionDetail(sessionId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:get-session", sessionId);
    },
    controlRun(requestJson) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:control-run", requestJson);
    },
    getStudioSnapshot(agentId) {
      return electron.ipcRenderer.invoke("ai-loom-desktop-agents:studio-snapshot", agentId);
    }
  }
});
