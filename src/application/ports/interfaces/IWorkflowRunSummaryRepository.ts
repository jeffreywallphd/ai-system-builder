import type {
  WorkflowRunDetailRecord,
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "@domain/workflow-studio/WorkflowRunHistoryDomain";

export interface IWorkflowRunSummaryRepository {
  upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord>;
  upsertDetail(record: WorkflowRunDetailRecord): Promise<WorkflowRunDetailRecord>;
  getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined>;
  getDetailByRunId(runId: string): Promise<WorkflowRunDetailRecord | undefined>;
  list(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>>;
}

