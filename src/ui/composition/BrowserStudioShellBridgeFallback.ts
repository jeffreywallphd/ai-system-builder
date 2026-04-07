import type { DesktopStudioShellBridge } from "../../electron/shared/DesktopContracts";
import { StudioShellBackendApi } from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import { SystemStudioBackendApi } from "@infrastructure/api/system-studio/SystemStudioBackendApi";
import { SystemRuntimeBackendApi } from "@infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import {
  resolveLegacyBrowserStudioShellRepository,
  resolveLegacyBrowserWorkflowPersistenceRepository,
  resolveLegacyBrowserWorkflowRunSummaryRepository,
} from "./legacy/LegacyBrowserFallbackRepositories";

let fallbackBridge: DesktopStudioShellBridge | undefined;

export function resolveBrowserStudioShellBridgeFallback(): DesktopStudioShellBridge {
  if (fallbackBridge) {
    return fallbackBridge;
  }

  const repository = resolveLegacyBrowserStudioShellRepository();
  const workflowPersistenceRepository = resolveLegacyBrowserWorkflowPersistenceRepository();
  const workflowRunSummaryRepository = resolveLegacyBrowserWorkflowRunSummaryRepository();
  const studioApi = new StudioShellBackendApi(repository, workflowPersistenceRepository, workflowRunSummaryRepository);
  const systemApi = new SystemStudioBackendApi(repository);
  const runtimeApi = new SystemRuntimeBackendApi(repository);

  fallbackBridge = Object.freeze<DesktopStudioShellBridge>({
    initializeStudio: (studioId, name) => studioApi.initializeStudio(studioId, name).then((response) => JSON.stringify(response)),
    loadSnapshot: (studioId) => studioApi.loadSnapshot(studioId).then((response) => JSON.stringify(response)),
    startSession: (studioId) => studioApi.startSession(studioId).then((response) => JSON.stringify(response)),
    createDraft: (requestJson) => studioApi.createDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    updateDraft: (requestJson) => studioApi.updateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    updateDependencies: (requestJson) => studioApi.updateDependencies(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    transitionLifecycle: (requestJson) => studioApi.transitionLifecycle(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    publishVersion: (requestJson) => studioApi.publishVersion(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    validateDraft: (requestJson) => studioApi.validateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getPersistedWorkflow: (workflowId) => studioApi.getPersistedWorkflow(workflowId).then((response) => JSON.stringify(response)),
    duplicatePersistedWorkflow: (requestJson) => studioApi.duplicatePersistedWorkflow(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    assessWorkflowExecutionReadiness: (requestJson) => studioApi.assessWorkflowExecutionReadiness(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    runWorkflowDraft: (requestJson) => studioApi.runWorkflowDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    assessDataStudioExecutionReadiness: (requestJson) => studioApi.assessDataStudioExecutionReadiness(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    runDataStudioPipeline: (requestJson) => studioApi.runDataStudioPipeline(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    listDataStudioPipelines: (requestJson) => studioApi.listDataStudioPipelines(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    loadDataStudioPipeline: (requestJson) => studioApi.loadDataStudioPipeline(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    listWorkflowRuns: (requestJson) => studioApi.listWorkflowRuns(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getWorkflowRunDetail: (runId) => studioApi.getWorkflowRunDetail(runId).then((response) => JSON.stringify(response)),
    startWorkflowRunRerun: (requestJson) => studioApi.startWorkflowRunRerun(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    listSystemChildComponents: (requestJson) => systemApi.listChildComponents(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    addSystemChildComponent: (requestJson) => systemApi.addChildComponent(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    removeSystemChildComponent: (requestJson) => systemApi.removeChildComponent(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    reorderSystemChildComponent: (requestJson) => systemApi.reorderChildComponent(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    updateSystemInterfaces: (requestJson) => systemApi.updateInterfaces(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    updateSystemParameters: (requestJson) => systemApi.updateParameters(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    updateSystemExecutionMetadata: (requestJson) => systemApi.updateExecutionMetadata(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    saveSystemDefinition: (requestJson) => systemApi.saveSystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    loadSystemDefinition: (requestJson) => systemApi.loadSystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    duplicateSystemDefinition: (requestJson) => systemApi.duplicateSystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    modifySystemDefinition: (requestJson) => systemApi.modifySystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getSystemCompatibilityInsights: (requestJson) => systemApi.getCompatibilityInsights(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    startSystemExecution: (requestJson) => runtimeApi.startExecution(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getSystemExecutionStatus: (executionId) => runtimeApi.getExecutionStatus(executionId).then((response) => JSON.stringify(response)),
    getSystemExecutionTrace: (requestJson) => runtimeApi.getExecutionTrace(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getSystemExecutionResult: (executionId) => runtimeApi.getExecutionResult(executionId).then((response) => JSON.stringify(response)),
    ingestReferenceImageUpload: (requestJson) => studioApi.ingestReferenceImageUpload(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    persistReferenceImageOutputs: (requestJson) => studioApi.persistReferenceImageOutputs(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    listReferenceImageOutputs: (requestJson) => studioApi.listReferenceImageOutputs(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getReferenceImageOutput: (requestJson) => studioApi.getReferenceImageOutput(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    listReferenceImageDatasetItems: (requestJson) => studioApi.listReferenceImageDatasetItems(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    getReferenceImageDatasetItem: (requestJson) => studioApi.getReferenceImageDatasetItem(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    listReferenceImageRunHistory: (requestJson) => studioApi.listReferenceImageRunHistory(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    chainReferenceImageDatasetItemToInput: (requestJson) => studioApi.chainReferenceImageDatasetItemToInput(JSON.parse(requestJson)).then((response) => JSON.stringify(response)),
    launchRuntimeWindow: async () => JSON.stringify({
      ok: false,
      error: {
        code: "unsupported",
        message: "Runtime window launch is only available in the desktop host.",
      },
    }),
  });

  return fallbackBridge;
}

