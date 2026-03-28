import type { SystemExecution } from "../../domain/system-runtime/SystemRuntimeDomain";

export interface ExecutionMetadataSnapshot {
  readonly executionId: string;
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly status: SystemExecution["status"];
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly environmentId?: string;
  readonly trace: {
    readonly eventCount: number;
    readonly logCount: number;
    readonly lastEventAt?: string;
  };
  readonly result: {
    readonly hasOutput: boolean;
    readonly hasError: boolean;
    readonly outputSummary?: string;
  };
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly parentExecutionId?: string;
  readonly parentNodeId?: string;
  readonly childExecutionIds: ReadonlyArray<string>;
}

export interface PersistedExecutionRecord {
  readonly executionId: string;
  readonly execution: SystemExecution;
  readonly metadata: ExecutionMetadataSnapshot;
}

export interface ISystemRuntimeExecutionStore {
  saveExecutionRecord(record: PersistedExecutionRecord): void;
  getExecutionRecord(executionId: string): PersistedExecutionRecord | undefined;
  listExecutionRecordsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): ReadonlyArray<PersistedExecutionRecord>;
}

export class InMemorySystemRuntimeExecutionStore implements ISystemRuntimeExecutionStore {
  private readonly recordsById = new Map<string, PersistedExecutionRecord>();

  public saveExecutionRecord(record: PersistedExecutionRecord): void {
    this.recordsById.set(record.executionId, Object.freeze({
      ...record,
      metadata: Object.freeze({
        ...record.metadata,
        childExecutionIds: Object.freeze([...record.metadata.childExecutionIds]),
        executedVersionMap: Object.freeze({
          rootVersionId: record.metadata.executedVersionMap.rootVersionId,
          nodeVersionIds: Object.freeze({ ...record.metadata.executedVersionMap.nodeVersionIds }),
        }),
      }),
    }));
  }

  public getExecutionRecord(executionId: string): PersistedExecutionRecord | undefined {
    return this.recordsById.get(executionId.trim());
  }

  public listExecutionRecordsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): ReadonlyArray<PersistedExecutionRecord> {
    const normalizedAssetId = input.assetId.trim();
    if (!normalizedAssetId) {
      return Object.freeze([]);
    }

    const normalizedVersionId = input.versionId?.trim() || undefined;
    const filtered = [...this.recordsById.values()]
      .filter((record) => record.execution.root.assetId === normalizedAssetId)
      .filter((record) => !normalizedVersionId || record.execution.root.versionId === normalizedVersionId)
      .sort((left, right) => right.execution.startedAt.localeCompare(left.execution.startedAt));

    const limit = typeof input.limit === "number" && input.limit > 0
      ? Math.floor(input.limit)
      : undefined;
    return Object.freeze((limit ? filtered.slice(0, limit) : filtered));
  }
}
