import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  StorageManagementAuditEvent,
  StorageManagementAuditSink,
} from "@application/storage/ports/StorageObservabilityPorts";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  STORAGE_INSTANCE_PERSISTENCE_MIGRATIONS,
  STORAGE_INSTANCE_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteStorageInstancePersistenceMigrations";

interface StorageManagementAuditEventRow {
  readonly event_json: string;
}

export class SqliteStorageManagementAuditRecorder implements StorageManagementAuditSink {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async recordStorageManagementEvent(event: StorageManagementAuditEvent): Promise<void> {
    this.getDatabase()
      .prepare(`
        INSERT INTO storage_management_audit_events (
          event_id,
          event_type,
          occurred_at,
          actor_user_identity_id,
          workspace_id,
          storage_instance_id,
          correlation_id,
          outcome,
          event_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        event.type,
        event.occurredAt,
        event.actorUserIdentityId,
        event.workspaceId,
        event.storageInstanceId ?? null,
        event.correlationId ?? null,
        event.outcome ?? null,
        JSON.stringify(event),
        new Date().toISOString(),
      );
  }

  public listRecent(limit = 100): ReadonlyArray<StorageManagementAuditEvent> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM storage_management_audit_events
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(Math.max(0, limit)) as StorageManagementAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as StorageManagementAuditEvent));
  }

  public listByStorageInstanceId(storageInstanceId: string, limit = 100): ReadonlyArray<StorageManagementAuditEvent> {
    const normalizedStorageInstanceId = storageInstanceId.trim();
    if (normalizedStorageInstanceId.length < 1) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM storage_management_audit_events
        WHERE storage_instance_id = ?
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(normalizedStorageInstanceId, Math.max(0, limit)) as StorageManagementAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as StorageManagementAuditEvent));
  }

  public listByWorkspaceId(workspaceId: string, limit = 100): ReadonlyArray<StorageManagementAuditEvent> {
    const normalizedWorkspaceId = workspaceId.trim();
    if (normalizedWorkspaceId.length < 1) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM storage_management_audit_events
        WHERE workspace_id = ?
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(normalizedWorkspaceId, Math.max(0, limit)) as StorageManagementAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as StorageManagementAuditEvent));
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
      this.database.pragma("foreign_keys = ON");
    }

    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }

    return this.database;
  }

  private initialize(database: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(database);
    if (currentVersion > STORAGE_INSTANCE_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Storage instance schema version ${currentVersion} is newer than supported version ${STORAGE_INSTANCE_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of STORAGE_INSTANCE_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO storage_instance_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS storage_instance_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM storage_instance_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}

