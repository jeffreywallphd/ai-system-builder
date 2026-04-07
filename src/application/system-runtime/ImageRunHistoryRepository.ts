import type { ImageRunHistoryRecord } from "./ImageRunHistoryDataContract";

export interface ListImageRunHistoryRecordsQuery {
  readonly systemId: string;
  readonly workflowAssetId?: string;
  readonly status?: ImageRunHistoryRecord["status"];
  readonly limit: number;
  readonly offset: number;
}

export interface ListImageRunHistoryRecordsResult {
  readonly records: ReadonlyArray<ImageRunHistoryRecord>;
  readonly totalCount: number;
}

export interface ImageRunHistoryRepository {
  save(record: ImageRunHistoryRecord): ImageRunHistoryRecord;
  getBySystemAndRunId(input: {
    readonly systemId: string;
    readonly runId: string;
  }): ImageRunHistoryRecord | undefined;
  list(query: ListImageRunHistoryRecordsQuery): ListImageRunHistoryRecordsResult;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class InMemoryImageRunHistoryRepository implements ImageRunHistoryRepository {
  private readonly recordsBySystemId = new Map<string, Map<string, ImageRunHistoryRecord>>();

  public save(record: ImageRunHistoryRecord): ImageRunHistoryRecord {
    const byRunId = this.recordsBySystemId.get(record.system.systemId) ?? new Map<string, ImageRunHistoryRecord>();
    byRunId.set(record.runId, record);
    this.recordsBySystemId.set(record.system.systemId, byRunId);
    return record;
  }

  public getBySystemAndRunId(input: {
    readonly systemId: string;
    readonly runId: string;
  }): ImageRunHistoryRecord | undefined {
    const systemId = normalizeOptional(input.systemId);
    const runId = normalizeOptional(input.runId);
    if (!systemId || !runId) {
      return undefined;
    }
    return this.recordsBySystemId.get(systemId)?.get(runId);
  }

  public list(query: ListImageRunHistoryRecordsQuery): ListImageRunHistoryRecordsResult {
    const byRunId = this.recordsBySystemId.get(query.systemId);
    if (!byRunId) {
      return Object.freeze({ records: Object.freeze([]), totalCount: 0 });
    }

    const filtered = [...byRunId.values()]
      .filter((record) => !query.workflowAssetId || record.workflow.workflowAssetId === query.workflowAssetId)
      .filter((record) => !query.status || record.status === query.status)
      .sort((left, right) =>
        right.timestamps.updatedAt.localeCompare(left.timestamps.updatedAt)
        || right.runId.localeCompare(left.runId)
      );

    const windowed = filtered.slice(query.offset, query.offset + query.limit);
    return Object.freeze({
      records: Object.freeze(windowed),
      totalCount: filtered.length,
    });
  }
}
