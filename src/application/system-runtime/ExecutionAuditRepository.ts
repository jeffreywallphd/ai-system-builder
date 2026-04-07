import type { ExecutionAuditRecord } from "@domain/system-runtime/ExecutionAuditTrailDomain";

export interface ExecutionAuditRepository {
  save(record: ExecutionAuditRecord): void;
  listByExecutionId(executionId: string, limit?: number): ReadonlyArray<ExecutionAuditRecord>;
  listRecent(limit?: number): ReadonlyArray<ExecutionAuditRecord>;
}

export class InMemoryExecutionAuditRepository implements ExecutionAuditRepository {
  private readonly records: ExecutionAuditRecord[] = [];

  public constructor(private readonly maxRecords = 10_000) {}

  public save(record: ExecutionAuditRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  public listByExecutionId(executionId: string, limit?: number): ReadonlyArray<ExecutionAuditRecord> {
    const normalized = executionId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    const filtered = this.records
      .filter((entry) => entry.execution.executionId === normalized)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const bounded = typeof limit === "number" && limit > 0
      ? filtered.slice(Math.max(0, filtered.length - Math.floor(limit)))
      : filtered;
    return Object.freeze([...bounded]);
  }

  public listRecent(limit?: number): ReadonlyArray<ExecutionAuditRecord> {
    const bounded = typeof limit === "number" && limit > 0
      ? this.records.slice(Math.max(0, this.records.length - Math.floor(limit)))
      : this.records;
    return Object.freeze([...bounded]);
  }
}

