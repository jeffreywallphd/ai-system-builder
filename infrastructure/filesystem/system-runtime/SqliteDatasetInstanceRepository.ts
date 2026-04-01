import fs from "node:fs";
import path from "node:path";
import type { DatasetInstanceRepository } from "../../../application/system-runtime/DatasetInstanceRepository";
import {
  createDatasetInstance,
  type DatasetInstance,
  type DatasetInstanceRole,
} from "../../../domain/system-runtime/DatasetInstanceDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface DatasetInstanceRow {
  readonly instance_json: string;
}

const SCHEMA_VERSION = 1;
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
          instance_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
