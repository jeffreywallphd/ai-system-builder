import type { DesktopIpcRendererLike } from "./types";

export function createStudioShellBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
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
  });
}
