import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { IdentityLifecycleEvent } from "../../../../application/contracts/IdentityLifecycleEventContracts";
import type { IIdentityLifecycleEventPublisher } from "../../../../application/identity/ports/IIdentityLifecycleEventPublisher";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  IDENTITY_PERSISTENCE_MIGRATIONS,
  IDENTITY_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteIdentityPersistenceMigrations";

interface LifecycleAuditEventRow {
  readonly event_json: string;
}

export class SqliteIdentityLifecycleEventPublisher implements IIdentityLifecycleEventPublisher {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async publish(event: IdentityLifecycleEvent): Promise<void> {
    const identifiers = resolveAuditIdentifiers(event);
    this.getDatabase()
      .prepare(`
        INSERT INTO identity_lifecycle_audit_events (
          event_id,
          event_type,
          occurred_at,
          user_identity_id,
          trusted_device_id,
          session_id,
          event_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        event.eventType,
        event.occurredAt,
        identifiers.userIdentityId ?? null,
        identifiers.trustedDeviceId ?? null,
        identifiers.sessionId ?? null,
        JSON.stringify(event),
      );
  }

  public listRecent(limit = 100): ReadonlyArray<IdentityLifecycleEvent> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT event_json
        FROM identity_lifecycle_audit_events
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(Math.max(0, limit)) as LifecycleAuditEventRow[];

    return Object.freeze(rows.map((row) => JSON.parse(row.event_json) as IdentityLifecycleEvent));
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

  private initialize(db: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(db);
    if (currentVersion > IDENTITY_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Identity repository schema version ${currentVersion} is newer than supported schema version ${IDENTITY_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, migrationSql] of IDENTITY_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      db.transaction(() => {
        db.exec(migrationSql);
        db.prepare("INSERT INTO identity_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS identity_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = db.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}

function resolveAuditIdentifiers(event: IdentityLifecycleEvent): {
  readonly userIdentityId?: string;
  readonly trustedDeviceId?: string;
  readonly sessionId?: string;
} {
  const payload = event.payload as Record<string, unknown>;
  return Object.freeze({
    userIdentityId: normalizeIdentifier(payload.userIdentityId),
    trustedDeviceId: normalizeIdentifier(payload.trustedDeviceId),
    sessionId: normalizeIdentifier(payload.sessionId),
  });
}

function normalizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}
