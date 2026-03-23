import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "../../../application/ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import { freezeExecutionRunRecord } from "../../../application/execution/freezeExecutionRunRecord";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const defaultStorageKey = "ai-loom-studio.execution-runs";

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
    records.set(run.runId, freezeExecutionRunRecord(run));
    this.write(records);
    return run;
  }

  public async getRunById(runId: string): Promise<IExecutionRunRecord | undefined> {
    return this.read().get(runId.trim());
  }

  public async listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const runs = [...this.read().values()]
      .filter((run) => !criteria?.planId || run.planId === criteria.planId)
      .filter((run) => !criteria?.status || run.status === criteria.status)
      .filter((run) => !criteria?.executionKind || run.metadata?.executionKind === criteria.executionKind)
      .filter((run) => matchesMetadata(run, criteria?.metadata))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

    return Object.freeze(criteria?.limit ? runs.slice(0, criteria.limit) : runs);
  }

  private read(): Map<string, IExecutionRunRecord> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return new Map<string, IExecutionRunRecord>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<IExecutionRunRecord>;
      return new Map(parsed.map((run) => [run.runId, freezeExecutionRunRecord(run)]));
    } catch {
      return new Map<string, IExecutionRunRecord>();
    }
  }

  private write(records: Map<string, IExecutionRunRecord>): void {
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
