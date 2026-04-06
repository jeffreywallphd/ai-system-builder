import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AssetAuditEvent, AssetAuditSink } from "../../../application/assets/ports/AssetAuditPort";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  ASSET_PERSISTENCE_MIGRATIONS,
  ASSET_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteAssetPersistenceMigrations";

interface AssetAuditEventRow {
  readonly event_json: string;
}

export class SqliteAssetAuditRecorder implements AssetAuditSink {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.getDatabase()
      .prepare(`
        INSERT INTO asset_audit_events (
          event_id,
          event_type,
          occurred_at,
          actor_user_id,
          workspace_id,
          correlation_id,
          operation_key,
          asset_id,
          outcome,
          event_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        event.type,
        event.occurredAt,
        event.actorUserId,
        event.workspaceId,
        event.correlationId ?? null,
        event.operationKey ?? null,
        event.asset.assetId,
        event.outcome ?? null,
        JSON.stringify(event),
        new Date().toISOString(),
      );
  }

  public listRecent(limit = 100): ReadonlyArray<AssetAuditEvent> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM asset_audit_events
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(Math.max(0, limit)) as AssetAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as AssetAuditEvent));
  }

  public listByWorkspaceId(workspaceId: string, limit = 100): ReadonlyArray<AssetAuditEvent> {
    const normalizedWorkspaceId = workspaceId.trim();
    if (normalizedWorkspaceId.length < 1) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM asset_audit_events
        WHERE workspace_id = ?
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(normalizedWorkspaceId, Math.max(0, limit)) as AssetAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as AssetAuditEvent));
  }

  public listByAssetId(assetId: string, limit = 100): ReadonlyArray<AssetAuditEvent> {
    const normalizedAssetId = assetId.trim();
    if (normalizedAssetId.length < 1) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM asset_audit_events
        WHERE asset_id = ?
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(normalizedAssetId, Math.max(0, limit)) as AssetAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as AssetAuditEvent));
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
    if (currentVersion > ASSET_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Asset schema version ${currentVersion} is newer than supported version ${ASSET_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of ASSET_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO asset_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS asset_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM asset_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}
