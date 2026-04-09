import fs from "node:fs";
import path from "node:path";
import {
  type SqliteCompatDatabase,
  openSqliteCompatDatabase,
} from "../persistence/sqlite/SqliteCompat";
import {
  type IOfflinePendingOperationRepository,
  type OfflinePendingOperationRecord,
  type OfflinePendingOperationSerializedRecord,
  type IOfflinePendingOperationSerializer,
  JsonOfflinePendingOperationSerializer,
  OfflinePendingOperationPersistenceError,
} from "@application/common/OfflinePendingOperationPersistence";
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
    name: "create-offline-pending-operation-store",
    statements: Object.freeze([
      `
      CREATE TABLE IF NOT EXISTS offline_pending_operation_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS offline_pending_operations (
        workspace_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        actor_user_identity_id TEXT NOT NULL,
        target_resource_class TEXT NOT NULL,
        target_resource_id TEXT NOT NULL,
        intent TEXT NOT NULL,
        user_visible_sync_status TEXT NOT NULL,
        queued_at TEXT NOT NULL,
        local_state_scope TEXT NOT NULL,
        retryable INTEGER NOT NULL,
        retry_count INTEGER NOT NULL,
        max_retry_count INTEGER NOT NULL,
        next_eligible_replay_at TEXT,
        last_attempted_at TEXT,
        canonical_replay_payload_json TEXT NOT NULL,
        canonical_replay_payload_digest TEXT NOT NULL,
        operation_envelope_json TEXT NOT NULL,
        dependencies_json TEXT NOT NULL,
        resource_base_versions_json TEXT NOT NULL,
        retryability_json TEXT NOT NULL,
        pending_run_submission_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, operation_id)
      )
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_offline_pending_operations_workspace_status
      ON offline_pending_operations(workspace_id, user_visible_sync_status, queued_at ASC)
      `,
    ]),
  },
  {
    version: 2,
    name: "add-offline-pending-operation-value-protection-posture",
    statements: Object.freeze([
      `
      ALTER TABLE offline_pending_operations
      ADD COLUMN payload_protection_posture TEXT NOT NULL DEFAULT 'unprotected-at-rest'
      `,
    ]),
  },
]);

interface PendingOperationRow {
  readonly workspace_id: string;
  readonly operation_id: string;
  readonly actor_user_identity_id: string;
  readonly local_state_scope: string;
  readonly canonical_replay_payload_json: string;
  readonly canonical_replay_payload_digest: string;
  readonly operation_envelope_json: string;
  readonly dependencies_json: string;
  readonly resource_base_versions_json: string;
  readonly retryability_json: string;
  readonly pending_run_submission_json: string | null;
  readonly payload_protection_posture: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DesktopOfflinePendingOperationRepositoryOptions {
  readonly databasePath: string;
  readonly maxEntries?: number;
  readonly serializer?: IOfflinePendingOperationSerializer;
  readonly valueProtection?: DesktopOfflineValueProtectionPort;
}

const DEFAULT_MAX_ENTRIES = 5000;

export class DesktopOfflinePendingOperationRepository implements IOfflinePendingOperationRepository {
  private readonly databasePath: string;
  private readonly serializer: IOfflinePendingOperationSerializer;
  private readonly maxEntries: number;
  private readonly valueProtection: DesktopOfflineValueProtectionPort;
  private database?: SqliteCompatDatabase;

  constructor(options: DesktopOfflinePendingOperationRepositoryOptions) {
    this.databasePath = options.databasePath;
    this.serializer = options.serializer ?? new JsonOfflinePendingOperationSerializer();
    this.valueProtection = options.valueProtection
      ?? createElectronSafeStorageDesktopOfflineValueProtectionPort();
    this.maxEntries = Number.isInteger(options.maxEntries) && (options.maxEntries ?? 0) > 0
      ? options.maxEntries!
      : DEFAULT_MAX_ENTRIES;
    this.initialize();
  }

  public async upsertOperation(record: OfflinePendingOperationRecord): Promise<void> {
    const serialized = this.serializer.serialize(record);

    this.getDatabase()
      .prepare(`
        INSERT INTO offline_pending_operations (
          workspace_id,
          operation_id,
          actor_user_identity_id,
          target_resource_class,
          target_resource_id,
          intent,
          user_visible_sync_status,
          queued_at,
          local_state_scope,
          retryable,
          retry_count,
          max_retry_count,
          next_eligible_replay_at,
          last_attempted_at,
          canonical_replay_payload_json,
          canonical_replay_payload_digest,
          operation_envelope_json,
          dependencies_json,
          resource_base_versions_json,
          retryability_json,
          pending_run_submission_json,
          payload_protection_posture,
          created_at,
          updated_at
        ) VALUES (
          @workspace_id,
          @operation_id,
          @actor_user_identity_id,
          @target_resource_class,
          @target_resource_id,
          @intent,
          @user_visible_sync_status,
          @queued_at,
          @local_state_scope,
          @retryable,
          @retry_count,
          @max_retry_count,
          @next_eligible_replay_at,
          @last_attempted_at,
          @canonical_replay_payload_json,
          @canonical_replay_payload_digest,
          @operation_envelope_json,
          @dependencies_json,
          @resource_base_versions_json,
          @retryability_json,
          @pending_run_submission_json,
          @payload_protection_posture,
          @created_at,
          @updated_at
        )
        ON CONFLICT(workspace_id, operation_id) DO UPDATE SET
          actor_user_identity_id = excluded.actor_user_identity_id,
          target_resource_class = excluded.target_resource_class,
          target_resource_id = excluded.target_resource_id,
          intent = excluded.intent,
          user_visible_sync_status = excluded.user_visible_sync_status,
          queued_at = excluded.queued_at,
          local_state_scope = excluded.local_state_scope,
          retryable = excluded.retryable,
          retry_count = excluded.retry_count,
          max_retry_count = excluded.max_retry_count,
          next_eligible_replay_at = excluded.next_eligible_replay_at,
          last_attempted_at = excluded.last_attempted_at,
          canonical_replay_payload_json = excluded.canonical_replay_payload_json,
          canonical_replay_payload_digest = excluded.canonical_replay_payload_digest,
          operation_envelope_json = excluded.operation_envelope_json,
          dependencies_json = excluded.dependencies_json,
          resource_base_versions_json = excluded.resource_base_versions_json,
          retryability_json = excluded.retryability_json,
          pending_run_submission_json = excluded.pending_run_submission_json,
          payload_protection_posture = excluded.payload_protection_posture,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `)
      .run(this.toRow(serialized));

    this.enforceRetentionBound();
  }

  public async findOperation(
    workspaceId: string,
    operationId: string,
  ): Promise<OfflinePendingOperationRecord | undefined> {
    const row = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          operation_id,
          actor_user_identity_id,
          local_state_scope,
          canonical_replay_payload_json,
          canonical_replay_payload_digest,
          operation_envelope_json,
          dependencies_json,
          resource_base_versions_json,
          retryability_json,
          pending_run_submission_json,
          payload_protection_posture,
          created_at,
          updated_at
        FROM offline_pending_operations
        WHERE workspace_id = ? AND operation_id = ?
      `)
      .get(workspaceId, operationId) as PendingOperationRow | undefined;

    return row ? this.fromRow(row) : undefined;
  }

  public async listOperationsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflinePendingOperationRecord>> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          operation_id,
          actor_user_identity_id,
          local_state_scope,
          canonical_replay_payload_json,
          canonical_replay_payload_digest,
          operation_envelope_json,
          dependencies_json,
          resource_base_versions_json,
          retryability_json,
          pending_run_submission_json,
          payload_protection_posture,
          created_at,
          updated_at
        FROM offline_pending_operations
        WHERE workspace_id = ?
        ORDER BY queued_at ASC, operation_id ASC
      `)
      .all(workspaceId) as ReadonlyArray<PendingOperationRow>;

    return Object.freeze(rows.map((row) => this.fromRow(row)));
  }

  public async deleteOperation(workspaceId: string, operationId: string): Promise<boolean> {
    const result = this.getDatabase()
      .prepare(`
        DELETE FROM offline_pending_operations
        WHERE workspace_id = ? AND operation_id = ?
      `)
      .run(workspaceId, operationId);

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
      (db.prepare("SELECT version FROM offline_pending_operation_schema_migrations ORDER BY version ASC").all()
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
          INSERT INTO offline_pending_operation_schema_migrations (version, name, applied_at)
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
      CREATE TABLE IF NOT EXISTS offline_pending_operation_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  }

  private enforceRetentionBound(): void {
    this.getDatabase()
      .prepare(`
        DELETE FROM offline_pending_operations
        WHERE rowid IN (
          SELECT rowid
          FROM offline_pending_operations
          ORDER BY queued_at DESC
          LIMIT -1 OFFSET ?
        )
      `)
      .run(this.maxEntries);
  }

  private toRow(serialized: OfflinePendingOperationSerializedRecord): Record<string, unknown> {
    const operation = JSON.parse(serialized.operationEnvelopeJson) as {
      targetResourceClass: string;
      targetResourceId: string;
      intent: string;
      userVisibleSyncStatus: string;
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
      operation_id: serialized.operationId,
      actor_user_identity_id: serialized.actorUserIdentityId,
      target_resource_class: operation.targetResourceClass,
      target_resource_id: operation.targetResourceId,
      intent: operation.intent,
      user_visible_sync_status: operation.userVisibleSyncStatus,
      queued_at: operation.queuedAt,
      local_state_scope: serialized.localStateScope,
      retryable: retryability.retryable ? 1 : 0,
      retry_count: retryability.retryCount,
      max_retry_count: retryability.maxRetryCount,
      next_eligible_replay_at: retryability.nextEligibleReplayAt ?? null,
      last_attempted_at: retryability.lastAttemptedAt ?? null,
      canonical_replay_payload_json: this.valueProtection.protect(serialized.canonicalReplayPayloadJson, {
        store: "offline-pending-operation",
        field: "canonical_replay_payload_json",
      }),
      canonical_replay_payload_digest: serialized.canonicalReplayPayloadDigest,
      operation_envelope_json: this.valueProtection.protect(serialized.operationEnvelopeJson, {
        store: "offline-pending-operation",
        field: "operation_envelope_json",
      }),
      dependencies_json: this.valueProtection.protect(serialized.dependenciesJson, {
        store: "offline-pending-operation",
        field: "dependencies_json",
      }),
      resource_base_versions_json: this.valueProtection.protect(serialized.resourceBaseVersionsJson, {
        store: "offline-pending-operation",
        field: "resource_base_versions_json",
      }),
      retryability_json: this.valueProtection.protect(serialized.retryabilityJson, {
        store: "offline-pending-operation",
        field: "retryability_json",
      }),
      pending_run_submission_json: serialized.pendingRunSubmissionJson
        ? this.valueProtection.protect(serialized.pendingRunSubmissionJson, {
          store: "offline-pending-operation",
          field: "pending_run_submission_json",
        })
        : null,
      payload_protection_posture: this.valueProtection.posture,
      created_at: serialized.createdAt,
      updated_at: serialized.updatedAt,
    };
  }

  private fromRow(row: PendingOperationRow): OfflinePendingOperationRecord {
    if (
      row.payload_protection_posture !== DesktopOfflineValueProtectionPostures.protectedAtRest
      && row.payload_protection_posture !== DesktopOfflineValueProtectionPostures.unprotectedAtRest
    ) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${row.operation_id}' persisted payload protection posture is invalid.`,
      );
    }
    if (
      row.payload_protection_posture === DesktopOfflineValueProtectionPostures.protectedAtRest
      && this.valueProtection.posture !== DesktopOfflineValueProtectionPostures.protectedAtRest
    ) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${row.operation_id}' requires protected-at-rest decoding, but protected storage is unavailable.`,
      );
    }

    const serialized: OfflinePendingOperationSerializedRecord = {
      operationId: row.operation_id,
      workspaceId: row.workspace_id,
      actorUserIdentityId: row.actor_user_identity_id,
      operationEnvelopeJson: this.valueProtection.unprotect(row.operation_envelope_json, {
        store: "offline-pending-operation",
        field: "operation_envelope_json",
      }),
      dependenciesJson: this.valueProtection.unprotect(row.dependencies_json, {
        store: "offline-pending-operation",
        field: "dependencies_json",
      }),
      resourceBaseVersionsJson: this.valueProtection.unprotect(row.resource_base_versions_json, {
        store: "offline-pending-operation",
        field: "resource_base_versions_json",
      }),
      retryabilityJson: this.valueProtection.unprotect(row.retryability_json, {
        store: "offline-pending-operation",
        field: "retryability_json",
      }),
      localStateScope: row.local_state_scope as OfflinePendingOperationSerializedRecord["localStateScope"],
      canonicalReplayPayloadJson: this.valueProtection.unprotect(row.canonical_replay_payload_json, {
        store: "offline-pending-operation",
        field: "canonical_replay_payload_json",
      }),
      canonicalReplayPayloadDigest: row.canonical_replay_payload_digest,
      pendingRunSubmissionJson: row.pending_run_submission_json
        ? this.valueProtection.unprotect(row.pending_run_submission_json, {
          store: "offline-pending-operation",
          field: "pending_run_submission_json",
        })
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const record = this.serializer.deserialize(serialized);
    if (record.canonicalReplayPayloadJson !== row.canonical_replay_payload_json) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${record.operation.mutationId}' persisted canonical payload JSON does not match serializer output.`,
      );
    }
    if (record.canonicalReplayPayloadDigest !== row.canonical_replay_payload_digest) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${record.operation.mutationId}' persisted replay payload digest does not match serializer output.`,
      );
    }

    return record;
  }
}
