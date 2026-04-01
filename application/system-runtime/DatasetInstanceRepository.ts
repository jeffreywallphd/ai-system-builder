import type { DatasetInstance, DatasetInstanceRole } from "../../domain/system-runtime/DatasetInstanceDomain";
import type {
  DatasetInstanceImageRecord,
  DatasetInstanceImageRecordQuery,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import {
  matchesDatasetInstanceImageRecordQuery,
  normalizeDatasetInstanceImageRecordQuery,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";

export interface DatasetInstanceRepository {
  save(instance: DatasetInstance): DatasetInstance;
  getById(instanceId: string): DatasetInstance | undefined;
  listBySystemId(systemId: string): ReadonlyArray<DatasetInstance>;
  findBySystemAndRole(input: {
    readonly systemId: string;
    readonly role: DatasetInstanceRole;
    readonly purpose?: string;
  }): DatasetInstance | undefined;
  saveImageRecord(record: DatasetInstanceImageRecord): DatasetInstanceImageRecord;
  getImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined;
  listImageRecordsByInstanceId(instanceId: string): ReadonlyArray<DatasetInstanceImageRecord>;
  queryImageRecordsByInstanceId(input: {
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class InMemoryDatasetInstanceRepository implements DatasetInstanceRepository {
  private readonly byId = new Map<string, DatasetInstance>();
  private readonly imageRecordsByInstanceId = new Map<string, Map<string, DatasetInstanceImageRecord>>();

  public save(instance: DatasetInstance): DatasetInstance {
    this.byId.set(instance.instanceId, instance);
    return instance;
  }

  public getById(instanceId: string): DatasetInstance | undefined {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return undefined;
    }
    return this.byId.get(normalized);
  }

  public listBySystemId(systemId: string): ReadonlyArray<DatasetInstance> {
    const normalized = normalizeOptional(systemId);
    if (!normalized) {
      return Object.freeze([]);
    }
    return Object.freeze(
      [...this.byId.values()]
        .filter((instance) => instance.systemId === normalized)
        .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)),
    );
  }

  public findBySystemAndRole(input: {
    readonly systemId: string;
    readonly role: DatasetInstanceRole;
    readonly purpose?: string;
  }): DatasetInstance | undefined {
    const normalizedSystemId = normalizeOptional(input.systemId);
    if (!normalizedSystemId) {
      return undefined;
    }
    const normalizedPurpose = normalizeOptional(input.purpose);
    return [...this.byId.values()].find((instance) =>
      instance.systemId === normalizedSystemId
      && instance.role === input.role
      && normalizeOptional(instance.purpose) === normalizedPurpose
    );
  }

  public saveImageRecord(record: DatasetInstanceImageRecord): DatasetInstanceImageRecord {
    const byRecordId = this.imageRecordsByInstanceId.get(record.instanceId) ?? new Map<string, DatasetInstanceImageRecord>();
    byRecordId.set(record.recordId, record);
    this.imageRecordsByInstanceId.set(record.instanceId, byRecordId);
    return record;
  }

  public getImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined {
    const instanceId = normalizeOptional(input.instanceId);
    const recordId = normalizeOptional(input.recordId);
    if (!instanceId || !recordId) {
      return undefined;
    }
    return this.imageRecordsByInstanceId.get(instanceId)?.get(recordId);
  }

  public listImageRecordsByInstanceId(instanceId: string): ReadonlyArray<DatasetInstanceImageRecord> {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return Object.freeze([]);
    }
    const entries = this.imageRecordsByInstanceId.get(normalized);
    if (!entries) {
      return Object.freeze([]);
    }
    return Object.freeze(
      [...entries.values()].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.recordId.localeCompare(right.recordId)
      ),
    );
  }

  public queryImageRecordsByInstanceId(input: {
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    const query = normalizeDatasetInstanceImageRecordQuery(input.query);
    return Object.freeze(
      this.listImageRecordsByInstanceId(input.instanceId)
        .filter((record) => matchesDatasetInstanceImageRecordQuery(record, query)),
    );
  }
}
