import type { ExecutionRetryRequestId, ExecutionRetryRequestRecord, ExecutionRunId } from '../../../contracts/execution-runs';
export interface ExecutionRetryRequestRepositoryPort {
  saveExecutionRetryRequest(record: ExecutionRetryRequestRecord): Promise<ExecutionRetryRequestRecord>;
  getExecutionRetryRequestById(workspaceId: string, requestId: ExecutionRetryRequestId): Promise<ExecutionRetryRequestRecord | undefined>;
  listExecutionRetryRequestsByRun(workspaceId: string, executionRunId: ExecutionRunId): Promise<readonly ExecutionRetryRequestRecord[]>;
}
