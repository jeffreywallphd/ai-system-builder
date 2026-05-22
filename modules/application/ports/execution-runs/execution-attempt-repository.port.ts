import type { ExecutionAttemptId, ExecutionAttemptRecord, ExecutionAttemptStatus, ExecutionRunId } from '../../../contracts/execution-runs';
export interface ExecutionAttemptRepositoryPort {
  saveExecutionAttempt(record: ExecutionAttemptRecord): Promise<ExecutionAttemptRecord>;
  updateExecutionAttempt(record: ExecutionAttemptRecord): Promise<ExecutionAttemptRecord>;
  getExecutionAttemptById(workspaceId: string, executionAttemptId: ExecutionAttemptId): Promise<ExecutionAttemptRecord | undefined>;
  listExecutionAttemptsByRun(workspaceId: string, executionRunId: ExecutionRunId, status?: ExecutionAttemptStatus): Promise<readonly ExecutionAttemptRecord[]>;
  getLatestExecutionAttemptForRun(workspaceId: string, executionRunId: ExecutionRunId): Promise<ExecutionAttemptRecord | undefined>;
}
