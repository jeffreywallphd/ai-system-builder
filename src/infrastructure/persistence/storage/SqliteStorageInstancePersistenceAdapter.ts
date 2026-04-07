import fs from "node:fs";
import path from "node:path";
import type {
  IStorageInstanceRepository,
  StorageInstanceListQuery,
  StorageInstanceMutationContext,
  StorageInstanceMutationResult,
} from "@application/storage/ports/IStorageInstanceRepository";
import type { StorageInstance } from "@domain/storage/StorageDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapStorageInstanceRowToDomain,
  mapStorageInstanceToRowValues,
  normalizeStorageLookup,
  parseStorageMutationReplayRecord,
  type StorageInstanceMutationReplayRow,
  type StorageInstanceRow,
} from "./StorageInstancePersistenceMapper";
import {
  STORAGE_INSTANCE_PERSISTENCE_MIGRATIONS,
  STORAGE_INSTANCE_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteStorageInstancePersistenceMigrations";

type StorageMutationKind = "create-storage-instance" | "save-storage-instance";

export class SqliteStorageInstancePersistenceAdapter implements IStorageInstanceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined> {
    const normalizedStorageInstanceId = normalizeStorageLookup(storageInstanceId);
    if (!normalizedStorageInstanceId) {
      return undefined;
    }

    const row = this.getDatabase().prepare("SELECT * FROM storage_instances WHERE storage_instance_id = ? LIMIT 1")
      .get(normalizedStorageInstanceId) as StorageInstanceRow | undefined;

    return row ? mapStorageInstanceRowToDomain(row) : undefined;
  }

  public async listStorageInstances(query: StorageInstanceListQuery): Promise<ReadonlyArray<StorageInstance>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const workspaceId = normalizeStorageLookup(query.workspaceId ?? "");
    if (workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(workspaceId);
    }

    const ownerUserIdentityId = normalizeStorageLookup(query.ownerUserIdentityId ?? "");
    if (ownerUserIdentityId) {
      clauses.push("owner_user_identity_id = ?");
      params.push(ownerUserIdentityId);
    }

    const storageInstanceIds = query.storageInstanceIds?.map((id) => normalizeStorageLookup(id)).filter(
      (id): id is string => Boolean(id),
    );
    if (storageInstanceIds && storageInstanceIds.length > 0) {
      clauses.push(`storage_instance_id IN (${storageInstanceIds.map(() => "?").join(", ")})`);
      params.push(...storageInstanceIds);
    }

    if (query.backendTypes && query.backendTypes.length > 0) {
      clauses.push(`backend_type IN (${query.backendTypes.map(() => "?").join(", ")})`);
      params.push(...query.backendTypes);
    }

    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      clauses.push(`lifecycle_state IN (${query.lifecycleStates.map(() => "?").join(", ")})`);
      params.push(...query.lifecycleStates);
    }

    if (query.accessModes && query.accessModes.length > 0) {
      clauses.push(`access_mode IN (${query.accessModes.map(() => "?").join(", ")})`);
      params.push(...query.accessModes);
    }

    if (query.accessScopes && query.accessScopes.length > 0) {
      clauses.push(`access_scope IN (${query.accessScopes.map(() => "?").join(", ")})`);
      params.push(...query.accessScopes);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM storage_instances
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at DESC, storage_instance_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as StorageInstanceRow[];

    return Object.freeze(rows.map((row) => mapStorageInstanceRowToDomain(row)));
  }

  public async createStorageInstance(
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }> {
    return this.persistStorageInstanceMutation("create-storage-instance", storageInstance, mutation);
  }

  public async saveStorageInstance(
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }> {
    return this.persistStorageInstanceMutation("save-storage-instance", storageInstance, mutation);
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistStorageInstanceMutation(
    mutationKind: StorageMutationKind,
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): StorageInstanceMutationResult & { readonly storageInstance: StorageInstance } {
    const operationKey = this.normalizeOperationKey(mutation.operationKey);
    const replay = this.getMutationReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        storageInstance: replay,
      });
    }

    const normalizedStorageInstanceId = normalizeStorageLookup(storageInstance.id);
    if (!normalizedStorageInstanceId) {
      throw new Error("Storage persistence requires storage instance id.");
    }

    const existing = this.getPersistedStorageInstanceByIdInternal(normalizedStorageInstanceId);
    const result = this.getDatabase().prepare(`
      INSERT INTO storage_instances (
        storage_instance_id,
        display_name,
        backend_type,
        lifecycle_state,
        workspace_id,
        owner_user_identity_id,
        access_mode,
        access_scope,
        replication_mode,
        replica_storage_instance_id,
        sync_interval_seconds,
        policy_id,
        policy_max_object_bytes,
        policy_retention_days,
        policy_immutable_writes,
        policy_allow_cross_workspace_reads,
        policy_labels_json,
        policy_encryption_profile_id,
        policy_encryption_key_reference_id,
        policy_encryption_envelope_required,
        policy_security_encryption_mode,
        policy_security_content_encryption_required,
        policy_security_key_scope,
        policy_security_allow_preview_decryption,
        policy_security_allow_worker_decryption,
        policy_lifecycle_retention_expiry_action,
        policy_lifecycle_purge_grace_period_days,
        backend_binding_reference_id,
        provisioning_reference_id,
        created_by,
        created_at,
        last_modified_by,
        last_modified_at,
        last_correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(storage_instance_id) DO UPDATE SET
        display_name = excluded.display_name,
        backend_type = excluded.backend_type,
        lifecycle_state = excluded.lifecycle_state,
        workspace_id = excluded.workspace_id,
        owner_user_identity_id = excluded.owner_user_identity_id,
        access_mode = excluded.access_mode,
        access_scope = excluded.access_scope,
        replication_mode = excluded.replication_mode,
        replica_storage_instance_id = excluded.replica_storage_instance_id,
        sync_interval_seconds = excluded.sync_interval_seconds,
        policy_id = excluded.policy_id,
        policy_max_object_bytes = excluded.policy_max_object_bytes,
        policy_retention_days = excluded.policy_retention_days,
        policy_immutable_writes = excluded.policy_immutable_writes,
        policy_allow_cross_workspace_reads = excluded.policy_allow_cross_workspace_reads,
        policy_labels_json = excluded.policy_labels_json,
        policy_encryption_profile_id = excluded.policy_encryption_profile_id,
        policy_encryption_key_reference_id = excluded.policy_encryption_key_reference_id,
        policy_encryption_envelope_required = excluded.policy_encryption_envelope_required,
        policy_security_encryption_mode = excluded.policy_security_encryption_mode,
        policy_security_content_encryption_required = excluded.policy_security_content_encryption_required,
        policy_security_key_scope = excluded.policy_security_key_scope,
        policy_security_allow_preview_decryption = excluded.policy_security_allow_preview_decryption,
        policy_security_allow_worker_decryption = excluded.policy_security_allow_worker_decryption,
        policy_lifecycle_retention_expiry_action = excluded.policy_lifecycle_retention_expiry_action,
        policy_lifecycle_purge_grace_period_days = excluded.policy_lifecycle_purge_grace_period_days,
        backend_binding_reference_id = excluded.backend_binding_reference_id,
        provisioning_reference_id = excluded.provisioning_reference_id,
        created_by = excluded.created_by,
        created_at = excluded.created_at,
        last_modified_by = excluded.last_modified_by,
        last_modified_at = excluded.last_modified_at,
        last_correlation_id = excluded.last_correlation_id
      WHERE excluded.last_modified_at >= storage_instances.last_modified_at
    `).run(...mapStorageInstanceToRowValues(storageInstance));

    if (result.changes === 0) {
      const persisted = this.getPersistedStorageInstanceByIdInternal(normalizedStorageInstanceId);
      if (
        persisted
        && persisted.lastModifiedAt > storageInstance.lastModifiedAt
      ) {
        throw new Error(
          `Storage persistence conflict while saving storage instance '${storageInstance.id}': a newer record already exists.`,
        );
      }
    }

    this.persistMutationReplayRecord(operationKey, mutationKind, storageInstance, mutation);

    return Object.freeze({
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(storageInstance),
      wasReplay: false,
      storageInstance,
    });
  }

  private getPersistedStorageInstanceByIdInternal(storageInstanceId: string): StorageInstance | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM storage_instances WHERE storage_instance_id = ? LIMIT 1")
      .get(storageInstanceId) as StorageInstanceRow | undefined;
    return row ? mapStorageInstanceRowToDomain(row) : undefined;
  }

  private getMutationReplayRecord(operationKey: string): StorageInstance | undefined {
    const row = this.getDatabase().prepare(`
      SELECT *
      FROM storage_instance_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as StorageInstanceMutationReplayRow | undefined;

    return row ? parseStorageMutationReplayRecord(row) : undefined;
  }

  private persistMutationReplayRecord(
    operationKey: string,
    mutationKind: StorageMutationKind,
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): void {
    this.getDatabase().prepare(`
      INSERT INTO storage_instance_mutation_replays (
        operation_key,
        mutation_kind,
        storage_instance_id,
        mutation_snapshot_json,
        actor_user_identity_id,
        correlation_id,
        occurred_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      operationKey,
      mutationKind,
      storageInstance.id,
      JSON.stringify(storageInstance),
      mutation.actorUserIdentityId,
      mutation.correlationId ?? null,
      mutation.occurredAt ?? storageInstance.lastModifiedAt,
      new Date().toISOString(),
    );
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

  private toPagingClause(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
    const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : undefined;

    if (normalizedLimit !== undefined && normalizedOffset !== undefined) {
      return {
        sql: "LIMIT ? OFFSET ?",
        params: Object.freeze([normalizedLimit, normalizedOffset]),
      };
    }

    if (normalizedLimit !== undefined) {
      return {
        sql: "LIMIT ?",
        params: Object.freeze([normalizedLimit]),
      };
    }

    if (normalizedOffset !== undefined) {
      return {
        sql: "LIMIT -1 OFFSET ?",
        params: Object.freeze([normalizedOffset]),
      };
    }

    return {
      sql: "",
      params: Object.freeze([]),
    };
  }

  private normalizeOperationKey(value: string): string {
    const normalized = normalizeStorageLookup(value);
    if (!normalized) {
      throw new Error("Storage mutation operationKey is required.");
    }
    return normalized;
  }
}

