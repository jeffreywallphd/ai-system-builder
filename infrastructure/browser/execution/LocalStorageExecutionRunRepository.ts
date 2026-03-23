import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "../../../application/ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";

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
    records.set(run.runId, freezeRun(run));
    this.write(records);
    return run;
  }

  public async getRunById(runId: string): Promise<IExecutionRunRecord | undefined> {
    return this.read().get(runId.trim());
  }

  public async listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const runs = [...this.read().values()]
      .filter((run) => !criteria?.planId || run.planId === criteria.planId)
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
      return new Map(parsed.map((run) => [run.runId, freezeRun(run)]));
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

function freezeRun(run: IExecutionRunRecord): IExecutionRunRecord {
  return Object.freeze({
    ...run,
    unitIds: Object.freeze([...(run.unitIds ?? [])]),
    units: Object.freeze(Object.fromEntries(
      Object.entries(run.units).map(([unitId, unit]) => [unitId, Object.freeze({
        ...unit,
        dependsOn: Object.freeze([...(unit.dependsOn ?? [])]),
        outputMetadata: unit.outputMetadata ? Object.freeze({ ...unit.outputMetadata }) : undefined,
        provenance: unit.provenance ? Object.freeze({
          ...unit.provenance,
          fallback: unit.provenance.fallback ? Object.freeze({ ...unit.provenance.fallback }) : undefined,
          diagnostics: unit.provenance.diagnostics ? Object.freeze(unit.provenance.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
          metadata: unit.provenance.metadata ? Object.freeze({ ...unit.provenance.metadata }) : undefined,
        }) : undefined,
        diagnostics: unit.diagnostics ? Object.freeze(unit.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
        artifacts: unit.artifacts ? Object.freeze(unit.artifacts.map((artifact) => Object.freeze({ ...artifact }))) : undefined,
      })])
    )),
    transitions: Object.freeze(run.transitions.map((transition) => Object.freeze({
      ...transition,
      provenance: transition.provenance ? Object.freeze({
        ...transition.provenance,
        fallback: transition.provenance.fallback ? Object.freeze({ ...transition.provenance.fallback }) : undefined,
        diagnostics: transition.provenance.diagnostics ? Object.freeze(transition.provenance.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
        metadata: transition.provenance.metadata ? Object.freeze({ ...transition.provenance.metadata }) : undefined,
      }) : undefined,
      diagnostics: transition.diagnostics ? Object.freeze(transition.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
    }))),
    metadata: run.metadata ? Object.freeze({ ...run.metadata }) : undefined,
  });
}
