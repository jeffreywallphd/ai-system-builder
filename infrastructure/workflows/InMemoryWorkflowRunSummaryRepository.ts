import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import {
  normalizeWorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";

export class InMemoryWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  private readonly records = new Map<string, WorkflowRunSummaryRecord>();

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);
    this.records.set(normalized.runId, normalized);
    return normalized;
  }

  public async getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined> {
    const normalizedRunId = runId.trim();
    return normalizedRunId ? this.records.get(normalizedRunId) : undefined;
  }

  public async list(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>> {
    let entries = [...this.records.values()];

    if (query?.workflowId?.trim()) {
      const workflowId = query.workflowId.trim();
      entries = entries.filter((entry) => entry.workflow.workflowId === workflowId);
    }

    if (query?.status) {
      entries = entries.filter((entry) => entry.status === query.status);
    }

    if (query?.triggerSource) {
      entries = entries.filter((entry) => entry.triggerSource === query.triggerSource);
    }

    if (query?.startedAfter?.trim()) {
      const startedAfter = query.startedAfter.trim();
      entries = entries.filter((entry) => entry.timestamps.startedAt >= startedAfter);
    }

    if (query?.startedBefore?.trim()) {
      const startedBefore = query.startedBefore.trim();
      entries = entries.filter((entry) => entry.timestamps.startedAt <= startedBefore);
    }

    entries.sort((left, right) => right.timestamps.startedAt.localeCompare(left.timestamps.startedAt));
    if (Number.isInteger(query?.limit) && (query?.limit ?? 0) > 0) {
      entries = entries.slice(0, query!.limit);
    }

    return Object.freeze(entries.map((entry) => normalizeWorkflowRunSummaryRecord(entry)));
  }
}
