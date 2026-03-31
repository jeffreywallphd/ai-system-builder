import type {
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../../domain/workflow-studio/WorkflowRunHistoryDomain";

export interface IWorkflowRunSummaryRepository {
  upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord>;
  getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined>;
  list(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>>;
}
