import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { IWorkflowRecordSummary } from "@application/ports/interfaces/IWorkflowRepository";
import type { WorkflowRecord } from "../workflows/WorkflowPersistenceCodec";
import { WorkflowPersistenceCodec } from "../workflows/WorkflowPersistenceCodec";

type DatabaseModule = {
  new (path: string): DatabaseConnection;
};

interface DatabaseConnection {
  pragma(value: string): void;
  exec(sql: string): void;
  prepare(sql: string): {
    run(params?: Record<string, unknown> | string): void;
    get(param?: string): Record<string, unknown> | undefined;
    all(): Array<Record<string, unknown>>;
  };
  close(): void;
}

export interface SqliteWorkflowIndexRow {
  readonly id: string;
  readonly name: string;
  readonly summaryJson: string;
  readonly updatedAt?: string;
}

export class SqliteWorkflowIndexDatabase {
  private readonly codec = new WorkflowPersistenceCodec();
  private readonly require = createRequire(import.meta.url);
  private database?: DatabaseConnection;

  constructor(private readonly databasePath: string) {}

  public initialize(): void {
    const db = this.getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_index (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        is_enabled INTEGER NOT NULL,
        updated_at TEXT,
        source_path TEXT NOT NULL,
        summary_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workflow_index_name_idx ON workflow_index(name);
      CREATE INDEX IF NOT EXISTS workflow_index_updated_at_idx ON workflow_index(updated_at DESC);
    `);
  }

  public upsert(record: WorkflowRecord, sourcePath: string): void {
    this.initialize();
    const summary = this.codec.toSummary(record, "filesystem+sqlite-index");
    this.getDatabase()
      .prepare(`
        INSERT INTO workflow_index (id, name, status, is_enabled, updated_at, source_path, summary_json)
        VALUES (@id, @name, @status, @isEnabled, @updatedAt, @sourcePath, @summaryJson)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          status = excluded.status,
          is_enabled = excluded.is_enabled,
          updated_at = excluded.updated_at,
          source_path = excluded.source_path,
          summary_json = excluded.summary_json
      `)
      .run({
        id: summary.id,
        name: summary.metadata.name,
        status: summary.status,
        isEnabled: summary.isEnabled ? 1 : 0,
        updatedAt: summary.updatedAt?.toISOString(),
        sourcePath,
        summaryJson: JSON.stringify(summary),
      });
  }

  public delete(id: string): void {
    this.initialize();
    this.getDatabase().prepare("DELETE FROM workflow_index WHERE id = ?").run(id.trim());
  }

  public exists(id: string): boolean {
    this.initialize();
    const row = this.getDatabase().prepare("SELECT id FROM workflow_index WHERE id = ?").get(id.trim()) as { id: string } | undefined;
    return !!row;
  }

  public list(): ReadonlyArray<IWorkflowRecordSummary> {
    this.initialize();
    const rows = this.getDatabase()
      .prepare("SELECT summary_json FROM workflow_index ORDER BY name COLLATE NOCASE ASC")
      .all() as Array<{ summary_json: string }>;

    return Object.freeze(rows.map((row) => JSON.parse(row.summary_json) as IWorkflowRecordSummary));
  }

  public get isAvailable(): boolean {
    try {
      this.require.resolve("better-sqlite3");
      return true;
    } catch {
      return false;
    }
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
  }

  private getDatabase(): DatabaseConnection {
    if (!this.database) {
      if (!this.isAvailable) {
        throw new Error("better-sqlite3 is required for SQLite workflow indexing.");
      }

      const Database = this.require("better-sqlite3") as DatabaseModule;
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = new Database(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }

    return this.database;
  }
}

