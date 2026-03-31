import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunDetailRecord,
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import {
  createWorkflowRunDetailRecord,
  createWorkflowStepRunStats,
  normalizeWorkflowRunSummaryRecord,
  normalizeWorkflowRunDetailRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const STORAGE_KEY = "ai-loom.workflow-run-summaries.v1";
const DETAIL_STORAGE_KEY = "ai-loom.workflow-run-details.v1";

export class LocalStorageWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  constructor(
    private readonly storageKey: string = STORAGE_KEY,
    private readonly storage: StorageLike | undefined = typeof localStorage !== "undefined" ? localStorage : undefined,
    private readonly detailStorageKey: string = DETAIL_STORAGE_KEY,
  ) {}

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);
    const current = this.loadAllMutable();
    current[normalized.runId] = normalized;
    this.saveAll(current);
    const details = this.loadAllDetailsMutable();
    const existing = details[normalized.runId];
    if (existing) {
      details[normalized.runId] = createWorkflowRunDetailRecord({
        runId: normalized.runId,
        summary: normalized,
        stepRuns: existing.stepRuns,
        executionContext: existing.executionContext,
        outputs: existing.outputs,
      });
      this.saveAllDetails(details);
    }
    return normalized;
  }

  public async upsertDetail(record: WorkflowRunDetailRecord): Promise<WorkflowRunDetailRecord> {
    const normalized = normalizeWorkflowRunDetailRecord(record);
    const details = this.loadAllDetailsMutable();
    details[normalized.runId] = normalized;
    this.saveAllDetails(details);

    const summaries = this.loadAllMutable();
    summaries[normalized.runId] = normalized.summary;
    this.saveAll(summaries);
    return normalized;
  }

  public async getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }

    const current = this.loadAllMutable();
    const found = current[normalizedRunId];
    return found ? normalizeWorkflowRunSummaryRecord(found) : undefined;
  }

  public async getDetailByRunId(runId: string): Promise<WorkflowRunDetailRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }

    const details = this.loadAllDetailsMutable();
    const found = details[normalizedRunId];
    if (found) {
      return normalizeWorkflowRunDetailRecord(found);
    }

    const summary = await this.getByRunId(normalizedRunId);
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
    const current = Object.values(this.loadAllMutable()).map((record) => normalizeWorkflowRunSummaryRecord(record));
    let filtered = current;

    if (query?.workflowId?.trim()) {
      const workflowId = query.workflowId.trim();
      filtered = filtered.filter((entry) => entry.workflow.workflowId === workflowId);
    }

    if (query?.status) {
      filtered = filtered.filter((entry) => entry.status === query.status);
    }

    if (query?.triggerSource) {
      filtered = filtered.filter((entry) => entry.triggerSource === query.triggerSource);
    }

    if (query?.startedAfter?.trim()) {
      const startedAfter = query.startedAfter.trim();
      filtered = filtered.filter((entry) => entry.timestamps.startedAt >= startedAfter);
    }

    if (query?.startedBefore?.trim()) {
      const startedBefore = query.startedBefore.trim();
      filtered = filtered.filter((entry) => entry.timestamps.startedAt <= startedBefore);
    }

    filtered.sort((left, right) => right.timestamps.startedAt.localeCompare(left.timestamps.startedAt));
    if (Number.isInteger(query?.limit) && (query?.limit ?? 0) > 0) {
      filtered = filtered.slice(0, query!.limit);
    }

    return Object.freeze(filtered);
  }

  private loadAllMutable(): Record<string, WorkflowRunSummaryRecord> {
    if (!this.storage) {
      return {};
    }

    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, WorkflowRunSummaryRecord>;
      return Object.fromEntries(
        Object.entries(parsed).map(([runId, record]) => [runId, normalizeWorkflowRunSummaryRecord(record)]),
      );
    } catch {
      return {};
    }
  }

  private saveAll(records: Record<string, WorkflowRunSummaryRecord>): void {
    if (!this.storage) {
      return;
    }
    this.storage.setItem(this.storageKey, JSON.stringify(records));
  }

  private loadAllDetailsMutable(): Record<string, WorkflowRunDetailRecord> {
    if (!this.storage) {
      return {};
    }

    const raw = this.storage.getItem(this.detailStorageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, WorkflowRunDetailRecord>;
      return Object.fromEntries(
        Object.entries(parsed).map(([runId, record]) => [runId, normalizeWorkflowRunDetailRecord(record)]),
      );
    } catch {
      return {};
    }
  }

  private saveAllDetails(records: Record<string, WorkflowRunDetailRecord>): void {
    if (!this.storage) {
      return;
    }
    this.storage.setItem(this.detailStorageKey, JSON.stringify(records));
  }
}
