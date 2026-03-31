import fs from "node:fs";
import path from "node:path";
import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import { normalizeWorkflowRunSummaryRecord } from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "./sqlite/SqliteCompat";

interface WorkflowRunSummaryRow {
  readonly record_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS workflow_run_summary_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_run_summaries (
      run_id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      status TEXT NOT NULL,
      trigger_source TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      updated_at TEXT NOT NULL,
      execution_run_id TEXT NOT NULL,
      workflow_execution_id TEXT,
      execution_flow_id TEXT,
      search_text TEXT NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS workflow_run_summary_started_idx
      ON workflow_run_summaries(started_at DESC);
    CREATE INDEX IF NOT EXISTS workflow_run_summary_workflow_started_idx
      ON workflow_run_summaries(workflow_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS workflow_run_summary_status_started_idx
      ON workflow_run_summaries(status, started_at DESC);
    CREATE INDEX IF NOT EXISTS workflow_run_summary_trigger_started_idx
      ON workflow_run_summaries(trigger_source, started_at DESC);
  `],
]);

export class SqliteWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);

    const result = this.getDatabase()
      .prepare(`
        INSERT INTO workflow_run_summaries (
          run_id,
          workflow_id,
          workflow_name,
          status,
          trigger_source,
          started_at,
          ended_at,
          updated_at,
          execution_run_id,
          workflow_execution_id,
          execution_flow_id,
          search_text,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          workflow_id = excluded.workflow_id,
          workflow_name = excluded.workflow_name,
          status = excluded.status,
          trigger_source = excluded.trigger_source,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          updated_at = excluded.updated_at,
          execution_run_id = excluded.execution_run_id,
          workflow_execution_id = excluded.workflow_execution_id,
          execution_flow_id = excluded.execution_flow_id,
          search_text = excluded.search_text,
          record_json = excluded.record_json
      `)
      .run(
        normalized.runId,
        normalized.workflow.workflowId,
        normalized.workflow.workflowName,
        normalized.status,
        normalized.triggerSource,
        normalized.timestamps.startedAt,
        normalized.timestamps.endedAt ?? null,
        normalized.timestamps.updatedAt,
        normalized.correlation.executionRunId,
        normalized.correlation.workflowExecutionId ?? null,
        normalized.correlation.executionFlowId ?? null,
        this.buildSearchText(normalized),
        JSON.stringify(normalized),
      );

    if (result.changes < 1) {
      throw new Error(`Workflow run summary '${normalized.runId}' was not persisted.`);
    }

    return normalized;
  }

  public async getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT record_json FROM workflow_run_summaries WHERE run_id = ?")
      .get(normalizedRunId) as WorkflowRunSummaryRow | undefined;

    return row ? this.parseRecord(row.record_json) : undefined;
  }

  public async list(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (query?.workflowId?.trim()) {
      whereClauses.push("workflow_id = ?");
      params.push(query.workflowId.trim());
    }
    if (query?.status) {
      whereClauses.push("status = ?");
      params.push(query.status);
    }
    if (query?.triggerSource) {
      whereClauses.push("trigger_source = ?");
      params.push(query.triggerSource);
    }
    if (query?.startedAfter?.trim()) {
      whereClauses.push("started_at >= ?");
      params.push(query.startedAfter.trim());
    }
    if (query?.startedBefore?.trim()) {
      whereClauses.push("started_at <= ?");
      params.push(query.startedBefore.trim());
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
        FROM workflow_run_summaries
        ${whereSql}
        ORDER BY started_at DESC, updated_at DESC
        ${limitSql}
      `)
      .all(...params) as WorkflowRunSummaryRow[];

    return Object.freeze(rows.map((row) => this.parseRecord(row.record_json)));
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
        `Workflow run summary schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO workflow_run_summary_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_run_summary_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = db.prepare("SELECT MAX(version) AS version FROM workflow_run_summary_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private parseRecord(serialized: string): WorkflowRunSummaryRecord {
    try {
      return normalizeWorkflowRunSummaryRecord(JSON.parse(serialized) as WorkflowRunSummaryRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw new Error(`Workflow run summary record could not be parsed: ${message}`);
    }
  }

  private buildSearchText(record: WorkflowRunSummaryRecord): string {
    return `${record.workflow.workflowName} ${record.workflow.workflowId}`.trim().toLowerCase();
  }
}
