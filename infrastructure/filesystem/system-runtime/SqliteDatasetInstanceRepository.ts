import fs from "node:fs";
import path from "node:path";
import type { DatasetInstanceRepository } from "../../../application/system-runtime/DatasetInstanceRepository";
import {
  createDatasetInstance,
  type DatasetInstance,
  type DatasetInstanceRole,
} from "../../../domain/system-runtime/DatasetInstanceDomain";
import {
  createDatasetInstanceImageRecord,
  matchesDatasetInstanceImageRecordQuery,
  normalizeDatasetInstanceImageRecordQuery,
  type DatasetInstanceImageRecord,
  type DatasetInstanceImageRecordQuery,
} from "../../../domain/system-runtime/DatasetInstanceRecordDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface DatasetInstanceRow {
  readonly instance_json: string;
}

interface DatasetInstanceImageRecordRow {
  readonly record_json: string;
}

const SCHEMA_VERSION = 4;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS system_runtime_dataset_instance_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS system_dataset_instances (
      instance_id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL,
      dataset_asset_id TEXT NOT NULL,
      dataset_asset_version_id TEXT,
      instance_role TEXT NOT NULL,
      instance_purpose TEXT,
      lifecycle_status TEXT NOT NULL,
      runtime_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seed_metadata_json TEXT,
      instance_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS system_dataset_instances_system_idx
      ON system_dataset_instances(system_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS system_dataset_instances_role_idx
      ON system_dataset_instances(system_id, instance_role, instance_purpose, updated_at DESC);
  `],
  [2, `
    ALTER TABLE system_dataset_instances
      ADD COLUMN lifecycle_metadata_json TEXT;
  `],
  [3, `
    CREATE TABLE IF NOT EXISTS system_dataset_instance_image_records (
      record_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      dataset_asset_id TEXT NOT NULL,
      dataset_asset_version_id TEXT,
      image_format TEXT NOT NULL,
      image_width REAL NOT NULL,
      image_height REAL NOT NULL,
      image_asset_stable_id TEXT NOT NULL,
      storage_reference TEXT,
      storage_provider TEXT,
      admitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      image_metadata_json TEXT NOT NULL,
      record_metadata_json TEXT NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY(instance_id, record_id),
      FOREIGN KEY(instance_id) REFERENCES system_dataset_instances(instance_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS system_dataset_instance_image_records_instance_idx
      ON system_dataset_instance_image_records(instance_id, updated_at DESC, record_id ASC);
    CREATE INDEX IF NOT EXISTS system_dataset_instance_image_records_query_idx
      ON system_dataset_instance_image_records(instance_id, image_format, image_asset_stable_id, updated_at DESC);
  `],
  [4, `
    CREATE TABLE IF NOT EXISTS system_dataset_instance_image_records_v4 (
      record_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      dataset_asset_id TEXT NOT NULL,
      dataset_asset_version_id TEXT,
      image_format TEXT NOT NULL,
      image_width REAL NOT NULL,
      image_height REAL NOT NULL,
      image_asset_stable_id TEXT NOT NULL,
      storage_reference TEXT,
      storage_provider TEXT,
      admitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      image_metadata_json TEXT NOT NULL,
      record_metadata_json TEXT NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY(instance_id, record_id),
      FOREIGN KEY(instance_id) REFERENCES system_dataset_instances(instance_id) ON DELETE CASCADE
    );
    INSERT INTO system_dataset_instance_image_records_v4 (
      record_id,
      instance_id,
      system_id,
      dataset_asset_id,
      dataset_asset_version_id,
      image_format,
      image_width,
      image_height,
      image_asset_stable_id,
      storage_reference,
      storage_provider,
      admitted_at,
      updated_at,
      tags_json,
      image_metadata_json,
      record_metadata_json,
      record_json
    )
    SELECT
      record_id,
      instance_id,
      system_id,
      dataset_asset_id,
      dataset_asset_version_id,
      image_format,
      image_width,
      image_height,
      image_asset_stable_id,
      storage_reference,
      storage_provider,
      admitted_at,
      updated_at,
      tags_json,
      image_metadata_json,
      record_metadata_json,
      record_json
    FROM system_dataset_instance_image_records;
    DROP TABLE system_dataset_instance_image_records;
    ALTER TABLE system_dataset_instance_image_records_v4 RENAME TO system_dataset_instance_image_records;
    CREATE INDEX IF NOT EXISTS system_dataset_instance_image_records_instance_idx
      ON system_dataset_instance_image_records(instance_id, updated_at DESC, record_id ASC);
    CREATE INDEX IF NOT EXISTS system_dataset_instance_image_records_query_idx
      ON system_dataset_instance_image_records(instance_id, image_format, image_asset_stable_id, updated_at DESC);
  `],
]);

export class SqliteDatasetInstanceRepository implements DatasetInstanceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public save(instance: DatasetInstance): DatasetInstance {
    this.getDatabase()
      .prepare(`
        INSERT INTO system_dataset_instances (
          instance_id,
          system_id,
          dataset_asset_id,
          dataset_asset_version_id,
          instance_role,
          instance_purpose,
          lifecycle_status,
          runtime_status,
          created_at,
          updated_at,
          seed_metadata_json,
          lifecycle_metadata_json,
          instance_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instance_id) DO UPDATE SET
          system_id = excluded.system_id,
          dataset_asset_id = excluded.dataset_asset_id,
          dataset_asset_version_id = excluded.dataset_asset_version_id,
          instance_role = excluded.instance_role,
          instance_purpose = excluded.instance_purpose,
          lifecycle_status = excluded.lifecycle_status,
          runtime_status = excluded.runtime_status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          seed_metadata_json = excluded.seed_metadata_json,
          lifecycle_metadata_json = excluded.lifecycle_metadata_json,
          instance_json = excluded.instance_json
      `)
      .run(
        instance.instanceId,
        instance.systemId,
        instance.datasetAssetId,
        instance.datasetAssetVersionId ?? null,
        instance.role,
        instance.purpose ?? null,
        instance.lifecycleStatus,
        instance.runtimeStatus,
        instance.createdAt,
        instance.updatedAt,
        instance.seedMetadata ? JSON.stringify(instance.seedMetadata) : null,
        instance.lifecycleMetadata ? JSON.stringify(instance.lifecycleMetadata) : null,
        JSON.stringify(instance),
      );
    return instance;
  }

  public getById(instanceId: string): DatasetInstance | undefined {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT instance_json
        FROM system_dataset_instances
        WHERE instance_id = ?
      `)
      .get(normalized) as DatasetInstanceRow | undefined;
    return row ? this.parse(row.instance_json) : undefined;
  }

  public getBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance | undefined {
    const systemId = normalizeOptional(input.systemId);
    const instanceId = normalizeOptional(input.instanceId);
    if (!systemId || !instanceId) {
      return undefined;
    }
    const row = this.getDatabase()
      .prepare(`
        SELECT instance_json
        FROM system_dataset_instances
        WHERE system_id = ? AND instance_id = ?
      `)
      .get(systemId, instanceId) as DatasetInstanceRow | undefined;
    return row ? this.parse(row.instance_json) : undefined;
  }

  public deleteById(instanceId: string): boolean {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return false;
    }
    const result = this.getDatabase()
      .prepare(`
        DELETE FROM system_dataset_instances
        WHERE instance_id = ?
      `)
      .run(normalized);
    return Number(result.changes ?? 0) > 0;
  }

  public listBySystemId(systemId: string): ReadonlyArray<DatasetInstance> {
    const normalized = normalizeOptional(systemId);
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT instance_json
        FROM system_dataset_instances
        WHERE system_id = ?
        ORDER BY updated_at DESC, instance_id ASC
      `)
      .all(normalized) as DatasetInstanceRow[];
    return Object.freeze(rows.map((row) => this.parse(row.instance_json)));
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
    const row = this.getDatabase()
      .prepare(`
        SELECT instance_json
        FROM system_dataset_instances
        WHERE system_id = ?
          AND instance_role = ?
          AND (
            (? IS NULL AND instance_purpose IS NULL)
            OR instance_purpose = ?
          )
        ORDER BY updated_at DESC, instance_id ASC
        LIMIT 1
      `)
      .get(
        normalizedSystemId,
        input.role,
        normalizedPurpose ?? null,
        normalizedPurpose ?? null,
      ) as DatasetInstanceRow | undefined;
    return row ? this.parse(row.instance_json) : undefined;
  }

  public saveImageRecord(record: DatasetInstanceImageRecord): DatasetInstanceImageRecord {
    this.getDatabase()
      .prepare(`
        INSERT INTO system_dataset_instance_image_records (
          record_id,
          instance_id,
          system_id,
          dataset_asset_id,
          dataset_asset_version_id,
          image_format,
          image_width,
          image_height,
          image_asset_stable_id,
          storage_reference,
          storage_provider,
          admitted_at,
          updated_at,
          tags_json,
          image_metadata_json,
          record_metadata_json,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instance_id, record_id) DO UPDATE SET
          instance_id = excluded.instance_id,
          system_id = excluded.system_id,
          dataset_asset_id = excluded.dataset_asset_id,
          dataset_asset_version_id = excluded.dataset_asset_version_id,
          image_format = excluded.image_format,
          image_width = excluded.image_width,
          image_height = excluded.image_height,
          image_asset_stable_id = excluded.image_asset_stable_id,
          storage_reference = excluded.storage_reference,
          storage_provider = excluded.storage_provider,
          admitted_at = excluded.admitted_at,
          updated_at = excluded.updated_at,
          tags_json = excluded.tags_json,
          image_metadata_json = excluded.image_metadata_json,
          record_metadata_json = excluded.record_metadata_json,
          record_json = excluded.record_json
      `)
      .run(
        record.recordId,
        record.instanceId,
        record.systemId,
        record.datasetAssetId,
        record.datasetAssetVersionId ?? null,
        record.image.format,
        record.image.width,
        record.image.height,
        record.image.assetRef.stableId,
        record.storage?.reference ?? null,
        record.storage?.provider ?? null,
        record.admittedAt,
        record.updatedAt,
        JSON.stringify(record.image.tags),
        JSON.stringify(record.image.metadata),
        JSON.stringify(record.metadata),
        JSON.stringify(record),
      );

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

    const row = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM system_dataset_instance_image_records
        WHERE instance_id = ? AND record_id = ?
      `)
      .get(instanceId, recordId) as DatasetInstanceImageRecordRow | undefined;
    return row ? this.parseImageRecord(row.record_json) : undefined;
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

    const result = this.getDatabase()
      .prepare(`
        DELETE FROM system_dataset_instance_image_records
        WHERE instance_id = ? AND record_id = ?
      `)
      .run(instanceId, recordId);
    return Number(result.changes ?? 0) > 0;
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
    const row = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM system_dataset_instance_image_records
        WHERE system_id = ? AND instance_id = ? AND record_id = ?
      `)
      .get(systemId, instanceId, recordId) as DatasetInstanceImageRecordRow | undefined;
    return row ? this.parseImageRecord(row.record_json) : undefined;
  }

  public deleteImageRecordsByInstanceId(instanceId: string): number {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return 0;
    }

    const result = this.getDatabase()
      .prepare(`
        DELETE FROM system_dataset_instance_image_records
        WHERE instance_id = ?
      `)
      .run(normalized);
    return Number(result.changes ?? 0);
  }

  public listImageRecordsByInstanceId(instanceId: string): ReadonlyArray<DatasetInstanceImageRecord> {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM system_dataset_instance_image_records
        WHERE instance_id = ?
        ORDER BY updated_at DESC, record_id ASC
      `)
      .all(normalized) as DatasetInstanceImageRecordRow[];
    return Object.freeze(rows.map((row) => this.parseImageRecord(row.record_json)));
  }

  public listImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    const systemId = normalizeOptional(input.systemId);
    const instanceId = normalizeOptional(input.instanceId);
    if (!systemId || !instanceId) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM system_dataset_instance_image_records
        WHERE system_id = ? AND instance_id = ?
        ORDER BY updated_at DESC, record_id ASC
      `)
      .all(systemId, instanceId) as DatasetInstanceImageRecordRow[];
    return Object.freeze(rows.map((row) => this.parseImageRecord(row.record_json)));
  }

  public queryImageRecordsByInstanceId(input: {
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    const query = normalizeDatasetInstanceImageRecordQuery(input.query);
    const records = this.listImageRecordsByInstanceId(input.instanceId);
    if (!query) {
      return records;
    }
    return Object.freeze(records.filter((record) => matchesDatasetInstanceImageRecordQuery(record, query)));
  }

  public queryImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
  }): ReadonlyArray<DatasetInstanceImageRecord> {
    const query = normalizeDatasetInstanceImageRecordQuery(input.query);
    const records = this.listImageRecordsBySystemId({
      systemId: input.systemId,
      instanceId: input.instanceId,
    });
    if (!query) {
      return records;
    }
    return Object.freeze(records.filter((record) => matchesDatasetInstanceImageRecordQuery(record, query)));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }
    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }
    return this.database;
  }

  private initialize(db: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(db);
    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(
        `System dataset instance repository schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, migration] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }
      db.transaction(() => {
        db.exec(migration);
        db.prepare(`
          INSERT INTO system_runtime_dataset_instance_migrations (version, applied_at)
          VALUES (?, ?)
        `).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_runtime_dataset_instance_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const row = db.prepare(`
      SELECT MAX(version) AS version
      FROM system_runtime_dataset_instance_migrations
    `).get() as { readonly version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private parse(raw: string): DatasetInstance {
    const snapshot = JSON.parse(raw) as DatasetInstance;
    return createDatasetInstance({
      instanceId: snapshot.instanceId,
      systemId: snapshot.systemId,
      datasetAssetId: snapshot.datasetAssetId,
      datasetAssetVersionId: snapshot.datasetAssetVersionId,
      role: snapshot.role,
      purpose: snapshot.purpose,
      lifecycleStatus: snapshot.lifecycleStatus,
      runtimeStatus: snapshot.runtimeStatus,
      seedMetadata: snapshot.seedMetadata,
      lifecycleMetadata: snapshot.lifecycleMetadata,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  private parseImageRecord(raw: string): DatasetInstanceImageRecord {
    const snapshot = JSON.parse(raw) as DatasetInstanceImageRecord;
    return createDatasetInstanceImageRecord({
      recordId: snapshot.recordId,
      instanceId: snapshot.instanceId,
      systemId: snapshot.systemId,
      datasetAssetId: snapshot.datasetAssetId,
      datasetAssetVersionId: snapshot.datasetAssetVersionId,
      image: snapshot.image,
      storage: snapshot.storage,
      metadata: snapshot.metadata,
      admittedAt: snapshot.admittedAt,
      updatedAt: snapshot.updatedAt,
      mutationVersion: snapshot.mutationVersion,
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
