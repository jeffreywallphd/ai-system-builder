import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import { normalizeWorkflowRunSummaryRecord } from "../../domain/workflow-studio/WorkflowRunHistoryDomain";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const STORAGE_KEY = "ai-loom.workflow-run-summaries.v1";

export class LocalStorageWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  constructor(
    private readonly storageKey: string = STORAGE_KEY,
    private readonly storage: StorageLike | undefined = typeof localStorage !== "undefined" ? localStorage : undefined,
  ) {}

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);
    const current = this.loadAllMutable();
    current[normalized.runId] = normalized;
    this.saveAll(current);
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
}
