/**
 * Registers IPC handlers for studio shell lifecycle operations and validates payloads before forwarding to shell/runtime services.
 */
import type { CreateAssetDraftCommand, PublishAssetDraftVersionCommand, TransitionAssetDraftLifecycleCommand, UpdateAssetDraftCommand, UpdateAssetDraftDependenciesCommand } from "../../../src/application/studio-shell/contracts";
import type { StudioShellBackendApi } from "../../../src/infrastructure/api/studio-shell/StudioShellBackendApi";
import type { StudioShellIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerStudioShellIpc(params: StudioShellIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;
  const getStudioShellBackendApi = () => onDemand.getStudioShellBackendApi();

  ipcMain.handle("ai-loom-desktop-studio-shell:initialize", async (_event, studioId: string, name: string) => {
    return JSON.stringify(await getStudioShellBackendApi().initializeStudio(studioId, name));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:snapshot", async (_event, studioId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().loadSnapshot(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:start-session", async (_event, studioId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().startSession(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:create-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as CreateAssetDraftCommand;
    return JSON.stringify(await getStudioShellBackendApi().createDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftCommand;
    return JSON.stringify(await getStudioShellBackendApi().updateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-dependencies", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftDependenciesCommand;
    return JSON.stringify(await getStudioShellBackendApi().updateDependencies(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:transition-lifecycle", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as TransitionAssetDraftLifecycleCommand;
    return JSON.stringify(await getStudioShellBackendApi().transitionLifecycle(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:publish-version", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as PublishAssetDraftVersionCommand;
    return JSON.stringify(await getStudioShellBackendApi().publishVersion(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:validate-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as { studioId: string; draftId: string };
    return JSON.stringify(await getStudioShellBackendApi().validateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-workflows:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listImageWorkflowDefinitions"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listImageWorkflowDefinitions(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-workflows:get", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getImageWorkflowDefinition"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getImageWorkflowDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listImageSystemDefinitions"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listImageSystemDefinitions(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:get", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getImageSystemDefinition"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getImageSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:save", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["saveImageSystemDefinition"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().saveImageSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:get-persisted-workflow", async (_event, workflowId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().getPersistedWorkflow(workflowId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:duplicate-persisted-workflow", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["duplicatePersistedWorkflow"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().duplicatePersistedWorkflow(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-execution-readiness", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["assessWorkflowExecutionReadiness"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().assessWorkflowExecutionReadiness(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:run-workflow-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["runWorkflowDraft"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().runWorkflowDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-execution-readiness", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["assessDataStudioExecutionReadiness"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().assessDataStudioExecutionReadiness(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:run-data-pipeline", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["runDataStudioPipeline"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().runDataStudioPipeline(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-pipelines:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listDataStudioPipelines"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listDataStudioPipelines(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-pipelines:load", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["loadDataStudioPipeline"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().loadDataStudioPipeline(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listWorkflowRuns"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listWorkflowRuns(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:get-detail", async (_event, runId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().getWorkflowRunDetail(runId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:start-rerun", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["startWorkflowRunRerun"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().startWorkflowRunRerun(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:upload", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["ingestReferenceImageUpload"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().ingestReferenceImageUpload(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:persist-outputs", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["persistReferenceImageOutputs"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().persistReferenceImageOutputs(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-outputs", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageOutputs"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listReferenceImageOutputs(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:get-output", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getReferenceImageOutput"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getReferenceImageOutput(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-dataset-items", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageDatasetItems"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listReferenceImageDatasetItems(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:get-dataset-item", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getReferenceImageDatasetItem"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getReferenceImageDatasetItem(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-run-history", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageRunHistory"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listReferenceImageRunHistory(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:chain-to-input", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["chainReferenceImageDatasetItemToInput"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().chainReferenceImageDatasetItemToInput(request));
  });
}
