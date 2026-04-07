import fs from "node:fs";
import path from "node:path";
import type { ExecutionAuditRepository } from "@application/system-runtime/ExecutionAuditRepository";
import type { ExecutionAuditRecord } from "@domain/system-runtime/ExecutionAuditTrailDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface AuditRecordRow {
  readonly record_json: string;
}

const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE system_runtime_execution_audit (
      audit_id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      event_kind TEXT NOT NULL,
      request_source TEXT NOT NULL,
      tenant_id TEXT,
      caller_id TEXT,
      session_id TEXT,
      system_id TEXT,
      version_id TEXT,
      record_json TEXT NOT NULL
    );
    CREATE INDEX system_runtime_execution_audit_execution_idx
      ON system_runtime_execution_audit(execution_id, occurred_at ASC, audit_id ASC);
    CREATE INDEX system_runtime_execution_audit_recent_idx
      ON system_runtime_execution_audit(occurred_at DESC, audit_id DESC);
    CREATE INDEX system_runtime_execution_audit_tenant_idx
      ON system_runtime_execution_audit(tenant_id, occurred_at DESC);
  `],
]);

export class SqliteExecutionAuditRepository implements ExecutionAuditRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string, private readonly maxRecords = 100_000) {}

  public save(record: ExecutionAuditRecord): void {
    this.getDatabase()
      .prepare(`
        INSERT INTO system_runtime_execution_audit (
          audit_id,
          execution_id,
          occurred_at,
          event_kind,
          request_source,
          tenant_id,
          caller_id,
          session_id,
          system_id,
          version_id,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(audit_id) DO UPDATE SET
          execution_id = excluded.execution_id,
          occurred_at = excluded.occurred_at,
          event_kind = excluded.event_kind,
          request_source = excluded.request_source,
          tenant_id = excluded.tenant_id,
          caller_id = excluded.caller_id,
          session_id = excluded.session_id,
          system_id = excluded.system_id,
          version_id = excluded.version_id,
          record_json = excluded.record_json
      `)
      .run(
        record.auditId,
        record.execution.executionId,
        record.occurredAt,
        record.eventKind,
        record.requestSource,
        record.tenant.tenantId ?? null,
        record.caller.callerId ?? null,
        record.execution.sessionId ?? null,
        record.execution.systemId ?? null,
        record.execution.versionId ?? null,
        JSON.stringify(record),
      );
    this.pruneToCapacity();
  }

  public listByExecutionId(executionId: string, limit?: number): ReadonlyArray<ExecutionAuditRecord> {
    const normalized = executionId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    const sql = `
      SELECT record_json
      FROM system_runtime_execution_audit
      WHERE execution_id = ?
      ORDER BY occurred_at ASC, audit_id ASC
      ${typeof limit === "number" && limit > 0 ? `LIMIT ${Math.floor(limit)}` : ""}
    `;
    const rows = this.getDatabase().prepare(sql).all(normalized) as AuditRecordRow[];
    return Object.freeze(rows.map((row) => parseRecord(row.record_json)));
  }

  public listRecent(limit?: number): ReadonlyArray<ExecutionAuditRecord> {
    const sql = `
      SELECT record_json
      FROM system_runtime_execution_audit
      ORDER BY occurred_at DESC, audit_id DESC
      ${typeof limit === "number" && limit > 0 ? `LIMIT ${Math.floor(limit)}` : ""}
    `;
    const rows = this.getDatabase().prepare(sql).all() as AuditRecordRow[];
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
    db.exec("CREATE TABLE IF NOT EXISTS system_runtime_execution_audit_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    const appliedRows = db.prepare("SELECT version FROM system_runtime_execution_audit_migrations ORDER BY version ASC").all() as ReadonlyArray<{ readonly version: number }>;
    const applied = new Set(appliedRows.map((row) => row.version));

    for (const [version, sql] of MIGRATIONS) {
      if (applied.has(version)) {
        continue;
      }
      const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO system_runtime_execution_audit_migrations(version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      });
      transaction();
    }
  }

  private pruneToCapacity(): void {
    const overflowRow = this.getDatabase().prepare("SELECT COUNT(*) as count FROM system_runtime_execution_audit").get() as { readonly count: number };
    const overflow = overflowRow.count - this.maxRecords;
    if (overflow <= 0) {
      return;
    }

    this.getDatabase().prepare(`
      DELETE FROM system_runtime_execution_audit
      WHERE audit_id IN (
        SELECT audit_id
        FROM system_runtime_execution_audit
        ORDER BY occurred_at ASC, audit_id ASC
        LIMIT ?
      )
    `).run(overflow);
  }
}

function parseRecord(raw: string): ExecutionAuditRecord {
  return Object.freeze(JSON.parse(raw) as ExecutionAuditRecord);
}

