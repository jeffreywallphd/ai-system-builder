import fs from "node:fs";
import path from "node:path";
import type {
  ImageRunHistoryRepository,
  ListImageRunHistoryRecordsQuery,
  ListImageRunHistoryRecordsResult,
} from "@application/system-runtime/ImageRunHistoryRepository";
import {
  validateImageRunHistoryRecord,
  type ImageRunHistoryRecord,
} from "@application/system-runtime/ImageRunHistoryDataContract";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface RunHistoryRow {
  readonly record_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS system_image_run_history_records (
      system_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      workflow_asset_id TEXT NOT NULL,
      execution_status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY(system_id, run_id)
    );
    CREATE INDEX IF NOT EXISTS system_image_run_history_system_idx
      ON system_image_run_history_records(system_id, updated_at DESC, run_id DESC);
    CREATE INDEX IF NOT EXISTS system_image_run_history_workflow_idx
      ON system_image_run_history_records(system_id, workflow_asset_id, updated_at DESC, run_id DESC);
  `],
]);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class SqliteImageRunHistoryRepository implements ImageRunHistoryRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public save(record: ImageRunHistoryRecord): ImageRunHistoryRecord {
    this.getDatabase()
      .prepare(`
        INSERT INTO system_image_run_history_records (
          system_id,
          run_id,
          workflow_asset_id,
          execution_status,
          updated_at,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(system_id, run_id) DO UPDATE SET
          workflow_asset_id = excluded.workflow_asset_id,
          execution_status = excluded.execution_status,
          updated_at = excluded.updated_at,
          record_json = excluded.record_json
      `)
      .run(
        record.system.systemId,
        record.runId,
        record.workflow.workflowAssetId,
        record.status,
        record.timestamps.updatedAt,
        JSON.stringify(record),
      );

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

    const row = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM system_image_run_history_records
        WHERE system_id = ? AND run_id = ?
      `)
      .get(systemId, runId) as RunHistoryRow | undefined;

    return row ? this.parse(row.record_json) : undefined;
  }

  public list(query: ListImageRunHistoryRecordsQuery): ListImageRunHistoryRecordsResult {
    const where: string[] = ["system_id = ?"];
    const values: unknown[] = [query.systemId];
    if (query.workflowAssetId) {
      where.push("workflow_asset_id = ?");
      values.push(query.workflowAssetId);
    }
    if (query.status) {
      where.push("execution_status = ?");
      values.push(query.status);
    }

    const whereClause = where.join(" AND ");
    const rows = this.getDatabase()
      .prepare(`
        SELECT record_json
        FROM system_image_run_history_records
        WHERE ${whereClause}
        ORDER BY updated_at DESC, run_id DESC
        LIMIT ? OFFSET ?
      `)
      .all(...values, query.limit, query.offset) as RunHistoryRow[];

    const countRow = this.getDatabase()
      .prepare(`
        SELECT COUNT(*) as total_count
        FROM system_image_run_history_records
        WHERE ${whereClause}
      `)
      .get(...values) as { total_count: number };

    return Object.freeze({
      records: Object.freeze(rows.map((row) => this.parse(row.record_json))),
      totalCount: Number(countRow.total_count ?? 0),
    });
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
    }
    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }
    return this.database;
  }

  private initialize(database: SqliteCompatDatabase): void {
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");

    const currentVersion = Number((database.pragma("user_version", { simple: true }) as number) || 0);
    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(`Unsupported image-run-history schema version ${currentVersion}.`);
    }

    for (const [version, migrationSql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }
      database.exec("BEGIN");
      try {
        database.exec(migrationSql);
        database.pragma(`user_version = ${version}`);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  }

  private parse(serialized: string): ImageRunHistoryRecord {
    return validateImageRunHistoryRecord(JSON.parse(serialized) as unknown);
  }
}

