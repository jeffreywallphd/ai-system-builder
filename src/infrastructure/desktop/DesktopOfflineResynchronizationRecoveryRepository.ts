import fs from "node:fs";
import path from "node:path";
import {
  type SqliteCompatDatabase,
  openSqliteCompatDatabase,
} from "../persistence/sqlite/SqliteCompat";
import {
  type IOfflineResynchronizationRecoveryStateRepository,
  type OfflineResynchronizationAttemptMarker,
  OfflineResynchronizationAttemptMarkerStatuses,
  OfflineDesktopStartupRecoveryError,
} from "@application/common/OfflineDesktopStartupRecovery";

interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
}

const MIGRATIONS: ReadonlyArray<MigrationDefinition> = Object.freeze([
  {
    version: 1,
    name: "create-offline-resynchronization-recovery-store",
    statements: Object.freeze([
      `
      CREATE TABLE IF NOT EXISTS offline_resynchronization_recovery_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS offline_resynchronization_attempts (
        workspace_id TEXT NOT NULL,
        sync_attempt_id TEXT NOT NULL,
        actor_user_identity_id TEXT NOT NULL,
        request_id TEXT,
        started_at TEXT NOT NULL,
        status TEXT NOT NULL,
        completed_at TEXT,
        completion_outcome TEXT,
        last_error_summary TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, sync_attempt_id)
      )
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_offline_resynchronization_attempts_workspace_status
      ON offline_resynchronization_attempts(workspace_id, status, started_at DESC)
      `,
    ]),
  },
]);

interface OfflineResynchronizationAttemptRow {
  readonly workspace_id: string;
  readonly sync_attempt_id: string;
  readonly actor_user_identity_id: string;
  readonly request_id: string | null;
  readonly started_at: string;
  readonly status: string;
  readonly completed_at: string | null;
  readonly completion_outcome: string | null;
  readonly last_error_summary: string | null;
  readonly updated_at: string;
}

export interface DesktopOfflineResynchronizationRecoveryRepositoryOptions {
  readonly databasePath: string;
  readonly maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 5000;

export class DesktopOfflineResynchronizationRecoveryRepository
implements IOfflineResynchronizationRecoveryStateRepository {
  private readonly databasePath: string;
  private readonly maxEntries: number;
  private database?: SqliteCompatDatabase;

  constructor(options: DesktopOfflineResynchronizationRecoveryRepositoryOptions) {
    this.databasePath = options.databasePath;
    this.maxEntries = Number.isInteger(options.maxEntries) && (options.maxEntries ?? 0) > 0
      ? options.maxEntries!
      : DEFAULT_MAX_ENTRIES;
    this.initialize();
  }

  public async markAttemptStarted(input: {
    readonly workspaceId: string;
    readonly syncAttemptId: string;
    readonly actorUserIdentityId: string;
    readonly requestId?: string;
    readonly startedAt: string;
  }): Promise<void> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const syncAttemptId = normalizeRequired(input.syncAttemptId, "syncAttemptId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const startedAt = normalizeIsoTimestamp(input.startedAt, "startedAt");

    this.getDatabase()
      .prepare(`
        INSERT INTO offline_resynchronization_attempts (
          workspace_id,
          sync_attempt_id,
          actor_user_identity_id,
          request_id,
          started_at,
          status,
          completed_at,
          completion_outcome,
          last_error_summary,
          updated_at
        ) VALUES (
          @workspace_id,
          @sync_attempt_id,
          @actor_user_identity_id,
          @request_id,
          @started_at,
          @status,
          NULL,
          NULL,
          NULL,
          @updated_at
        )
        ON CONFLICT(workspace_id, sync_attempt_id) DO UPDATE SET
          actor_user_identity_id = excluded.actor_user_identity_id,
          request_id = excluded.request_id,
          started_at = excluded.started_at,
          status = excluded.status,
          completed_at = excluded.completed_at,
          completion_outcome = excluded.completion_outcome,
          last_error_summary = excluded.last_error_summary,
          updated_at = excluded.updated_at
      `)
      .run({
        workspace_id: workspaceId,
        sync_attempt_id: syncAttemptId,
        actor_user_identity_id: actorUserIdentityId,
        request_id: normalizeOptional(input.requestId) ?? null,
        started_at: startedAt,
        status: OfflineResynchronizationAttemptMarkerStatuses.started,
        updated_at: startedAt,
      });

    this.enforceRetentionBound();
  }

  public async markAttemptCompleted(input: {
    readonly workspaceId: string;
    readonly syncAttemptId: string;
    readonly completedAt: string;
    readonly completionOutcome: "succeeded" | "failed" | "conflict";
    readonly lastErrorSummary?: string;
  }): Promise<void> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const syncAttemptId = normalizeRequired(input.syncAttemptId, "syncAttemptId");
    const completedAt = normalizeIsoTimestamp(input.completedAt, "completedAt");
    const completionOutcome = input.completionOutcome;
    const lastErrorSummary = normalizeOptional(input.lastErrorSummary);

    const existing = this.getDatabase()
      .prepare(`
        SELECT actor_user_identity_id, request_id, started_at
        FROM offline_resynchronization_attempts
        WHERE workspace_id = ? AND sync_attempt_id = ?
      `)
      .get(workspaceId, syncAttemptId) as
      | {
        readonly actor_user_identity_id: string;
        readonly request_id: string | null;
        readonly started_at: string;
      }
      | undefined;

    this.getDatabase()
      .prepare(`
        INSERT INTO offline_resynchronization_attempts (
          workspace_id,
          sync_attempt_id,
          actor_user_identity_id,
          request_id,
          started_at,
          status,
          completed_at,
          completion_outcome,
          last_error_summary,
          updated_at
        ) VALUES (
          @workspace_id,
          @sync_attempt_id,
          @actor_user_identity_id,
          @request_id,
          @started_at,
          @status,
          @completed_at,
          @completion_outcome,
          @last_error_summary,
          @updated_at
        )
        ON CONFLICT(workspace_id, sync_attempt_id) DO UPDATE SET
          status = excluded.status,
          completed_at = excluded.completed_at,
          completion_outcome = excluded.completion_outcome,
          last_error_summary = excluded.last_error_summary,
          updated_at = excluded.updated_at
      `)
      .run({
        workspace_id: workspaceId,
        sync_attempt_id: syncAttemptId,
        actor_user_identity_id: existing?.actor_user_identity_id ?? "system:offline-recovery",
        request_id: existing?.request_id ?? null,
        started_at: existing?.started_at ?? completedAt,
        status: OfflineResynchronizationAttemptMarkerStatuses.completed,
        completed_at: completedAt,
        completion_outcome: completionOutcome,
        last_error_summary: lastErrorSummary ?? null,
        updated_at: completedAt,
      });

    this.enforceRetentionBound();
  }

  public async listAttemptsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflineResynchronizationAttemptMarker>> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          sync_attempt_id,
          actor_user_identity_id,
          request_id,
          started_at,
          status,
          completed_at,
          completion_outcome,
          last_error_summary,
          updated_at
        FROM offline_resynchronization_attempts
        WHERE workspace_id = ?
        ORDER BY started_at DESC, sync_attempt_id DESC
      `)
      .all(normalizeRequired(workspaceId, "workspaceId")) as ReadonlyArray<OfflineResynchronizationAttemptRow>;

    return Object.freeze(rows.map((row) => this.toMarker(row)));
  }

  public async listInterruptedAttempts(workspaceId: string): Promise<ReadonlyArray<OfflineResynchronizationAttemptMarker>> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          sync_attempt_id,
          actor_user_identity_id,
          request_id,
          started_at,
          status,
          completed_at,
          completion_outcome,
          last_error_summary,
          updated_at
        FROM offline_resynchronization_attempts
        WHERE workspace_id = ? AND status = ?
        ORDER BY started_at DESC, sync_attempt_id DESC
      `)
      .all(
        normalizeRequired(workspaceId, "workspaceId"),
        OfflineResynchronizationAttemptMarkerStatuses.started,
      ) as ReadonlyArray<OfflineResynchronizationAttemptRow>;

    return Object.freeze(rows.map((row) => this.toMarker(row)));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
  }

  private toMarker(row: OfflineResynchronizationAttemptRow): OfflineResynchronizationAttemptMarker {
    if (
      row.status !== OfflineResynchronizationAttemptMarkerStatuses.started
      && row.status !== OfflineResynchronizationAttemptMarkerStatuses.completed
    ) {
      throw new OfflineDesktopStartupRecoveryError(
        `Unsupported resynchronization attempt marker status '${row.status}'.`,
      );
    }

    return Object.freeze({
      workspaceId: row.workspace_id,
      syncAttemptId: row.sync_attempt_id,
      actorUserIdentityId: row.actor_user_identity_id,
      requestId: row.request_id ?? undefined,
      startedAt: row.started_at,
      status: row.status as OfflineResynchronizationAttemptMarker["status"],
      completedAt: row.completed_at ?? undefined,
      completionOutcome: row.completion_outcome
        ? (row.completion_outcome as OfflineResynchronizationAttemptMarker["completionOutcome"])
        : undefined,
      lastErrorSummary: row.last_error_summary ?? undefined,
      updatedAt: row.updated_at,
    });
  }

  private initialize(): void {
    const db = this.getDatabase();
    this.ensureMigrationTable(db);
    const appliedVersions = new Set(
      (db.prepare("SELECT version FROM offline_resynchronization_recovery_schema_migrations ORDER BY version ASC").all()
        as ReadonlyArray<{ version: number }>).map((entry) => entry.version),
    );

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      const transaction = db.transaction(() => {
        for (const statement of migration.statements) {
          db.exec(statement);
        }
        db.prepare(`
          INSERT INTO offline_resynchronization_recovery_schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(migration.version, migration.name, new Date().toISOString());
      });
      transaction();
    }
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }
    return this.database;
  }

  private ensureMigrationTable(db: SqliteCompatDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offline_resynchronization_recovery_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  }

  private enforceRetentionBound(): void {
    this.getDatabase()
      .prepare(`
        DELETE FROM offline_resynchronization_attempts
        WHERE rowid IN (
          SELECT rowid
          FROM offline_resynchronization_attempts
          ORDER BY started_at DESC
          LIMIT -1 OFFSET ?
        )
      `)
      .run(this.maxEntries);
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineDesktopStartupRecoveryError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflineDesktopStartupRecoveryError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}
