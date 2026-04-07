import fs from "node:fs";
import path from "node:path";
import type {
  WorkflowOutputProvenanceQuery,
  WorkflowOutputProvenanceRecord,
  WorkflowOutputProvenanceRepository,
} from "@application/system-runtime/WorkflowOutputProvenanceRepository";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface Row { readonly record_json: string }

const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE system_runtime_workflow_output_provenance (
      provenance_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      system_id TEXT NOT NULL,
      dataset_instance_id TEXT NOT NULL,
      materialization_id TEXT NOT NULL,
      workflow_run_id TEXT NOT NULL,
      workflow_asset_id TEXT NOT NULL,
      output_asset_stable_id TEXT NOT NULL,
      output_record_id TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
    CREATE INDEX system_runtime_workflow_output_provenance_run_idx
      ON system_runtime_workflow_output_provenance(workflow_run_id, created_at ASC);
    CREATE INDEX system_runtime_workflow_output_provenance_asset_idx
      ON system_runtime_workflow_output_provenance(output_asset_stable_id, created_at ASC);
    CREATE INDEX system_runtime_workflow_output_provenance_system_idx
      ON system_runtime_workflow_output_provenance(system_id, dataset_instance_id, created_at DESC);
  `],
  [2, `
    ALTER TABLE system_runtime_workflow_output_provenance ADD COLUMN output_group_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE system_runtime_workflow_output_provenance ADD COLUMN output_index INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS system_runtime_workflow_output_provenance_group_idx
      ON system_runtime_workflow_output_provenance(workflow_run_id, output_group_id, output_index ASC);
  `],
]);

export class SqliteWorkflowOutputProvenanceRepository implements WorkflowOutputProvenanceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string, private readonly maxRecords = 100_000) {}

  public save(record: WorkflowOutputProvenanceRecord): void {
    this.getDb().prepare(`
      INSERT INTO system_runtime_workflow_output_provenance (
        provenance_id, created_at, updated_at, status, system_id, dataset_instance_id,
        materialization_id, workflow_run_id, workflow_asset_id, output_asset_stable_id,
        output_group_id, output_index, output_record_id, record_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provenance_id) DO UPDATE SET
        updated_at = excluded.updated_at,
        status = excluded.status,
        output_asset_stable_id = excluded.output_asset_stable_id,
        output_group_id = excluded.output_group_id,
        output_index = excluded.output_index,
        output_record_id = excluded.output_record_id,
        record_json = excluded.record_json
    `).run(
      record.provenanceId,
      record.createdAt,
      record.updatedAt,
      record.status,
      record.systemId,
      record.datasetInstanceId,
      record.materializationId,
      record.workflowRunId,
      record.workflowAssetId,
      record.outputAssetStableId,
      record.outputGroupId,
      record.outputIndex,
      record.outputRecordId,
      JSON.stringify(record),
    );
    this.prune();
  }

  public listByWorkflowRunId(workflowRunId: string, limit?: number): ReadonlyArray<WorkflowOutputProvenanceRecord> {
    const normalized = workflowRunId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    const limitClause = typeof limit === "number" && Number.isFinite(limit) ? `LIMIT ${Math.max(1, Math.floor(limit))}` : "";
    const rows = this.getDb().prepare(`
      SELECT record_json FROM system_runtime_workflow_output_provenance
      WHERE workflow_run_id = ?
      ORDER BY created_at ASC, provenance_id ASC
      ${limitClause}
    `).all(normalized) as Row[];
    return Object.freeze(rows.map((row) => Object.freeze(JSON.parse(row.record_json) as WorkflowOutputProvenanceRecord)));
  }

  public listByOutputAssetStableId(outputAssetStableId: string, limit?: number): ReadonlyArray<WorkflowOutputProvenanceRecord> {
    return this.query({ outputAssetStableId, limit });
  }

  public query(query: WorkflowOutputProvenanceQuery = {}): ReadonlyArray<WorkflowOutputProvenanceRecord> {
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (query.systemId?.trim()) { clauses.push("system_id = ?"); args.push(query.systemId.trim()); }
    if (query.datasetInstanceId?.trim()) { clauses.push("dataset_instance_id = ?"); args.push(query.datasetInstanceId.trim()); }
    if (query.workflowRunId?.trim()) { clauses.push("workflow_run_id = ?"); args.push(query.workflowRunId.trim()); }
    if (query.workflowAssetId?.trim()) { clauses.push("workflow_asset_id = ?"); args.push(query.workflowAssetId.trim()); }
    if (query.outputAssetStableId?.trim()) { clauses.push("output_asset_stable_id = ?"); args.push(query.outputAssetStableId.trim()); }
    if (query.outputGroupId?.trim()) { clauses.push("output_group_id = ?"); args.push(query.outputGroupId.trim()); }
    if (query.status?.trim()) { clauses.push("status = ?"); args.push(query.status.trim()); }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = typeof query.limit === "number" && Number.isFinite(query.limit) ? `LIMIT ${Math.max(1, Math.floor(query.limit))}` : "";
    const rows = this.getDb().prepare(`
      SELECT record_json FROM system_runtime_workflow_output_provenance
      ${where}
      ORDER BY created_at DESC, provenance_id DESC
      ${limit}
    `).all(...args) as Row[];
    return Object.freeze(rows.map((row) => Object.freeze(JSON.parse(row.record_json) as WorkflowOutputProvenanceRecord)));
  }

  private getDb(): SqliteCompatDatabase {
    if (this.database) return this.database;
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.database = openSqliteCompatDatabase(this.databasePath);
    this.database.pragma("journal_mode = WAL");
    if (!this.initialized) {
      this.applyMigrations(this.database);
      this.initialized = true;
    }
    return this.database;
  }

  private applyMigrations(db: SqliteCompatDatabase): void {
    db.exec("CREATE TABLE IF NOT EXISTS system_runtime_workflow_output_provenance_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    const appliedRows = db.prepare("SELECT version FROM system_runtime_workflow_output_provenance_migrations").all() as Array<{version:number}>;
    const applied = new Set(appliedRows.map((row) => row.version));
    for (const [version, sql] of MIGRATIONS) {
      if (applied.has(version)) continue;
      const tx = db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO system_runtime_workflow_output_provenance_migrations(version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
      });
      tx();
    }
  }

  private prune(): void {
    const row = this.getDb().prepare("SELECT COUNT(*) as count FROM system_runtime_workflow_output_provenance").get() as {count:number};
    const overflow = row.count - this.maxRecords;
    if (overflow <= 0) return;
    this.getDb().prepare(`
      DELETE FROM system_runtime_workflow_output_provenance
      WHERE provenance_id IN (
        SELECT provenance_id
        FROM system_runtime_workflow_output_provenance
        ORDER BY created_at DESC, provenance_id DESC
        LIMIT ?
      )
    `).run(overflow);
  }
}

