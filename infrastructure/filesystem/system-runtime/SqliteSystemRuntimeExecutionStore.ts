import fs from "node:fs";
import path from "node:path";
import type {
  ISystemRuntimeExecutionStore,
  PersistedExecutionRecord,
} from "../../../application/system-runtime/SystemRuntimeExecutionStore";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface ExecutionRecordRow {
  readonly record_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE system_runtime_executions (
      execution_id TEXT PRIMARY KEY,
      root_asset_id TEXT NOT NULL,
      root_version_id TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      parent_execution_id TEXT,
      parent_node_id TEXT,
      record_json TEXT NOT NULL
    );
    CREATE INDEX system_runtime_executions_root_idx
      ON system_runtime_executions(root_asset_id, root_version_id, started_at DESC);
    CREATE INDEX system_runtime_executions_parent_idx
      ON system_runtime_executions(parent_execution_id, started_at DESC);
  `],
]);

export class SqliteSystemRuntimeExecutionStore implements ISystemRuntimeExecutionStore {
  private database?: SqliteCompatDatabase;
  private initialized = false;
  private readonly maxRecords: number;

  public constructor(private readonly databasePath: string, maxRecords = 10000) {
    this.maxRecords = Number.isFinite(maxRecords) && maxRecords > 0 ? Math.floor(maxRecords) : 10000;
  }

  public saveExecutionRecord(record: PersistedExecutionRecord): void {
    this.getDatabase()
      .prepare(`
        INSERT INTO system_runtime_executions (
          execution_id,
          root_asset_id,
          root_version_id,
          status,
          started_at,
          updated_at,
          completed_at,
          parent_execution_id,
          parent_node_id,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(execution_id) DO UPDATE SET
          root_asset_id = excluded.root_asset_id,
          root_version_id = excluded.root_version_id,
          status = excluded.status,
          started_at = excluded.started_at,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          parent_execution_id = excluded.parent_execution_id,
          parent_node_id = excluded.parent_node_id,
          record_json = excluded.record_json
      `)
      .run(
        record.executionId,
        record.execution.root.assetId,
        record.execution.root.versionId ?? null,
        record.execution.status,
        record.execution.startedAt,
        record.execution.updatedAt,
        record.execution.completedAt ?? null,
        record.metadata.parentExecutionId ?? null,
        record.metadata.parentNodeId ?? null,
        JSON.stringify(record),
      );
    this.pruneToCapacity();
  }

  public getExecutionRecord(executionId: string): PersistedExecutionRecord | undefined {
    const normalized = executionId.trim();
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT record_json FROM system_runtime_executions WHERE execution_id = ?")
      .get(normalized) as ExecutionRecordRow | undefined;

    return row ? parseRecord(row.record_json) : undefined;
  }

  public listExecutionRecordsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): ReadonlyArray<PersistedExecutionRecord> {
    const assetId = input.assetId.trim();
    if (!assetId) {
      return Object.freeze([]);
    }

    const clauses = ["root_asset_id = ?"];
    const params: unknown[] = [assetId];

    if (input.versionId?.trim()) {
      clauses.push("root_version_id = ?");
      params.push(input.versionId.trim());
    }

    const limit = typeof input.limit === "number" && input.limit > 0
      ? Math.floor(input.limit)
      : undefined;
    const sql = `
      SELECT record_json
      FROM system_runtime_executions
      WHERE ${clauses.join(" AND ")}
      ORDER BY started_at DESC
      ${limit ? `LIMIT ${limit}` : ""}
    `;

    const rows = this.getDatabase().prepare(sql).all(...params) as ExecutionRecordRow[];
    return Object.freeze(rows.map((row) => parseRecord(row.record_json)));
  }

  private getDatabase(): SqliteCompatDatabase {
    if (this.database) {
      return this.database;
    }

    const directory = path.dirname(this.databasePath);
    fs.mkdirSync(directory, { recursive: true });
    this.database = openSqliteCompatDatabase(this.databasePath);
    this.database.pragma("journal_mode = WAL");

    if (!this.initialized) {
      this.applyMigrations(this.database);
      this.initialized = true;
    }

    return this.database;
  }

  private applyMigrations(db: SqliteCompatDatabase): void {
    db.exec("CREATE TABLE IF NOT EXISTS system_runtime_execution_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    const appliedRows = db
      .prepare("SELECT version FROM system_runtime_execution_migrations ORDER BY version ASC")
      .all() as ReadonlyArray<{ readonly version: number }>;
    const applied = new Set(appliedRows.map((row) => row.version));

    for (const [version, sql] of MIGRATIONS) {
      if (applied.has(version)) {
        continue;
      }
      const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO system_runtime_execution_migrations(version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      });
      transaction();
    }

    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  private pruneToCapacity(): void {
    const overflowRow = this.getDatabase()
      .prepare("SELECT COUNT(*) as count FROM system_runtime_executions")
      .get() as { readonly count: number };
    const overflow = overflowRow.count - this.maxRecords;
    if (overflow <= 0) {
      return;
    }

    this.getDatabase().prepare(`
      DELETE FROM system_runtime_executions
      WHERE execution_id IN (
        SELECT execution_id
        FROM system_runtime_executions
        ORDER BY started_at ASC, execution_id ASC
        LIMIT ?
      )
    `).run(overflow);
  }
}

function parseRecord(raw: string): PersistedExecutionRecord {
  return Object.freeze(JSON.parse(raw) as PersistedExecutionRecord);
}
