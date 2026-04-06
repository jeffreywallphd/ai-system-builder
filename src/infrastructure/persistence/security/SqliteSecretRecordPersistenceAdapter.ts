import fs from "node:fs";
import path from "node:path";
import type {
  ISecretRecordPersistenceRepository,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
} from "../../../application/security/ports/SecretServicePorts";
import type { SecretRecord, SecretReference } from "../../../domain/security/SecretDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapSecretRecordRowAndVersionsToDomain,
  mapSecretRecordRowToReference,
  mapSecretRecordToRowValues,
  mapSecretVersionMaterialToRowValues,
  mapSecretVersionToRowValues,
  normalizeSecretLookup,
  parseSecretMutationReplayRecord,
  toScopeId,
  type SecretMutationReplayRow,
  type SecretRecordRow,
  type SecretVersionRow,
} from "./SecretRecordPersistenceMapper";
import {
  SECRET_RECORD_PERSISTENCE_MIGRATIONS,
  SECRET_RECORD_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteSecretRecordPersistenceMigrations";

type SecretMutationKind = "create-secret" | "save-secret" | "delete-secret";

export class SqliteSecretRecordPersistenceAdapter implements ISecretRecordPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    const normalizedSecretId = normalizeSecretLookup(secretId);
    if (!normalizedSecretId) {
      return undefined;
    }

    const recordRow = this.getDatabase().prepare("SELECT * FROM secret_records WHERE secret_id = ? LIMIT 1")
      .get(normalizedSecretId) as SecretRecordRow | undefined;
    if (!recordRow) {
      return undefined;
    }

    return this.mapPersistedRecord(recordRow);
  }

  public async findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
    const normalizedName = normalizeSecretLookup(input.name)?.toLowerCase();
    if (!normalizedName) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM secret_records
      WHERE machine_key_name = ?
        AND scope_type = ?
        AND scope_id = ?
      LIMIT 1
    `).get(
      normalizedName,
      input.owner.scope,
      toScopeId(input.owner),
    ) as SecretRecordRow | undefined;

    return row ? this.mapPersistedRecord(row) : undefined;
  }

  public async listSecrets(query: SecretListQuery): Promise<ReadonlyArray<SecretReference>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.scope) {
      clauses.push("scope_type = ?");
      params.push(query.scope);
    }
    if (query.workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(query.workspaceId);
    }
    if (query.userIdentityId) {
      clauses.push("user_identity_id = ?");
      params.push(query.userIdentityId);
    }
    if (query.kinds?.length) {
      clauses.push(`secret_kind IN (${query.kinds.map(() => "?").join(", ")})`);
      params.push(...query.kinds);
    }

    if (!(query.includeDisabled ?? false)) {
      clauses.push("status != 'disabled'");
    }
    if (!(query.includeArchived ?? false)) {
      clauses.push("status != 'archived'");
    }
    if (!(query.includeSoftDeleted ?? false)) {
      clauses.push("status != 'soft-deleted'");
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM secret_records
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY updated_at DESC, secret_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as SecretRecordRow[];

    let references = rows.map((row) => mapSecretRecordRowToReference(row));

    if (query.tagAnyOf?.length) {
      const normalizedTags = query.tagAnyOf
        .map((tag) => normalizeSecretLookup(tag)?.toLowerCase())
        .filter((tag): tag is string => Boolean(tag));
      if (normalizedTags.length) {
        references = references.filter((reference) => {
          const tags = new Set(reference.metadata.tags.map((tag) => tag.toLowerCase()));
          return normalizedTags.some((tag) => tags.has(tag));
        });
      }
    }

    return Object.freeze(references);
  }

  public async createSecret(
    input: SecretCreatePersistenceInput,
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    return this.persistRecordMutation("create-secret", input.record, input.mutation);
  }

  public async saveSecret(
    record: SecretRecord,
    mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    return this.persistRecordMutation("save-secret", record, mutation);
  }

  public async deleteSecret(secretId: string, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult> {
    const operationKey = this.normalizeOperationKey(mutation.operationKey);
    const replay = this.getMutationReplayRecord<Record<string, unknown>>(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
      });
    }

    const normalizedSecretId = normalizeSecretLookup(secretId);
    if (!normalizedSecretId) {
      this.persistMutationReplayRecord(operationKey, "delete-secret", Object.freeze({ changed: false }));
      return Object.freeze({
        changed: false,
        wasReplay: false,
      });
    }

    const occurredAt = this.resolveMutationTimestamp(mutation.occurredAt);
    const actorId = this.normalizeActorId(mutation.actorId);
    const existing = await this.findSecretById(normalizedSecretId);
    if (!existing) {
      this.persistMutationReplayRecord(operationKey, "delete-secret", Object.freeze({ changed: false }));
      return Object.freeze({
        changed: false,
        wasReplay: false,
      });
    }

    const alreadyDeleted = existing.state === "soft-deleted";

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        UPDATE secret_records
        SET
          status = 'soft-deleted',
          updated_at = ?,
          last_modified_by = ?,
          soft_deleted_at = COALESCE(soft_deleted_at, ?),
          soft_deleted_by = COALESCE(soft_deleted_by, ?)
        WHERE secret_id = ?
      `).run(occurredAt, actorId, occurredAt, actorId, normalizedSecretId);
      this.persistMutationReplayRecord(operationKey, "delete-secret", Object.freeze({ changed: !alreadyDeleted }));
    })();

    return Object.freeze({
      changed: !alreadyDeleted,
      wasReplay: false,
    });
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistRecordMutation(
    mutationKind: Extract<SecretMutationKind, "create-secret" | "save-secret">,
    record: SecretRecord,
    mutation: SecretCreatePersistenceInput["mutation"],
  ): SecretMutationResult & { readonly record: SecretRecord } {
    const operationKey = this.normalizeOperationKey(mutation.operationKey);
    const replay = this.getMutationReplayRecord<SecretRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    const normalizedSecretId = normalizeSecretLookup(record.secretId);
    if (!normalizedSecretId) {
      throw new Error("Secret record secretId is required.");
    }

    const existing = this.getPersistedRecordByIdInternal(normalizedSecretId);
    const changed = !existing || JSON.stringify(existing) !== JSON.stringify(record);

    this.getDatabase().transaction(() => {
      this.upsertSecretRecord(record);
      this.upsertSecretVersions(record);
      this.persistMutationReplayRecord(operationKey, mutationKind, record);
    })();

    return Object.freeze({
      changed,
      wasReplay: false,
      record,
    });
  }

  private upsertSecretRecord(record: SecretRecord): void {
    this.getDatabase().prepare(`
      INSERT INTO secret_records (
        secret_id,
        scope_type,
        scope_id,
        workspace_id,
        user_identity_id,
        machine_key_name,
        display_name,
        metadata_description,
        metadata_tags_json,
        metadata_labels_json,
        sensitivity_markers_json,
        secret_kind,
        status,
        active_version_id,
        protection_policy_json,
        created_at,
        created_by,
        updated_at,
        last_modified_by,
        disabled_at,
        disabled_by,
        archived_at,
        archived_by,
        soft_deleted_at,
        soft_deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(secret_id) DO UPDATE SET
        scope_type = excluded.scope_type,
        scope_id = excluded.scope_id,
        workspace_id = excluded.workspace_id,
        user_identity_id = excluded.user_identity_id,
        machine_key_name = excluded.machine_key_name,
        display_name = excluded.display_name,
        metadata_description = excluded.metadata_description,
        metadata_tags_json = excluded.metadata_tags_json,
        metadata_labels_json = excluded.metadata_labels_json,
        sensitivity_markers_json = excluded.sensitivity_markers_json,
        secret_kind = excluded.secret_kind,
        status = excluded.status,
        active_version_id = excluded.active_version_id,
        protection_policy_json = excluded.protection_policy_json,
        created_at = excluded.created_at,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at,
        last_modified_by = excluded.last_modified_by,
        disabled_at = excluded.disabled_at,
        disabled_by = excluded.disabled_by,
        archived_at = excluded.archived_at,
        archived_by = excluded.archived_by,
        soft_deleted_at = excluded.soft_deleted_at,
        soft_deleted_by = excluded.soft_deleted_by
    `).run(...mapSecretRecordToRowValues(record));
  }

  private upsertSecretVersions(record: SecretRecord): void {
    const persistedVersionIds = new Set(record.versions.map((version) => version.versionId));
    for (const version of record.versions) {
      this.getDatabase().prepare(`
        INSERT INTO secret_versions (
          version_id,
          secret_id,
          version_number,
          state,
          created_at,
          created_by,
          previous_version_id,
          superseded_by_version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(version_id) DO UPDATE SET
          secret_id = excluded.secret_id,
          version_number = excluded.version_number,
          state = excluded.state,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          previous_version_id = excluded.previous_version_id,
          superseded_by_version_id = excluded.superseded_by_version_id
      `).run(...mapSecretVersionToRowValues(version));

      this.getDatabase().prepare(`
        INSERT INTO secret_version_material (
          version_id,
          encrypted_payload_ref,
          encrypted_payload_blob,
          payload_digest_sha256,
          payload_byte_length,
          key_encryption_context_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(version_id) DO UPDATE SET
          encrypted_payload_ref = excluded.encrypted_payload_ref,
          encrypted_payload_blob = excluded.encrypted_payload_blob,
          payload_digest_sha256 = excluded.payload_digest_sha256,
          payload_byte_length = excluded.payload_byte_length,
          key_encryption_context_json = excluded.key_encryption_context_json,
          created_at = excluded.created_at
      `).run(...mapSecretVersionMaterialToRowValues(version));
    }

    const existingRows = this.getDatabase().prepare(`
      SELECT version_id
      FROM secret_versions
      WHERE secret_id = ?
    `).all(record.secretId) as Array<{ version_id: string }>;

    for (const existing of existingRows) {
      if (persistedVersionIds.has(existing.version_id)) {
        continue;
      }
      this.getDatabase().prepare("DELETE FROM secret_version_material WHERE version_id = ?").run(existing.version_id);
      this.getDatabase().prepare("DELETE FROM secret_versions WHERE version_id = ?").run(existing.version_id);
    }
  }

  private mapPersistedRecord(recordRow: SecretRecordRow): SecretRecord {
    const versions = this.getDatabase().prepare(`
      SELECT
        sv.version_id,
        sv.secret_id,
        sv.version_number,
        sv.state,
        sv.created_at,
        sv.created_by,
        sv.previous_version_id,
        sv.superseded_by_version_id,
        svm.encrypted_payload_ref,
        svm.payload_digest_sha256,
        svm.payload_byte_length,
        svm.key_encryption_context_json
      FROM secret_versions sv
      INNER JOIN secret_version_material svm
        ON svm.version_id = sv.version_id
      WHERE sv.secret_id = ?
      ORDER BY sv.version_number ASC
    `).all(recordRow.secret_id) as SecretVersionRow[];

    return mapSecretRecordRowAndVersionsToDomain(recordRow, versions);
  }

  private getPersistedRecordByIdInternal(secretId: string): SecretRecord | undefined {
    const recordRow = this.getDatabase().prepare("SELECT * FROM secret_records WHERE secret_id = ? LIMIT 1")
      .get(secretId) as SecretRecordRow | undefined;
    return recordRow ? this.mapPersistedRecord(recordRow) : undefined;
  }

  private getMutationReplayRecord<TRecord>(operationKey: string): TRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT *
      FROM secret_record_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as SecretMutationReplayRow | undefined;
    return row ? parseSecretMutationReplayRecord<TRecord>(row) : undefined;
  }

  private persistMutationReplayRecord(operationKey: string, mutationKind: SecretMutationKind, snapshot: unknown): void {
    this.getDatabase().prepare(`
      INSERT INTO secret_record_mutation_replays (
        operation_key,
        mutation_kind,
        mutation_snapshot_json,
        created_at
      ) VALUES (?, ?, ?, ?)
    `).run(operationKey, mutationKind, JSON.stringify(snapshot), new Date().toISOString());
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
    if (currentVersion > SECRET_RECORD_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Secret record schema version ${currentVersion} is newer than supported version ${SECRET_RECORD_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of SECRET_RECORD_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO secret_record_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS secret_record_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM secret_record_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private toPagingClause(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
    const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : undefined;

    if (normalizedLimit !== undefined && normalizedOffset !== undefined) {
      return { sql: "LIMIT ? OFFSET ?", params: Object.freeze([normalizedLimit, normalizedOffset]) };
    }
    if (normalizedLimit !== undefined) {
      return { sql: "LIMIT ?", params: Object.freeze([normalizedLimit]) };
    }
    if (normalizedOffset !== undefined) {
      return { sql: "LIMIT -1 OFFSET ?", params: Object.freeze([normalizedOffset]) };
    }

    return { sql: "", params: Object.freeze([]) };
  }

  private normalizeOperationKey(value: string): string {
    const normalized = normalizeSecretLookup(value);
    if (!normalized) {
      throw new Error("Secret mutation operationKey is required.");
    }
    return normalized;
  }

  private normalizeActorId(value: string): string {
    const normalized = normalizeSecretLookup(value);
    if (!normalized) {
      throw new Error("Secret mutation actorId is required.");
    }
    return normalized;
  }

  private resolveMutationTimestamp(candidate?: string): string {
    const normalized = candidate?.trim();
    return normalized && normalized.length > 0 ? normalized : new Date().toISOString();
  }
}
