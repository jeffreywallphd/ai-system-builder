import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NodeTrustAuditEvent, NodeTrustAuditSink } from "../../../application/nodes/ports/NodeTrustAuditPorts";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  NODE_TRUST_PERSISTENCE_MIGRATIONS,
  NODE_TRUST_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteNodeTrustPersistenceMigrations";

interface NodeTrustAuditEventRow {
  readonly event_json: string;
}

export class SqliteNodeTrustAuditRecorder implements NodeTrustAuditSink {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async recordNodeTrustAuditEvent(event: NodeTrustAuditEvent): Promise<void> {
    this.getDatabase()
      .prepare(`
        INSERT INTO node_trust_audit_events (
          event_id,
          event_type,
          occurred_at,
          actor_user_identity_id,
          node_id,
          enrollment_request_id,
          workspace_id,
          deployment_id,
          outcome,
          event_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        event.type,
        event.occurredAt,
        event.actorUserIdentityId,
        event.nodeId ?? null,
        event.enrollmentRequestId ?? null,
        event.workspaceId ?? null,
        event.deploymentId ?? null,
        event.outcome ?? null,
        JSON.stringify(event),
        new Date().toISOString(),
      );
  }

  public listRecent(limit = 100): ReadonlyArray<NodeTrustAuditEvent> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM node_trust_audit_events
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(Math.max(0, limit)) as NodeTrustAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as NodeTrustAuditEvent));
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
    if (currentVersion > NODE_TRUST_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Node trust schema version ${currentVersion} is newer than supported version ${NODE_TRUST_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of NODE_TRUST_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO node_trust_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS node_trust_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM node_trust_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}
