import fs from "node:fs";
import path from "node:path";
import type { StudioHandoffAuditRepository } from "../../../application/studio-handoff/StudioHandoffAuditTrailService";
import type { StudioHandoffAuditRecord } from "../../../src/domain/studio-handoff/StudioHandoffAuditTrail";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface SnapshotRow {
  readonly snapshot_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS studio_handoff_audit_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS studio_handoff_audit_records (
      audit_id TEXT PRIMARY KEY,
      handoff_id TEXT NOT NULL,
      event_kind TEXT NOT NULL,
      outcome TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      source_studio_id TEXT NOT NULL,
      target_studio_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS studio_handoff_audit_handoff_idx
      ON studio_handoff_audit_records(handoff_id, occurred_at DESC, audit_id DESC);
    CREATE INDEX IF NOT EXISTS studio_handoff_audit_recent_idx
      ON studio_handoff_audit_records(occurred_at DESC, audit_id DESC);
  `],
]);

export class SqliteStudioHandoffAuditRepository implements StudioHandoffAuditRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public save(record: StudioHandoffAuditRecord): StudioHandoffAuditRecord {
    this.getDatabase()
      .prepare(`
        INSERT INTO studio_handoff_audit_records (
          audit_id,
          handoff_id,
          event_kind,
          outcome,
          occurred_at,
          source_studio_id,
          target_studio_id,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(audit_id) DO UPDATE SET
          handoff_id = excluded.handoff_id,
          event_kind = excluded.event_kind,
          outcome = excluded.outcome,
          occurred_at = excluded.occurred_at,
          source_studio_id = excluded.source_studio_id,
          target_studio_id = excluded.target_studio_id,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        record.auditId,
        record.handoff.handoffId,
        record.eventKind,
        record.outcome,
        record.occurredAt,
        record.sourceStudio.studioId,
        record.targetStudio.studioId,
        JSON.stringify(record),
      );

    return record;
  }

  public listRecent(limit = 100): ReadonlyArray<StudioHandoffAuditRecord> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT snapshot_json
        FROM studio_handoff_audit_records
        ORDER BY occurred_at DESC, audit_id DESC
        LIMIT ?
      `)
      .all(Math.max(0, limit)) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.parse(row.snapshot_json)));
  }

  public listByHandoffId(handoffId: string, limit = 100): ReadonlyArray<StudioHandoffAuditRecord> {
    const normalized = handoffId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT snapshot_json
        FROM studio_handoff_audit_records
        WHERE handoff_id = ?
        ORDER BY occurred_at DESC, audit_id DESC
        LIMIT ?
      `)
      .all(normalized, Math.max(0, limit)) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.parse(row.snapshot_json)));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private parse(json: string): StudioHandoffAuditRecord {
    return JSON.parse(json) as StudioHandoffAuditRecord;
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
        `Studio handoff audit schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, migrationSql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      db.transaction(() => {
        db.exec(migrationSql);
        db.prepare("INSERT INTO studio_handoff_audit_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS studio_handoff_audit_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = db.prepare("SELECT MAX(version) AS version FROM studio_handoff_audit_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}
