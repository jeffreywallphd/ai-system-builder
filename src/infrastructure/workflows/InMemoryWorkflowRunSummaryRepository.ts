import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunDetailRecord,
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../src/domain/workflow-studio/WorkflowRunHistoryDomain";
import {
  createWorkflowRunDetailRecord,
  createWorkflowStepRunStats,
  normalizeWorkflowRunSummaryRecord,
  normalizeWorkflowRunDetailRecord,
} from "../../src/domain/workflow-studio/WorkflowRunHistoryDomain";

export class InMemoryWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  private readonly records = new Map<string, WorkflowRunSummaryRecord>();
  private readonly details = new Map<string, WorkflowRunDetailRecord>();

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);
    this.records.set(normalized.runId, normalized);
    const existingDetail = this.details.get(normalized.runId);
    if (existingDetail) {
      this.details.set(
        normalized.runId,
        createWorkflowRunDetailRecord({
          runId: normalized.runId,
          summary: normalized,
          stepRuns: existingDetail.stepRuns,
          executionContext: existingDetail.executionContext,
          outputs: existingDetail.outputs,
        }),
      );
    }
    return normalized;
  }

  public async upsertDetail(record: WorkflowRunDetailRecord): Promise<WorkflowRunDetailRecord> {
    const normalized = normalizeWorkflowRunDetailRecord(record);
    this.details.set(normalized.runId, normalized);
    this.records.set(normalized.runId, normalized.summary);
    return normalized;
  }

  public async getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }
    return this.records.get(normalizedRunId) ?? this.details.get(normalizedRunId)?.summary;
  }

  public async getDetailByRunId(runId: string): Promise<WorkflowRunDetailRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }
    const detail = this.details.get(normalizedRunId);
    if (detail) {
      return normalizeWorkflowRunDetailRecord(detail);
    }

    const summary = this.records.get(normalizedRunId);
    if (!summary) {
      return undefined;
    }

    return createWorkflowRunDetailRecord({
      runId: summary.runId,
      summary: normalizeWorkflowRunSummaryRecord({
        ...summary,
        stepRunStats: summary.stepRunStats ?? createWorkflowStepRunStats([]),
      }),
      stepRuns: [],
    });
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
