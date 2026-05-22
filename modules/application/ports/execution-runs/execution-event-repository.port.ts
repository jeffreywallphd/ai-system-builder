import type { ExecutionEventId, ExecutionEventRecord, ExecutionRunId } from '../../../contracts/execution-runs';
export interface ExecutionEventRepositoryPort {
  appendExecutionEvent(record: ExecutionEventRecord): Promise<ExecutionEventRecord>;
  getExecutionEventById(workspaceId: string, executionEventId: ExecutionEventId): Promise<ExecutionEventRecord | undefined>;
  listExecutionEventsByRun(workspaceId: string, executionRunId: ExecutionRunId, limit?: number, cursor?: string): Promise<{ readonly events: readonly ExecutionEventRecord[]; readonly nextCursor?: string }>;
  listExecutionEventsByAttempt(workspaceId: string, executionAttemptId: string): Promise<readonly ExecutionEventRecord[]>;
}
