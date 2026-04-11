import type { WorkflowPersistenceIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerWorkflowPersistenceIpc(params: WorkflowPersistenceIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;
  ipcMain.on("ai-loom-desktop-workflows:save-record", (_event, recordJson: string) => {
    onDemand.getWorkflowPersistence().saveWorkflowRecord(recordJson);
  });
  ipcMain.on("ai-loom-desktop-workflows:load-record", (event, id: string) => {
    event.returnValue = onDemand.getWorkflowPersistence().loadWorkflowRecord(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:list-summaries", (event) => {
    event.returnValue = onDemand.getWorkflowPersistence().listWorkflowSummaries();
  });
  ipcMain.on("ai-loom-desktop-workflows:delete-record", (_event, id: string) => {
    onDemand.getWorkflowPersistence().deleteWorkflowRecord(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:exists", (event, id: string) => {
    event.returnValue = onDemand.getWorkflowPersistence().workflowExists(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:status", (event) => {
    event.returnValue = onDemand.getWorkflowPersistence().getWorkflowPersistenceStatus();
  });
}
