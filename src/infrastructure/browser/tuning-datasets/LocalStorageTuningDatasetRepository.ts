import { TuningDataset } from "../../../src/domain/tuning-datasets/TuningDatasetEntities";
import type {
  Dataset,
  DatasetRepository,
  DatasetStatus,
  DatasetTaskType,
} from "../../../src/domain/tuning-datasets/interfaces/ITuningDatasetStudio";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DatasetRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly taskType: DatasetTaskType;
  readonly status: DatasetStatus;
  readonly tags: ReadonlyArray<string>;
  readonly latestVersionId?: string;
  readonly selectedVersionId?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string;
}

const defaultStorageKey = "ai-loom-studio.tuning-datasets";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class LocalStorageTuningDatasetRepository implements DatasetRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage: StorageLike | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async save(dataset: Dataset): Promise<Dataset> {
    const records = await this.readRecords();
    records.set(dataset.id, this.toRecord(dataset));
    this.writeRecords(records);
    return new TuningDataset(dataset);
  }

  public async load(id: string): Promise<Dataset | undefined> {
    const record = (await this.readRecords()).get(id.trim());
    return record ? this.toDomain(record) : undefined;
  }

  public async list(criteria?: { readonly taskType?: DatasetTaskType; readonly status?: DatasetStatus; readonly query?: string; readonly limit?: number }): Promise<ReadonlyArray<Dataset>> {
    const query = criteria?.query ? normalize(criteria.query) : undefined;
    const datasets = [...(await this.readRecords()).values()]
      .filter((record) => !criteria?.taskType || record.taskType === criteria.taskType)
      .filter((record) => !criteria?.status || record.status === criteria.status)
      .filter((record) => !query || [record.id, record.name, record.description, ...record.tags].filter(Boolean).some((value) => normalize(String(value)).includes(query)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => this.toDomain(record));

    return Object.freeze(criteria?.limit ? datasets.slice(0, criteria.limit) : datasets);
  }

  private async readRecords(): Promise<Map<string, DatasetRecord>> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return new Map<string, DatasetRecord>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<DatasetRecord>;
      return new Map(parsed.map((record) => [record.id, record]));
    } catch {
      return new Map<string, DatasetRecord>();
    }
  }

  private writeRecords(records: Map<string, DatasetRecord>): void {
    this.storage?.setItem(this.storageKey, JSON.stringify([...records.values()], null, 2));
  }

  private toRecord(dataset: Dataset): DatasetRecord {
    return {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      taskType: dataset.taskType,
      status: dataset.status,
      tags: dataset.tags,
      latestVersionId: dataset.latestVersionId,
      selectedVersionId: dataset.selectedVersionId,
      createdBy: dataset.createdBy,
      createdAt: dataset.createdAt.toISOString(),
      updatedAt: dataset.updatedAt.toISOString(),
      archivedAt: dataset.archivedAt?.toISOString(),
    };
  }

  private toDomain(record: DatasetRecord): Dataset {
    return new TuningDataset({
      id: record.id,
      name: record.name,
      description: record.description,
      taskType: record.taskType,
      status: record.status,
      tags: record.tags,
      latestVersionId: record.latestVersionId,
      selectedVersionId: record.selectedVersionId,
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      archivedAt: record.archivedAt ? new Date(record.archivedAt) : undefined,
    });
  }
}
