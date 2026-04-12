import fs from "node:fs";
import path from "node:path";
import {
  type SqliteCompatDatabase,
  openSqliteCompatDatabase,
} from "../persistence/sqlite/SqliteCompat";
import {
  type IOfflineLocalExecutionRegistrationRepository,
  type IOfflineLocalExecutionRegistrationSerializer,
  type OfflineLocalExecutionRegistrationRecord,
  type OfflineLocalExecutionRegistrationSerializedRecord,
  JsonOfflineLocalExecutionRegistrationSerializer,
  OfflineLocalExecutionRegistrationPersistenceError,
} from "@application/common/OfflineLocalExecutionRegistrationPersistence";
import {
  createElectronSafeStorageDesktopOfflineValueProtectionPort,
  type DesktopOfflineValueProtectionPort,
  DesktopOfflineValueProtectionPostures,
} from "./DesktopOfflineValueProtection";

interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
}

const MIGRATIONS: ReadonlyArray<MigrationDefinition> = Object.freeze([
  {
    version: 1,
    name: "create-offline-local-execution-registration-store",
    statements: Object.freeze([
      `
      CREATE TABLE IF NOT EXISTS offline_local_execution_registration_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS offline_local_execution_registrations (
        workspace_id TEXT NOT NULL,
        registration_id TEXT NOT NULL,
        actor_user_identity_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        execution_class TEXT NOT NULL,
        target_resource_class TEXT NOT NULL,
        target_resource_id TEXT NOT NULL,
        user_visible_registration_status TEXT NOT NULL,
        queued_at TEXT NOT NULL,
        local_state_scope TEXT NOT NULL,
        retryable INTEGER NOT NULL,
        retry_count INTEGER NOT NULL,
        max_retry_count INTEGER NOT NULL,
        next_eligible_replay_at TEXT,
        last_attempted_at TEXT,
        canonical_execution_metadata_json TEXT NOT NULL,
        canonical_execution_metadata_digest TEXT NOT NULL,
        registration_envelope_json TEXT NOT NULL,
        retryability_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, registration_id)
      )
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_offline_local_execution_registrations_workspace_status
      ON offline_local_execution_registrations(workspace_id, user_visible_registration_status, queued_at ASC)
      `,
    ]),
  },
  {
    version: 2,
    name: "add-offline-local-execution-registration-value-protection-posture",
    statements: Object.freeze([
      `
      ALTER TABLE offline_local_execution_registrations
      ADD COLUMN payload_protection_posture TEXT NOT NULL DEFAULT 'unprotected-at-rest'
      `,
    ]),
  },
]);

interface LocalExecutionRegistrationRow {
  readonly workspace_id: string;
  readonly registration_id: string;
  readonly actor_user_identity_id: string;
  readonly local_state_scope: string;
  readonly canonical_execution_metadata_json: string;
  readonly canonical_execution_metadata_digest: string;
  readonly registration_envelope_json: string;
  readonly retryability_json: string;
  readonly payload_protection_posture: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DesktopOfflineLocalExecutionRegistrationRepositoryOptions {
  readonly databasePath: string;
  readonly maxEntries?: number;
  readonly serializer?: IOfflineLocalExecutionRegistrationSerializer;
  readonly valueProtection?: DesktopOfflineValueProtectionPort;
}

const DEFAULT_MAX_ENTRIES = 5000;

export class DesktopOfflineLocalExecutionRegistrationRepository implements IOfflineLocalExecutionRegistrationRepository {
  private readonly databasePath: string;
  private readonly serializer: IOfflineLocalExecutionRegistrationSerializer;
  private readonly maxEntries: number;
  private readonly valueProtection: DesktopOfflineValueProtectionPort;
  private database?: SqliteCompatDatabase;

  constructor(options: DesktopOfflineLocalExecutionRegistrationRepositoryOptions) {
    this.databasePath = options.databasePath;
    this.serializer = options.serializer ?? new JsonOfflineLocalExecutionRegistrationSerializer();
    this.valueProtection = options.valueProtection
      ?? createElectronSafeStorageDesktopOfflineValueProtectionPort();
    this.maxEntries = Number.isInteger(options.maxEntries) && (options.maxEntries ?? 0) > 0
      ? options.maxEntries!
      : DEFAULT_MAX_ENTRIES;
    this.initialize();
  }

  public async upsertRegistration(record: OfflineLocalExecutionRegistrationRecord): Promise<void> {
    const serialized = this.serializer.serialize(record);
    this.getDatabase()
      .prepare(`
        INSERT INTO offline_local_execution_registrations (
          workspace_id,
          registration_id,
          actor_user_identity_id,
          execution_id,
          execution_class,
          target_resource_class,
          target_resource_id,
          user_visible_registration_status,
          queued_at,
          local_state_scope,
          retryable,
          retry_count,
          max_retry_count,
          next_eligible_replay_at,
          last_attempted_at,
          canonical_execution_metadata_json,
          canonical_execution_metadata_digest,
          registration_envelope_json,
          retryability_json,
          payload_protection_posture,
          created_at,
          updated_at
        ) VALUES (
          @workspace_id,
          @registration_id,
          @actor_user_identity_id,
          @execution_id,
          @execution_class,
          @target_resource_class,
          @target_resource_id,
          @user_visible_registration_status,
          @queued_at,
          @local_state_scope,
          @retryable,
          @retry_count,
          @max_retry_count,
          @next_eligible_replay_at,
          @last_attempted_at,
          @canonical_execution_metadata_json,
          @canonical_execution_metadata_digest,
          @registration_envelope_json,
          @retryability_json,
          @payload_protection_posture,
          @created_at,
          @updated_at
        )
        ON CONFLICT(workspace_id, registration_id) DO UPDATE SET
          actor_user_identity_id = excluded.actor_user_identity_id,
          execution_id = excluded.execution_id,
          execution_class = excluded.execution_class,
          target_resource_class = excluded.target_resource_class,
          target_resource_id = excluded.target_resource_id,
          user_visible_registration_status = excluded.user_visible_registration_status,
          queued_at = excluded.queued_at,
          local_state_scope = excluded.local_state_scope,
          retryable = excluded.retryable,
          retry_count = excluded.retry_count,
          max_retry_count = excluded.max_retry_count,
          next_eligible_replay_at = excluded.next_eligible_replay_at,
          last_attempted_at = excluded.last_attempted_at,
          canonical_execution_metadata_json = excluded.canonical_execution_metadata_json,
          canonical_execution_metadata_digest = excluded.canonical_execution_metadata_digest,
          registration_envelope_json = excluded.registration_envelope_json,
          retryability_json = excluded.retryability_json,
          payload_protection_posture = excluded.payload_protection_posture,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `)
      .run(this.toRow(serialized));

    this.enforceRetentionBound();
  }

  public async findRegistration(
    workspaceId: string,
    registrationId: string,
  ): Promise<OfflineLocalExecutionRegistrationRecord | undefined> {
    const row = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          registration_id,
          actor_user_identity_id,
          local_state_scope,
          canonical_execution_metadata_json,
          canonical_execution_metadata_digest,
          registration_envelope_json,
          retryability_json,
          payload_protection_posture,
          created_at,
          updated_at
        FROM offline_local_execution_registrations
        WHERE workspace_id = ? AND registration_id = ?
      `)
      .get(workspaceId, registrationId) as LocalExecutionRegistrationRow | undefined;

    return row ? this.fromRow(row) : undefined;
  }

  public async listRegistrationsByWorkspace(
    workspaceId: string,
  ): Promise<ReadonlyArray<OfflineLocalExecutionRegistrationRecord>> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          registration_id,
          actor_user_identity_id,
          local_state_scope,
          canonical_execution_metadata_json,
          canonical_execution_metadata_digest,
          registration_envelope_json,
          retryability_json,
          payload_protection_posture,
          created_at,
          updated_at
        FROM offline_local_execution_registrations
        WHERE workspace_id = ?
        ORDER BY queued_at ASC, registration_id ASC
      `)
      .all(workspaceId) as ReadonlyArray<LocalExecutionRegistrationRow>;

    return Object.freeze(rows.map((row) => this.fromRow(row)));
  }

  public async deleteRegistration(workspaceId: string, registrationId: string): Promise<boolean> {
    const result = this.getDatabase()
      .prepare(`
        DELETE FROM offline_local_execution_registrations
        WHERE workspace_id = ? AND registration_id = ?
      `)
      .run(workspaceId, registrationId);

    return result.changes > 0;
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
  }

  private initialize(): void {
    const db = this.getDatabase();
    this.ensureMigrationTable(db);

    const appliedVersions = new Set(
      (db.prepare("SELECT version FROM offline_local_execution_registration_schema_migrations ORDER BY version ASC").all()
        as ReadonlyArray<{ version: number }>).map((row) => row.version),
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
          INSERT INTO offline_local_execution_registration_schema_migrations (version, name, applied_at)
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
      CREATE TABLE IF NOT EXISTS offline_local_execution_registration_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  }

  private enforceRetentionBound(): void {
    this.getDatabase()
      .prepare(`
        DELETE FROM offline_local_execution_registrations
        WHERE rowid IN (
          SELECT rowid
          FROM offline_local_execution_registrations
          ORDER BY queued_at DESC
          LIMIT -1 OFFSET ?
        )
      `)
      .run(this.maxEntries);
  }

  private toRow(serialized: OfflineLocalExecutionRegistrationSerializedRecord): Record<string, unknown> {
    const registration = JSON.parse(serialized.registrationEnvelopeJson) as {
      executionId: string;
      executionClass: string;
      resourceClass: string;
      resourceId: string;
      userVisibleRegistrationStatus: string;
      queuedAt: string;
    };
    const retryability = JSON.parse(serialized.retryabilityJson) as {
      retryable: boolean;
      retryCount: number;
      maxRetryCount: number;
      nextEligibleReplayAt?: string;
      lastAttemptedAt?: string;
    };

    return {
      workspace_id: serialized.workspaceId,
      registration_id: serialized.registrationId,
      actor_user_identity_id: serialized.actorUserIdentityId,
      execution_id: registration.executionId,
      execution_class: registration.executionClass,
      target_resource_class: registration.resourceClass,
      target_resource_id: registration.resourceId,
      user_visible_registration_status: registration.userVisibleRegistrationStatus,
      queued_at: registration.queuedAt,
      local_state_scope: serialized.localStateScope,
      retryable: retryability.retryable ? 1 : 0,
      retry_count: retryability.retryCount,
      max_retry_count: retryability.maxRetryCount,
      next_eligible_replay_at: retryability.nextEligibleReplayAt ?? null,
      last_attempted_at: retryability.lastAttemptedAt ?? null,
      canonical_execution_metadata_json: this.valueProtection.protect(serialized.canonicalExecutionMetadataJson, {
        store: "offline-local-execution-registration",
        field: "canonical_execution_metadata_json",
      }),
      canonical_execution_metadata_digest: serialized.canonicalExecutionMetadataDigest,
      registration_envelope_json: this.valueProtection.protect(serialized.registrationEnvelopeJson, {
        store: "offline-local-execution-registration",
        field: "registration_envelope_json",
      }),
      retryability_json: this.valueProtection.protect(serialized.retryabilityJson, {
        store: "offline-local-execution-registration",
        field: "retryability_json",
      }),
      payload_protection_posture: this.valueProtection.posture,
      created_at: serialized.createdAt,
      updated_at: serialized.updatedAt,
    };
  }

  private fromRow(row: LocalExecutionRegistrationRow): OfflineLocalExecutionRegistrationRecord {
    if (
      row.payload_protection_posture !== DesktopOfflineValueProtectionPostures.protectedAtRest
      && row.payload_protection_posture !== DesktopOfflineValueProtectionPostures.unprotectedAtRest
    ) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${row.registration_id}' persisted payload protection posture is invalid.`,
      );
    }
    if (
      row.payload_protection_posture === DesktopOfflineValueProtectionPostures.protectedAtRest
      && this.valueProtection.posture !== DesktopOfflineValueProtectionPostures.protectedAtRest
    ) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${row.registration_id}' requires protected-at-rest decoding, but protected storage is unavailable.`,
      );
    }

    const serialized: OfflineLocalExecutionRegistrationSerializedRecord = {
      registrationId: row.registration_id,
      workspaceId: row.workspace_id,
      actorUserIdentityId: row.actor_user_identity_id,
      registrationEnvelopeJson: this.valueProtection.unprotect(row.registration_envelope_json, {
        store: "offline-local-execution-registration",
        field: "registration_envelope_json",
      }),
      retryabilityJson: this.valueProtection.unprotect(row.retryability_json, {
        store: "offline-local-execution-registration",
        field: "retryability_json",
      }),
      localStateScope: row.local_state_scope as OfflineLocalExecutionRegistrationSerializedRecord["localStateScope"],
      canonicalExecutionMetadataJson: this.valueProtection.unprotect(row.canonical_execution_metadata_json, {
        store: "offline-local-execution-registration",
        field: "canonical_execution_metadata_json",
      }),
      canonicalExecutionMetadataDigest: row.canonical_execution_metadata_digest,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const record = this.serializer.deserialize(serialized);
    if (record.canonicalExecutionMetadataJson !== row.canonical_execution_metadata_json) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${record.registration.registrationId}' persisted canonical metadata JSON does not match serializer output.`,
      );
    }
    if (record.canonicalExecutionMetadataDigest !== row.canonical_execution_metadata_digest) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${record.registration.registrationId}' persisted metadata digest does not match serializer output.`,
      );
    }

    return record;
  }
}
