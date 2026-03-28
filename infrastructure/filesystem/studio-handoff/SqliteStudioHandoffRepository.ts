import fs from "node:fs";
import path from "node:path";
import type {
  PersistedStudioHandoffRecord,
  StudioHandoffRepository,
} from "../../../application/studio-handoff/StudioHandoffPersistenceService";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface SnapshotRow {
  readonly snapshot_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS studio_handoff_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS studio_handoff_records (
      handoff_id TEXT PRIMARY KEY,
      source_studio_id TEXT NOT NULL,
      target_studio_id TEXT NOT NULL,
      authoritative_asset_id TEXT NOT NULL,
      authoritative_version_id TEXT NOT NULL,
      orchestration_status TEXT NOT NULL,
      revision_id TEXT,
      previous_handoff_id TEXT,
      updated_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS studio_handoff_records_source_idx
      ON studio_handoff_records(source_studio_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS studio_handoff_records_target_idx
      ON studio_handoff_records(target_studio_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS studio_handoff_records_asset_idx
      ON studio_handoff_records(authoritative_asset_id, authoritative_version_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS studio_handoff_records_revision_idx
      ON studio_handoff_records(previous_handoff_id, revision_id, updated_at DESC);
  `],
]);

export class SqliteStudioHandoffRepository implements StudioHandoffRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async saveRecord(record: PersistedStudioHandoffRecord): Promise<PersistedStudioHandoffRecord> {
    this.getDatabase()
      .prepare(`
        INSERT INTO studio_handoff_records (
          handoff_id,
          source_studio_id,
          target_studio_id,
          authoritative_asset_id,
          authoritative_version_id,
          orchestration_status,
          revision_id,
          previous_handoff_id,
          updated_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(handoff_id) DO UPDATE SET
          source_studio_id = excluded.source_studio_id,
          target_studio_id = excluded.target_studio_id,
          authoritative_asset_id = excluded.authoritative_asset_id,
          authoritative_version_id = excluded.authoritative_version_id,
          orchestration_status = excluded.orchestration_status,
          revision_id = excluded.revision_id,
          previous_handoff_id = excluded.previous_handoff_id,
          updated_at = excluded.updated_at,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        record.handoffId,
        record.sourceStudioId,
        record.targetStudioId,
        record.authoritativeAsset.assetId,
        record.authoritativeAsset.versionId,
        record.orchestration.status,
        record.revision?.revisionId ?? null,
        record.revision?.previousHandoffId ?? null,
        record.updatedAt,
        JSON.stringify(record),
      );

    return record;
  }

  public async getRecordByHandoffId(handoffId: string): Promise<PersistedStudioHandoffRecord | undefined> {
    const normalized = handoffId.trim();
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_handoff_records WHERE handoff_id = ?")
      .get(normalized) as SnapshotRow | undefined;

    return row ? this.parse(row.snapshot_json) : undefined;
  }

  public async listRecordsBySourceStudio(sourceStudioId: string, limit = 100): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const normalized = sourceStudioId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_handoff_records WHERE source_studio_id = ? ORDER BY updated_at DESC LIMIT ?")
      .all(normalized, Math.max(0, limit)) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.parse(row.snapshot_json)));
  }

  public async listRecordsByTargetStudio(targetStudioId: string, limit = 100): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const normalized = targetStudioId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_handoff_records WHERE target_studio_id = ? ORDER BY updated_at DESC LIMIT ?")
      .all(normalized, Math.max(0, limit)) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.parse(row.snapshot_json)));
  }

  public async listRecordsByAssetVersion(params: {
    assetId: string;
    versionId?: string;
    limit?: number;
  }): Promise<ReadonlyArray<PersistedStudioHandoffRecord>> {
    const normalizedAssetId = params.assetId.trim();
    const normalizedVersionId = params.versionId?.trim();

    if (!normalizedAssetId) {
      return Object.freeze([]);
    }

    const normalizedLimit = Math.max(0, params.limit ?? 100);
    const rows = normalizedVersionId
      ? this.getDatabase()
        .prepare(`
          SELECT snapshot_json
          FROM studio_handoff_records
          WHERE authoritative_asset_id = ?
            AND authoritative_version_id = ?
          ORDER BY updated_at DESC
          LIMIT ?
        `)
        .all(normalizedAssetId, normalizedVersionId, normalizedLimit) as SnapshotRow[]
      : this.getDatabase()
        .prepare(`
          SELECT snapshot_json
          FROM studio_handoff_records
          WHERE authoritative_asset_id = ?
          ORDER BY updated_at DESC
          LIMIT ?
        `)
        .all(normalizedAssetId, normalizedLimit) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.parse(row.snapshot_json)));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private parse(json: string): PersistedStudioHandoffRecord {
    return JSON.parse(json) as PersistedStudioHandoffRecord;
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
        `Studio handoff repository schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, migrationSql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      db.transaction(() => {
        db.exec(migrationSql);
        db.prepare("INSERT INTO studio_handoff_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS studio_handoff_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = db.prepare("SELECT MAX(version) AS version FROM studio_handoff_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}
