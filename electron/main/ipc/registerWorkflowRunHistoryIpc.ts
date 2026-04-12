import type { WorkflowRunHistoryIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerWorkflowRunHistoryIpc(params: WorkflowRunHistoryIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;
  ipcMain.handle("ai-loom-desktop-workflow-runs:save", async (_event, summaryJson: string) => {
    const { repository: workflowRunSummaryRepository } = onDemand.getWorkflowRunHistory();
    await workflowRunSummaryRepository.upsert(JSON.parse(summaryJson));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:load", async (_event, runId: string) => {
    const { repository: workflowRunSummaryRepository } = onDemand.getWorkflowRunHistory();
    const summary = await workflowRunSummaryRepository.getByRunId(runId);
    return summary ? JSON.stringify(summary) : null;
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:save-detail", async (_event, detailJson: string) => {
    const { repository: workflowRunSummaryRepository } = onDemand.getWorkflowRunHistory();
    await workflowRunSummaryRepository.upsertDetail(JSON.parse(detailJson));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:load-detail", async (_event, runId: string) => {
    const { repository: workflowRunSummaryRepository } = onDemand.getWorkflowRunHistory();
    const detail = await workflowRunSummaryRepository.getDetailByRunId(runId);
    return detail ? JSON.stringify(detail) : null;
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:list", async (_event, queryJson?: string) => {
    const query = queryJson ? JSON.parse(queryJson) : undefined;
    const { listWorkflowRunSummariesUseCase } = onDemand.getWorkflowRunHistory();
    const summaries = await listWorkflowRunSummariesUseCase.execute(query);
    return summaries.map((summary) => JSON.stringify(summary));
  });
}
