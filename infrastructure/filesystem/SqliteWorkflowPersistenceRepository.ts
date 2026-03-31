import fs from "node:fs";
import path from "node:path";
import type {
  IWorkflowPersistenceRepository,
  WorkflowPersistenceListQuery,
} from "../../application/ports/interfaces/IWorkflowPersistenceRepository";
import type {
  PersistedWorkflowRecord,
  PersistedWorkflowSummary,
} from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import {
  normalizePersistedWorkflowRecord,
  toPersistedWorkflowSummary,
} from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "./sqlite/SqliteCompat";

interface WorkflowRow {
  readonly record_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS workflow_persistence_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_persistence_records (
      workflow_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      owner_id TEXT,
      studio_id TEXT,
      updated_at TEXT NOT NULL,
      search_text TEXT NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS workflow_persistence_status_updated_idx
      ON workflow_persistence_records(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS workflow_persistence_owner_updated_idx
      ON workflow_persistence_records(owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS workflow_persistence_studio_updated_idx
      ON workflow_persistence_records(studio_id, updated_at DESC);
  `],
]);

export class SqliteWorkflowPersistenceRepository implements IWorkflowPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async create(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    const normalized = this.normalizeRecord(record);
    const result = this.getDatabase()
      .prepare(`
        INSERT INTO workflow_persistence_records (
          workflow_id,
          status,
          owner_id,
          studio_id,
          updated_at,
          search_text,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        normalized.id,
        normalized.status,
        normalized.ownershipContext?.ownerId ?? null,
        normalized.ownershipContext?.studioId ?? null,
        normalized.timestamps.updatedAt,
        this.buildSearchText(normalized),
        JSON.stringify(normalized),
      );

    if (result.changes < 1) {
      throw new Error(`Persisted workflow '${normalized.id}' was not created.`);
    }

    return normalized;
  }

  public async update(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    const normalized = this.normalizeRecord(record);
    const result = this.getDatabase()
      .prepare(`
        UPDATE workflow_persistence_records
        SET status = ?,
            owner_id = ?,
            studio_id = ?,
            updated_at = ?,
            search_text = ?,
            record_json = ?
        WHERE workflow_id = ?
      `)
      .run(
        normalized.status,
        normalized.ownershipContext?.ownerId ?? null,
        normalized.ownershipContext?.studioId ?? null,
        normalized.timestamps.updatedAt,
        this.buildSearchText(normalized),
        JSON.stringify(normalized),
        normalized.id,
      );

    if (result.changes < 1) {
      throw new Error(`Persisted workflow '${normalized.id}' does not exist.`);
    }

    return normalized;
  }

  public async getById(id: string): Promise<PersistedWorkflowRecord | undefined> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT record_json FROM workflow_persistence_records WHERE workflow_id = ?")
      .get(normalizedId) as WorkflowRow | undefined;
    return row ? this.parseRecord(row.record_json) : undefined;
  }

  public async list(query?: WorkflowPersistenceListQuery): Promise<ReadonlyArray<PersistedWorkflowSummary>> {
    const normalizedSearchText = query?.searchText?.trim().toLowerCase();
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (query?.status) {
      whereClauses.push("status = ?");
      params.push(query.status);
    }
    if (query?.ownerId?.trim()) {
      whereClauses.push("owner_id = ?");
      params.push(query.ownerId.trim());
    }
    if (query?.studioId?.trim()) {
      whereClauses.push("studio_id = ?");
      params.push(query.studioId.trim());
    }
    if (normalizedSearchText) {
      whereClauses.push("search_text LIKE ?");
      params.push(`%${normalizedSearchText}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const hasValidLimit = Number.isInteger(query?.limit) && (query?.limit ?? 0) > 0;
    const limitSql = hasValidLimit ? "LIMIT ?" : "";
    if (hasValidLimit) {
      params.push(query!.limit);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM workflow_persistence_records
        ${whereSql}
        ORDER BY updated_at DESC
        ${limitSql}
      `)
      .all(...params) as WorkflowRow[];

    return Object.freeze(
      rows.map((row) => toPersistedWorkflowSummary(this.parseRecord(row.record_json))),
    );
  }

  public async duplicate(
    sourceWorkflowId: string,
    duplicateRecord: PersistedWorkflowRecord,
  ): Promise<PersistedWorkflowRecord> {
    const sourceId = sourceWorkflowId.trim();
    if (!sourceId) {
      throw new Error("Source workflow id is required.");
    }

    const source = await this.getById(sourceId);
    if (!source) {
      throw new Error(`Persisted workflow '${sourceId}' does not exist.`);
    }

    return this.create(duplicateRecord);
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
        `Workflow persistence repository schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }
      db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO workflow_persistence_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_persistence_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT MAX(version) AS version FROM workflow_persistence_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private normalizeRecord(record: PersistedWorkflowRecord): PersistedWorkflowRecord {
    return normalizePersistedWorkflowRecord(record);
  }

  private parseRecord(serialized: string): PersistedWorkflowRecord {
    try {
      const parsed = JSON.parse(serialized) as PersistedWorkflowRecord;
      return this.normalizeRecord(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw new Error(`Persisted workflow record could not be parsed: ${message}`);
    }
  }

  private buildSearchText(record: PersistedWorkflowRecord): string {
    return `${record.name} ${record.metadata.tags.join(" ")}`.trim().toLowerCase();
  }
}
