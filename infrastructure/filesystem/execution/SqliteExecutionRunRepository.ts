import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "../../../application/ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunProvenance, IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import { freezeExecutionRunRecord } from "../../../application/execution/freezeExecutionRunRecord";

interface ExecutionRunRow {
  readonly run_json: string;
}

const EXECUTION_RUN_SCHEMA_VERSION = 2;

const EXECUTION_RUN_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE execution_runs (
      run_id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      execution_kind TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      cancellation_supported INTEGER NOT NULL,
      final_error_message TEXT,
      primary_classification TEXT,
      primary_executor_id TEXT,
      primary_runtime TEXT,
      primary_source_kind TEXT,
      metadata_json TEXT NOT NULL,
      units_json TEXT NOT NULL,
      transitions_json TEXT NOT NULL,
      terminal_summary_json TEXT,
      diagnostics_summary_json TEXT,
      run_json TEXT NOT NULL
    );
    CREATE INDEX execution_runs_plan_idx ON execution_runs(plan_id, started_at DESC);
    CREATE INDEX execution_runs_status_idx ON execution_runs(status, started_at DESC);
    CREATE INDEX execution_runs_kind_idx ON execution_runs(execution_kind, started_at DESC);
    CREATE INDEX execution_runs_updated_idx ON execution_runs(updated_at DESC);
    CREATE TABLE execution_run_metadata (
      run_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value_text TEXT,
      value_number REAL,
      value_boolean INTEGER,
      PRIMARY KEY (run_id, key),
      FOREIGN KEY (run_id) REFERENCES execution_runs(run_id) ON DELETE CASCADE
    );
    CREATE INDEX execution_run_metadata_lookup_idx ON execution_run_metadata(key, value_text, value_number, value_boolean);
  `],
  [2, `
    ALTER TABLE execution_runs ADD COLUMN terminal_headline TEXT;
    ALTER TABLE execution_runs ADD COLUMN terminal_detail TEXT;
    ALTER TABLE execution_runs ADD COLUMN diagnostics_headline TEXT;
    ALTER TABLE execution_runs ADD COLUMN diagnostics_detail TEXT;
    CREATE INDEX IF NOT EXISTS execution_runs_detail_idx ON execution_runs(execution_kind, status, updated_at DESC);
  `],
]);

export class SqliteExecutionRunRepository implements IExecutionRunRepository {
  private database?: Database.Database;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord> {
    const db = this.getDatabase();
    const metadataRows = toMetadataRows(run);
    const primaryProvenance = extractPrimaryProvenance(run);
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO execution_runs (
          run_id,
          plan_id,
          status,
          execution_kind,
          started_at,
          updated_at,
          completed_at,
          cancellation_supported,
          final_error_message,
          primary_classification,
          primary_executor_id,
          primary_runtime,
          primary_source_kind,
          metadata_json,
          units_json,
          transitions_json,
          terminal_summary_json,
          diagnostics_summary_json,
          terminal_headline,
          terminal_detail,
          diagnostics_headline,
          diagnostics_detail,
          run_json
        ) VALUES (
          @runId,
          @planId,
          @status,
          @executionKind,
          @startedAt,
          @updatedAt,
          @completedAt,
          @cancellationSupported,
          @finalErrorMessage,
          @primaryClassification,
          @primaryExecutorId,
          @primaryRuntime,
          @primarySourceKind,
          @metadataJson,
          @unitsJson,
          @transitionsJson,
          @terminalSummaryJson,
          @diagnosticsSummaryJson,
          @terminalHeadline,
          @terminalDetail,
          @diagnosticsHeadline,
          @diagnosticsDetail,
          @runJson
        )
        ON CONFLICT(run_id) DO UPDATE SET
          plan_id = excluded.plan_id,
          status = excluded.status,
          execution_kind = excluded.execution_kind,
          started_at = excluded.started_at,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          cancellation_supported = excluded.cancellation_supported,
          final_error_message = excluded.final_error_message,
          primary_classification = excluded.primary_classification,
          primary_executor_id = excluded.primary_executor_id,
          primary_runtime = excluded.primary_runtime,
          primary_source_kind = excluded.primary_source_kind,
          metadata_json = excluded.metadata_json,
          units_json = excluded.units_json,
          transitions_json = excluded.transitions_json,
          terminal_summary_json = excluded.terminal_summary_json,
          diagnostics_summary_json = excluded.diagnostics_summary_json,
          terminal_headline = excluded.terminal_headline,
          terminal_detail = excluded.terminal_detail,
          diagnostics_headline = excluded.diagnostics_headline,
          diagnostics_detail = excluded.diagnostics_detail,
          run_json = excluded.run_json
      `).run({
        runId: run.runId,
        planId: run.planId,
        status: run.status,
        executionKind: typeof run.metadata?.executionKind === "string" ? run.metadata.executionKind : undefined,
        startedAt: run.startedAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        cancellationSupported: run.cancellationSupported ? 1 : 0,
        finalErrorMessage: run.finalErrorMessage,
        primaryClassification: primaryProvenance?.classification,
        primaryExecutorId: primaryProvenance?.executorId,
        primaryRuntime: primaryProvenance?.runtime,
        primarySourceKind: primaryProvenance?.sourceKind,
        metadataJson: JSON.stringify(run.metadata ?? {}),
        unitsJson: JSON.stringify(run.units),
        transitionsJson: JSON.stringify(run.transitions),
        terminalSummaryJson: run.terminalSummary ? JSON.stringify(run.terminalSummary) : null,
        diagnosticsSummaryJson: run.diagnosticsSummary ? JSON.stringify(run.diagnosticsSummary) : null,
        terminalHeadline: run.terminalSummary?.headline ?? null,
        terminalDetail: run.terminalSummary?.detail ?? null,
        diagnosticsHeadline: run.diagnosticsSummary?.headline ?? null,
        diagnosticsDetail: run.diagnosticsSummary?.detail ?? null,
        runJson: JSON.stringify(run),
      });

      db.prepare("DELETE FROM execution_run_metadata WHERE run_id = ?").run(run.runId);
      const insertMetadata = db.prepare(`
        INSERT INTO execution_run_metadata (run_id, key, value_text, value_number, value_boolean)
        VALUES (@runId, @key, @valueText, @valueNumber, @valueBoolean)
      `);
      for (const row of metadataRows) {
        insertMetadata.run(row);
      }
    });

    transaction();
    return run;
  }

  public async getRunById(runId: string): Promise<IExecutionRunRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT run_json FROM execution_runs WHERE run_id = ?")
      .get(normalizedRunId) as ExecutionRunRow | undefined;

    return row ? parseRun(row.run_json) : undefined;
  }

  public async listRuns(criteria: IExecutionRunRepositoryListCriteria = {}): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (criteria.planId) {
      clauses.push("plan_id = @planId");
      params.planId = criteria.planId;
    }
    if (criteria.status) {
      clauses.push("status = @status");
      params.status = criteria.status;
    }
    if (criteria.executionKind) {
      clauses.push("execution_kind = @executionKind");
      params.executionKind = criteria.executionKind;
    }

    let metadataIndex = 0;
    for (const [key, value] of Object.entries(criteria.metadata ?? {})) {
      metadataIndex += 1;
      const keyParam = `metadataKey${metadataIndex}`;
      const valueTextParam = `metadataText${metadataIndex}`;
      const valueNumberParam = `metadataNumber${metadataIndex}`;
      const valueBooleanParam = `metadataBoolean${metadataIndex}`;
      clauses.push(`EXISTS (
        SELECT 1 FROM execution_run_metadata erm
        WHERE erm.run_id = execution_runs.run_id
          AND erm.key = @${keyParam}
          AND (
            erm.value_text = @${valueTextParam}
            OR erm.value_number = @${valueNumberParam}
            OR erm.value_boolean = @${valueBooleanParam}
          )
      )`);
      params[keyParam] = key;
      params[valueTextParam] = typeof value === "string" ? value : null;
      params[valueNumberParam] = typeof value === "number" ? value : null;
      params[valueBooleanParam] = typeof value === "boolean" ? (value ? 1 : 0) : null;
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limitClause = typeof criteria.limit === "number" ? "LIMIT @limit" : "";
    if (typeof criteria.limit === "number") {
      params.limit = criteria.limit;
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT run_json
        FROM execution_runs
        ${whereClause}
        ORDER BY started_at DESC, updated_at DESC
        ${limitClause}
      `)
      .all(params) as ExecutionRunRow[];

    return Object.freeze(rows.map((row) => parseRun(row.run_json)));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private getDatabase(): Database.Database {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = new Database(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }

    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }

    return this.database;
  }

  private initialize(db: Database.Database): void {
    const currentVersion = Number(db.pragma("user_version", { simple: true }) ?? 0);
    const hasLegacySchema = this.hasLegacySchema(db);
    const effectiveCurrentVersion = currentVersion === 0 && hasLegacySchema ? 1 : currentVersion;

    if (effectiveCurrentVersion > EXECUTION_RUN_SCHEMA_VERSION) {
      throw new Error(
        `Execution run database schema version ${effectiveCurrentVersion} is newer than this application supports (${EXECUTION_RUN_SCHEMA_VERSION}).`,
      );
    }

    for (const [version, migrationSql] of EXECUTION_RUN_MIGRATIONS) {
      if (version <= effectiveCurrentVersion) {
        continue;
      }

      db.transaction(() => {
        db.exec(migrationSql);
        db.pragma(`user_version = ${version}`);
      })();
    }

    if (effectiveCurrentVersion === 1 && currentVersion === 0) {
      db.pragma(`user_version = ${effectiveCurrentVersion}`);
    }
  }

  private hasLegacySchema(db: Database.Database): boolean {
    const rows = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name IN ('execution_runs', 'execution_run_metadata')
    `).all() as ReadonlyArray<{ readonly name: string }>;

    return rows.some((row) => row.name === "execution_runs");
  }
}

function parseRun(runJson: string): IExecutionRunRecord {
  return freezeExecutionRunRecord(JSON.parse(runJson) as IExecutionRunRecord);
}

function extractPrimaryProvenance(run: IExecutionRunRecord): IExecutionRunProvenance | undefined {
  return run.unitIds
    .map((unitId) => run.units[unitId]?.provenance)
    .find((provenance): provenance is IExecutionRunProvenance => Boolean(provenance));
}

function toMetadataRows(run: IExecutionRunRecord): ReadonlyArray<{
  readonly runId: string;
  readonly key: string;
  readonly valueText: string | null;
  readonly valueNumber: number | null;
  readonly valueBoolean: number | null;
}> {
  return Object.entries(run.metadata ?? {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => ({
      runId: run.runId,
      key,
      valueText: typeof value === "string" ? value : null,
      valueNumber: typeof value === "number" ? value : null,
      valueBoolean: typeof value === "boolean" ? (value ? 1 : 0) : null,
    }));
}
