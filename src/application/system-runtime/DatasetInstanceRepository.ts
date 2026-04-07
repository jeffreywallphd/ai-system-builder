import type { DatasetInstance, DatasetInstanceRole } from "@domain/system-runtime/DatasetInstanceDomain";
import type {
  DatasetInstanceImageRecord,
  DatasetInstanceImageRecordQuery,
} from "@domain/system-runtime/DatasetInstanceRecordDomain";
import {
  matchesDatasetInstanceImageRecordQuery,
  normalizeDatasetInstanceImageRecordQuery,
} from "@domain/system-runtime/DatasetInstanceRecordDomain";
import type { DatasetInstanceStorageAdapter } from "./DatasetInstanceStorageAdapter";

export interface DatasetInstanceImageRecordWindow {
  readonly offset: number;
  readonly limit: number;
}

export interface QueryDatasetInstanceImageRecordPageBySystemIdRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly query?: DatasetInstanceImageRecordQuery;
  readonly window: DatasetInstanceImageRecordWindow;
}

export interface QueryDatasetInstanceImageRecordPageResult {
  readonly items: ReadonlyArray<DatasetInstanceImageRecord>;
  readonly totalCount: number;
  readonly offset: number;
  readonly limit: number;
}

export interface DatasetInstanceRepository {
  save(instance: DatasetInstance): DatasetInstance;
  getById(instanceId: string): DatasetInstance | undefined;
  getBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance | undefined;
  deleteById(instanceId: string): boolean;
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
  getImageRecordBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined;
  deleteImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): boolean;
  deleteImageRecordsByInstanceId(instanceId: string): number;
  listImageRecordsByInstanceId(instanceId: string): ReadonlyArray<DatasetInstanceImageRecord>;
  listImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): ReadonlyArray<DatasetInstanceImageRecord>;
  queryImageRecordsByInstanceId(input: {
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord>;
  queryImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord>;
  queryImageRecordPageBySystemId(
    input: QueryDatasetInstanceImageRecordPageBySystemIdRequest,
  ): QueryDatasetInstanceImageRecordPageResult;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

class InMemoryDatasetInstanceStorageAdapter implements DatasetInstanceStorageAdapter {
  private readonly byId = new Map<string, DatasetInstance>();
  private readonly imageRecordsByInstanceId = new Map<string, Map<string, DatasetInstanceImageRecord>>();

  public saveInstance(instance: DatasetInstance): DatasetInstance {
    this.byId.set(instance.instanceId, instance);
    return instance;
  }

  public getInstanceById(instanceId: string): DatasetInstance | undefined {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return undefined;
    }
    return this.byId.get(normalized);
  }

  public deleteInstanceById(instanceId: string): boolean {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return false;
    }
    const deleted = this.byId.delete(normalized);
    if (deleted) {
      this.imageRecordsByInstanceId.delete(normalized);
    }
    return deleted;
  }

  public getInstanceBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance | undefined {
    const systemId = normalizeOptional(input.systemId);
    const instanceId = normalizeOptional(input.instanceId);
    if (!systemId || !instanceId) {
      return undefined;
    }
    const instance = this.byId.get(instanceId);
    if (!instance || instance.systemId !== systemId) {
      return undefined;
    }
    return instance;
  }

  public listInstancesBySystemId(systemId: string): ReadonlyArray<DatasetInstance> {
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

  public findInstanceBySystemAndRole(input: {
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

  public deleteImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): boolean {
    const instanceId = normalizeOptional(input.instanceId);
    const recordId = normalizeOptional(input.recordId);
    if (!instanceId || !recordId) {
      return false;
    }
    const byRecordId = this.imageRecordsByInstanceId.get(instanceId);
    if (!byRecordId) {
      return false;
    }
    const deleted = byRecordId.delete(recordId);
    if (byRecordId.size === 0) {
      this.imageRecordsByInstanceId.delete(instanceId);
    }
    return deleted;
  }

  public getImageRecordBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined {
    const systemId = normalizeOptional(input.systemId);
    const instanceId = normalizeOptional(input.instanceId);
    const recordId = normalizeOptional(input.recordId);
    if (!systemId || !instanceId || !recordId) {
      return undefined;
    }
    const record = this.imageRecordsByInstanceId.get(instanceId)?.get(recordId);
    if (!record || record.systemId !== systemId) {
      return undefined;
    }
    return record;
  }

  public deleteImageRecordsByInstanceId(instanceId: string): number {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return 0;
    }
    const byRecordId = this.imageRecordsByInstanceId.get(normalized);
    if (!byRecordId) {
      return 0;
    }
    const count = byRecordId.size;
    this.imageRecordsByInstanceId.delete(normalized);
    return count;
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

  public listImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    const systemId = normalizeOptional(input.systemId);
    if (!systemId) {
      return Object.freeze([]);
    }
    return Object.freeze(this.listImageRecordsByInstanceId(input.instanceId).filter((record) => record.systemId === systemId));
  }
}

export class StorageBackedDatasetInstanceRepository implements DatasetInstanceRepository {
  public constructor(private readonly storageAdapter: DatasetInstanceStorageAdapter) {}

  public save(instance: DatasetInstance): DatasetInstance {
    return this.storageAdapter.saveInstance(instance);
  }

  public getById(instanceId: string): DatasetInstance | undefined {
    return this.storageAdapter.getInstanceById(instanceId);
  }

  public getBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance | undefined {
    return this.storageAdapter.getInstanceBySystemAndId(input);
  }

  public deleteById(instanceId: string): boolean {
    return this.storageAdapter.deleteInstanceById(instanceId);
  }

  public listBySystemId(systemId: string): ReadonlyArray<DatasetInstance> {
    return this.storageAdapter.listInstancesBySystemId(systemId);
  }

  public findBySystemAndRole(input: {
    readonly systemId: string;
    readonly role: DatasetInstanceRole;
    readonly purpose?: string;
  }): DatasetInstance | undefined {
    return this.storageAdapter.findInstanceBySystemAndRole(input);
  }

  public saveImageRecord(record: DatasetInstanceImageRecord): DatasetInstanceImageRecord {
    const instance = this.storageAdapter.getInstanceById(record.instanceId);
    if (instance && instance.systemId !== record.systemId) {
      throw new Error(
        `invalid-request:Cannot save image record '${record.recordId}' with system '${record.systemId}' into instance '${record.instanceId}' owned by '${instance.systemId}'.`,
      );
    }
    return this.storageAdapter.saveImageRecord(record);
  }

  public getImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined {
    return this.storageAdapter.getImageRecordById(input);
  }

  public getImageRecordBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined {
    return this.storageAdapter.getImageRecordBySystemAndId(input);
  }

  public deleteImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): boolean {
    return this.storageAdapter.deleteImageRecordById(input);
  }

  public deleteImageRecordsByInstanceId(instanceId: string): number {
    return this.storageAdapter.deleteImageRecordsByInstanceId(instanceId);
  }

  public listImageRecordsByInstanceId(instanceId: string): ReadonlyArray<DatasetInstanceImageRecord> {
    return this.storageAdapter.listImageRecordsByInstanceId(instanceId);
  }

  public listImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    return this.storageAdapter.listImageRecordsBySystemId(input);
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

  public queryImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    const query = normalizeDatasetInstanceImageRecordQuery(input.query);
    return Object.freeze(
      this.listImageRecordsBySystemId(input)
        .filter((record) => matchesDatasetInstanceImageRecordQuery(record, query)),
    );
  }

  public queryImageRecordPageBySystemId(
    input: QueryDatasetInstanceImageRecordPageBySystemIdRequest,
  ): QueryDatasetInstanceImageRecordPageResult {
    const records = this.queryImageRecordsBySystemId({
      systemId: input.systemId,
      instanceId: input.instanceId,
      query: input.query,
    });
    const offset = Math.max(0, Math.floor(input.window.offset));
    const limit = Math.max(1, Math.floor(input.window.limit));
    const items = records.slice(offset, offset + limit);
    return Object.freeze({
      items: Object.freeze(items),
      totalCount: records.length,
      offset,
      limit,
    });
  }
}

export class InMemoryDatasetInstanceRepository extends StorageBackedDatasetInstanceRepository {
  public constructor() {
    super(new InMemoryDatasetInstanceStorageAdapter());
  }
}

