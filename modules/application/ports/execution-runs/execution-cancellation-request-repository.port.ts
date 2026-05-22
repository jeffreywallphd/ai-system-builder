import type { ExecutionCancellationRequestId, ExecutionCancellationRequestRecord, ExecutionRunId } from '../../../contracts/execution-runs';
export interface ExecutionCancellationRequestRepositoryPort {
  saveExecutionCancellationRequest(record: ExecutionCancellationRequestRecord): Promise<ExecutionCancellationRequestRecord>;
  getExecutionCancellationRequestById(workspaceId: string, requestId: ExecutionCancellationRequestId): Promise<ExecutionCancellationRequestRecord | undefined>;
  listExecutionCancellationRequestsByRun(workspaceId: string, executionRunId: ExecutionRunId): Promise<readonly ExecutionCancellationRequestRecord[]>;
}
