import type { ExecutionRunIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerExecutionRunIpc(params: ExecutionRunIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;
  ipcMain.handle("ai-loom-desktop-execution-runs:save", async (_event, runJson: string) => {
    const { repository } = onDemand.getExecutionHistory();
    await repository.saveRun(JSON.parse(runJson));
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:load", async (_event, runId: string) => {
    const { getExecutionRunUseCase } = onDemand.getExecutionHistory();
    const run = await getExecutionRunUseCase.execute(runId);
    return run ? JSON.stringify(run) : null;
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:list", async (_event, criteriaJson?: string) => {
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const { listExecutionRunsUseCase } = onDemand.getExecutionHistory();
    const runs = await listExecutionRunsUseCase.execute(criteria);
    return runs.map((run) => JSON.stringify(run));
  });
}
