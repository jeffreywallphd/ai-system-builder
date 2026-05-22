import type { ExecutionRuntimeReferenceId, ExecutionRuntimeReferenceRecord } from '../../../contracts/execution-runs';
export interface ExecutionRuntimeReferenceRepositoryPort {
  saveExecutionRuntimeReference(record: ExecutionRuntimeReferenceRecord): Promise<ExecutionRuntimeReferenceRecord>;
  getExecutionRuntimeReferenceById(workspaceId: string, runtimeReferenceId: ExecutionRuntimeReferenceId): Promise<ExecutionRuntimeReferenceRecord | undefined>;
  listExecutionRuntimeReferences(workspaceId: string): Promise<readonly ExecutionRuntimeReferenceRecord[]>;
}
