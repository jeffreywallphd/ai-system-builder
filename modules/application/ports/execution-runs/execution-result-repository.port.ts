import type { ExecutionResultId, ExecutionResultRecord, ExecutionRunId } from '../../../contracts/execution-runs';
export interface ExecutionResultRepositoryPort {
  saveExecutionResult(record: ExecutionResultRecord): Promise<ExecutionResultRecord>;
  updateExecutionResult(record: ExecutionResultRecord): Promise<ExecutionResultRecord>;
  getExecutionResultById(workspaceId: string, executionResultId: ExecutionResultId): Promise<ExecutionResultRecord | undefined>;
  listExecutionResultsByRun(workspaceId: string, executionRunId: ExecutionRunId): Promise<readonly ExecutionResultRecord[]>;
  getLatestExecutionResultForRun(workspaceId: string, executionRunId: ExecutionRunId): Promise<ExecutionResultRecord | undefined>;
}
