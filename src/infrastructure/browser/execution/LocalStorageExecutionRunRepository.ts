import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "@application/ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";
import { freezeExecutionRunRecord } from "@application/execution/freezeExecutionRunRecord";
import { deriveExecutionRunQueryIndex, type IExecutionRunQueryIndex } from "@application/execution/ExecutionRunQueryIndex";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const defaultStorageKey = "ai-loom-studio.execution-runs";

interface StoredExecutionRunEntry {
  readonly run: IExecutionRunRecord;
  readonly query: IExecutionRunQueryIndex;
}

function defaultStorage(): StorageLike | undefined {
  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }

  return window.localStorage;
}

export class LocalStorageExecutionRunRepository implements IExecutionRunRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage: StorageLike | undefined = defaultStorage(),
  ) {}

  public async saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord> {
    const records = this.read();
    records.set(run.runId, Object.freeze({
      run: freezeExecutionRunRecord(run),
      query: deriveExecutionRunQueryIndex(run),
    }));
    this.write(records);
    return run;
  }

  public async getRunById(runId: string): Promise<IExecutionRunRecord | undefined> {
    return this.read().get(runId.trim())?.run;
  }

  public async listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const runs = [...this.read().values()]
      .filter((entry) => !criteria?.planId || entry.run.planId === criteria.planId)
      .filter((entry) => !criteria?.status || entry.run.status === criteria.status)
      .filter((entry) => !criteria?.executionKind || entry.query.executionKind === criteria.executionKind)
      .filter((entry) => !criteria?.unitKind || entry.query.primaryUnitKind === criteria.unitKind || entry.run.unitIds.some((unitId) => entry.run.units[unitId]?.kind === criteria.unitKind))
      .filter((entry) => !criteria?.provenanceClassification || entry.query.primaryProvenanceClassification === criteria.provenanceClassification || entry.run.unitIds.some((unitId) => entry.run.units[unitId]?.provenance?.classification === criteria.provenanceClassification))
      .filter((entry) => !criteria?.flowId || entry.query.executionFlowId === criteria.flowId)
      .filter((entry) => !criteria?.startedAfter || entry.run.startedAt >= criteria.startedAfter)
      .filter((entry) => !criteria?.startedBefore || entry.run.startedAt <= criteria.startedBefore)
      .filter((entry) => !criteria?.updatedAfter || entry.run.updatedAt >= criteria.updatedAfter)
      .filter((entry) => !criteria?.updatedBefore || entry.run.updatedAt <= criteria.updatedBefore)
      .filter((entry) => matchesMetadata(entry.run, criteria?.metadata))
      .sort((left, right) => right.run.startedAt.localeCompare(left.run.startedAt))
      .map((entry) => entry.run);

    return Object.freeze(criteria?.limit ? runs.slice(0, criteria.limit) : runs);
  }

  private read(): Map<string, StoredExecutionRunEntry> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return new Map<string, StoredExecutionRunEntry>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<StoredExecutionRunEntry | IExecutionRunRecord>;
      return new Map(parsed.map((entry) => {
        const run = isStoredEntry(entry) ? entry.run : entry;
        const frozenRun = freezeExecutionRunRecord(run);
        return [frozenRun.runId, Object.freeze({
          run: frozenRun,
          query: isStoredEntry(entry) ? entry.query : deriveExecutionRunQueryIndex(frozenRun),
        })];
      }));
    } catch {
      return new Map<string, StoredExecutionRunEntry>();
    }
  }

  private write(records: Map<string, StoredExecutionRunEntry>): void {
    const next = [...records.values()];
    if (next.length === 0) {
      this.storage?.removeItem?.(this.storageKey);
      return;
    }

    this.storage?.setItem(this.storageKey, JSON.stringify(next, null, 2));
  }
}

function matchesMetadata(
  run: IExecutionRunRecord,
  metadata?: Readonly<Record<string, string | number | boolean>>,
): boolean {
  if (!metadata) {
    return true;
  }

  return Object.entries(metadata).every(([key, value]) => run.metadata?.[key] === value);
}

function isStoredEntry(value: StoredExecutionRunEntry | IExecutionRunRecord): value is StoredExecutionRunEntry {
  return "run" in value && typeof value.run === "object" && value.run !== null;
}

