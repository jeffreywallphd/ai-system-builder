import type { ExecutionApprovalId, ExecutionApprovalRecord } from '../../../contracts/execution-runs';
export interface ExecutionApprovalRepositoryPort {
  saveExecutionApproval(record: ExecutionApprovalRecord): Promise<ExecutionApprovalRecord>;
  updateExecutionApproval(record: ExecutionApprovalRecord): Promise<ExecutionApprovalRecord>;
  getExecutionApprovalById(workspaceId: string, executionApprovalId: ExecutionApprovalId): Promise<ExecutionApprovalRecord | undefined>;
  listExecutionApprovals(workspaceId: string, sourceExecutionPlanId?: string, executionRunId?: string, conversationSessionId?: string): Promise<readonly ExecutionApprovalRecord[]>;
}
