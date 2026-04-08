import fs from "node:fs";
import path from "node:path";
import type {
  DeploymentPolicyOverrideHistoryQuery,
  DeploymentPolicyOverrideLookupQuery,
  IDeploymentPolicyPersistenceRepository,
  RemoveDeploymentPolicyOverridePersistenceRecordInput,
  SaveDeploymentPolicyEffectiveMetadataInput,
  UpsertDeploymentPolicyOverridePersistenceRecordInput,
} from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import type {
  DeploymentPolicyActiveProfileSelectionRecord,
  DeploymentPolicyEffectiveMetadataRecord,
  DeploymentPolicyOverrideHistoryOperationKind,
  DeploymentPolicyOverrideHistoryRecord,
  DeploymentPolicyOverridePersistenceRecord,
  DeploymentPolicyPersistenceMutationEnvelope,
  DeploymentPolicyPersistenceMutationResult,
  DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  DeploymentPolicyOverrideHistoryOperationKinds,
  normalizeDeploymentPolicyMutationOperationKey,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  DEPLOYMENT_POLICY_PERSISTENCE_MIGRATIONS,
  DEPLOYMENT_POLICY_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteDeploymentPolicyPersistenceMigrations";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import {
  resolvePersistenceMutationCreatedAt,
  resolvePersistenceMutationMetadata,
} from "../common/PersistenceMutationMetadata";
import {
  mapActiveProfileSelectionRecordToRowValues,
  mapActiveProfileSelectionRowToRecord,
  mapEffectiveMetadataRecordToRowValues,
  mapEffectiveMetadataRowToRecord,
  mapOverrideHistoryRecordToRowValues,
  mapOverrideHistoryRowToRecord,
  mapOverrideRecordToRowValues,
  mapOverrideRowToRecord,
  type DeploymentPolicyActiveProfileSelectionRow,
  type DeploymentPolicyEffectiveMetadataRow,
  type DeploymentPolicyOverrideHistoryRow,
  type DeploymentPolicyOverrideRow,
} from "./DeploymentPolicyPersistenceMapper";

type DeploymentPolicyMutationKind =
  | "set-active-profile"
  | "upsert-override"
  | "remove-override"
  | "save-effective-metadata";

interface DeploymentPolicyMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: DeploymentPolicyMutationKind;
  readonly record_snapshot_json: string;
  readonly created_at: string;
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeScope(scope: DeploymentPolicyPersistenceScope): DeploymentPolicyPersistenceScope {
  return Object.freeze({
    ...scope,
    scopeId: normalizeLookup(scope.scopeId),
  });
}

function createOverrideHistoryRecord(input: {
  readonly operation: DeploymentPolicyOverrideHistoryOperationKind;
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId: string;
  readonly familyId: string;
  readonly settingKey: string;
  readonly record?: DeploymentPolicyOverridePersistenceRecord;
  readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
  readonly revision: number;
}): DeploymentPolicyOverrideHistoryRecord {
  const occurredAt = resolvePersistenceMutationCreatedAt(input.mutation.context.occurredAt);
  const actor = normalizeLookup(input.mutation.context.actorUserIdentityId);
  const operationKey = normalizeDeploymentPolicyMutationOperationKey(input.mutation.operationKey);
  return Object.freeze({
    changeId: [
      "deployment-policy-change",
      normalizeLookup(input.scope.scopeId),
      normalizeLookup(input.profileId),
      normalizeLookup(input.familyId),
      normalizeLookup(input.settingKey),
      input.operation,
      operationKey,
    ].join(":"),
    scope: input.scope,
    profileId: input.profileId as DeploymentPolicyOverrideHistoryRecord["profileId"],
    familyId: normalizeLookup(input.familyId),
    settingKey: input.settingKey.trim(),
    operation: input.operation,
    value: input.record?.value,
    valueType: input.record?.valueType,
    provenance: input.record?.provenance,
    operationKey,
    changedAt: occurredAt,
    changedByUserIdentityId: actor,
    reason: input.mutation.context.reason,
    ticketReference: input.mutation.context.ticketReference ?? input.record?.provenance?.ticketReference,
    correlationId: input.mutation.context.correlationId,
    revision: input.revision,
  });
}

export class SqliteDeploymentPolicyPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements IDeploymentPolicyPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {
    super("DeploymentPolicy");
  }

  public async getActiveProfileSelection(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyActiveProfileSelectionRecord | undefined> {
    const normalizedScope = normalizeScope(scope);
    const row = this.getDatabase().prepare(`
      SELECT
        scope_kind,
        scope_id,
        profile_id,
        changed_at,
        changed_by_user_identity_id,
        reason,
        ticket_reference,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM deployment_policy_active_profile_selection
      WHERE scope_kind = ?
        AND scope_id = ?
      LIMIT 1
    `).get(normalizedScope.kind, normalizedScope.scopeId) as DeploymentPolicyActiveProfileSelectionRow | undefined;

    return row ? mapActiveProfileSelectionRowToRecord(row) : undefined;
  }

  public async setActiveProfileSelection(input: {
    readonly record: DeploymentPolicyActiveProfileSelectionRecord;
    readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
  }): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>> {
    const operationKey = normalizeDeploymentPolicyMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<DeploymentPolicyActiveProfileSelectionRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let persisted: DeploymentPolicyActiveProfileSelectionRecord | undefined;

    this.getDatabase().transaction(() => {
      const record = this.normalizeActiveProfileRecord(input.record);
      const existing = this.getActiveProfileSelectionInternal(record.scope);
      const metadata = resolvePersistenceMutationMetadata({
        existing,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
        actorId: normalizeLookup(input.mutation.context.actorUserIdentityId),
        expectedRevision: input.mutation.expectedRevision,
        occurredAt: input.mutation.context.occurredAt,
        entityName: "Deployment policy active profile selection",
      });

      persisted = Object.freeze({
        ...record,
        changedAt: resolvePersistenceMutationCreatedAt(input.mutation.context.occurredAt),
        changedByUserIdentityId: normalizeLookup(input.mutation.context.actorUserIdentityId),
        reason: input.mutation.context.reason ?? record.reason,
        ticketReference: input.mutation.context.ticketReference ?? record.ticketReference,
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        lastModifiedAt: metadata.lastModifiedAt,
        lastModifiedBy: metadata.lastModifiedBy,
        revision: metadata.revision,
      });

      this.executeMutation("set active profile selection", () => this.getDatabase().prepare(`
          INSERT INTO deployment_policy_active_profile_selection (
            scope_kind,
            scope_id,
            profile_id,
            changed_at,
            changed_by_user_identity_id,
            reason,
            ticket_reference,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(scope_kind, scope_id) DO UPDATE SET
            profile_id = excluded.profile_id,
            changed_at = excluded.changed_at,
            changed_by_user_identity_id = excluded.changed_by_user_identity_id,
            reason = excluded.reason,
            ticket_reference = excluded.ticket_reference,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > deployment_policy_active_profile_selection.revision
        `).run(...mapActiveProfileSelectionRecordToRowValues(persisted as DeploymentPolicyActiveProfileSelectionRecord)));

      this.persistMutationReplayRecord(operationKey, "set-active-profile", persisted as DeploymentPolicyActiveProfileSelectionRecord);
    })();

    return Object.freeze({
      record: persisted as DeploymentPolicyActiveProfileSelectionRecord,
      changed: true,
      wasReplay: false,
    });
  }

  public async listOverrideRecords(
    query: DeploymentPolicyOverrideLookupQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>> {
    const clauses = ["scope_kind = ?", "scope_id = ?"];
    const params: unknown[] = [query.scope.kind, normalizeLookup(query.scope.scopeId)];

    if (query.profileId) {
      clauses.push("profile_id = ?");
      params.push(query.profileId);
    }
    if (query.familyId) {
      clauses.push("family_id = ?");
      params.push(normalizeLookup(query.familyId));
    }
    if (query.settingKey) {
      clauses.push("setting_key = ?");
      params.push(query.settingKey.trim());
    }

    const rows = this.getDatabase().prepare(`
      SELECT
        scope_kind,
        scope_id,
        profile_id,
        family_id,
        setting_key,
        value_type,
        value_string,
        value_number,
        value_boolean,
        provenance_actor_user_identity_id,
        provenance_ticket_reference,
        provenance_reason,
        provenance_updated_at,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM deployment_policy_overrides
      WHERE ${clauses.join(" AND ")}
      ORDER BY family_id ASC, setting_key ASC
    `).all(...params) as DeploymentPolicyOverrideRow[];

    return Object.freeze(rows.map((row) => mapOverrideRowToRecord(row)));
  }

  public async upsertOverrideRecord(
    input: UpsertDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverridePersistenceRecord>> {
    const operationKey = normalizeDeploymentPolicyMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<DeploymentPolicyOverridePersistenceRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let persisted: DeploymentPolicyOverridePersistenceRecord | undefined;

    this.getDatabase().transaction(() => {
      const record = this.normalizeOverrideRecord(input.record);
      const existing = this.getOverrideRecordInternal({
        scope: record.scope,
        profileId: record.profileId,
        familyId: record.familyId,
        settingKey: record.settingKey,
      });

      const metadata = resolvePersistenceMutationMetadata({
        existing,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
        actorId: normalizeLookup(input.mutation.context.actorUserIdentityId),
        expectedRevision: input.mutation.expectedRevision,
        occurredAt: input.mutation.context.occurredAt,
        entityName: "Deployment policy override",
      });

      persisted = Object.freeze({
        ...record,
        provenance: Object.freeze({
          ...(record.provenance ?? {}),
          actorUserIdentityId: normalizeLookup(input.mutation.context.actorUserIdentityId),
          ticketReference: input.mutation.context.ticketReference ?? record.provenance?.ticketReference,
          reason: input.mutation.context.reason ?? record.provenance?.reason,
          updatedAt: resolvePersistenceMutationCreatedAt(input.mutation.context.occurredAt),
        }),
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        lastModifiedAt: metadata.lastModifiedAt,
        lastModifiedBy: metadata.lastModifiedBy,
        revision: metadata.revision,
      });

      this.executeMutation("upsert deployment policy override", () => this.getDatabase().prepare(`
          INSERT INTO deployment_policy_overrides (
            scope_kind,
            scope_id,
            profile_id,
            family_id,
            setting_key,
            value_type,
            value_string,
            value_number,
            value_boolean,
            provenance_actor_user_identity_id,
            provenance_ticket_reference,
            provenance_reason,
            provenance_updated_at,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(scope_kind, scope_id, profile_id, family_id, setting_key) DO UPDATE SET
            value_type = excluded.value_type,
            value_string = excluded.value_string,
            value_number = excluded.value_number,
            value_boolean = excluded.value_boolean,
            provenance_actor_user_identity_id = excluded.provenance_actor_user_identity_id,
            provenance_ticket_reference = excluded.provenance_ticket_reference,
            provenance_reason = excluded.provenance_reason,
            provenance_updated_at = excluded.provenance_updated_at,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > deployment_policy_overrides.revision
        `).run(...mapOverrideRecordToRowValues(persisted as DeploymentPolicyOverridePersistenceRecord)));

      const historyRecord = createOverrideHistoryRecord({
        operation: DeploymentPolicyOverrideHistoryOperationKinds.upsert,
        scope: persisted!.scope,
        profileId: persisted!.profileId,
        familyId: persisted!.familyId,
        settingKey: persisted!.settingKey,
        record: persisted!,
        mutation: input.mutation,
        revision: persisted!.revision,
      });
      this.insertOverrideHistoryRecord(historyRecord);
      this.persistMutationReplayRecord(operationKey, "upsert-override", persisted as DeploymentPolicyOverridePersistenceRecord);
    })();

    return Object.freeze({
      record: persisted as DeploymentPolicyOverridePersistenceRecord,
      changed: true,
      wasReplay: false,
    });
  }
  public async removeOverrideRecord(
    input: RemoveDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverrideHistoryRecord>> {
    const operationKey = normalizeDeploymentPolicyMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<DeploymentPolicyOverrideHistoryRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let historyRecord: DeploymentPolicyOverrideHistoryRecord | undefined;

    this.getDatabase().transaction(() => {
      const normalizedScope = normalizeScope(input.scope);
      const existing = this.getOverrideRecordInternal({
        scope: normalizedScope,
        profileId: input.profileId,
        familyId: input.familyId,
        settingKey: input.settingKey,
      });
      if (!existing) {
        throw new Error(
          `Deployment policy override '${input.profileId}.${input.familyId}.${input.settingKey}' was not found for scope '${normalizedScope.scopeId}'.`,
        );
      }

      const expectedRevision = input.mutation.expectedRevision;
      if (expectedRevision !== undefined && expectedRevision !== existing.revision) {
        throw new Error(
          `Deployment policy override '${input.profileId}.${input.familyId}.${input.settingKey}' expected revision '${expectedRevision}' but found '${existing.revision}'.`,
        );
      }

      const result = this.executeMutation("remove deployment policy override", () => this.getDatabase().prepare(`
          DELETE FROM deployment_policy_overrides
          WHERE scope_kind = ?
            AND scope_id = ?
            AND profile_id = ?
            AND family_id = ?
            AND setting_key = ?
        `).run(
        normalizedScope.kind,
        normalizedScope.scopeId,
        input.profileId,
        normalizeLookup(input.familyId),
        input.settingKey.trim(),
      ));
      if (result.changes < 1) {
        throw new Error(
          `Deployment policy override '${input.profileId}.${input.familyId}.${input.settingKey}' could not be removed.`,
        );
      }

      historyRecord = createOverrideHistoryRecord({
        operation: DeploymentPolicyOverrideHistoryOperationKinds.remove,
        scope: normalizedScope,
        profileId: input.profileId,
        familyId: input.familyId,
        settingKey: input.settingKey,
        record: existing,
        mutation: input.mutation,
        revision: existing.revision + 1,
      });

      this.insertOverrideHistoryRecord(historyRecord as DeploymentPolicyOverrideHistoryRecord);
      this.persistMutationReplayRecord(operationKey, "remove-override", historyRecord as DeploymentPolicyOverrideHistoryRecord);
    })();

    return Object.freeze({
      record: historyRecord as DeploymentPolicyOverrideHistoryRecord,
      changed: true,
      wasReplay: false,
    });
  }

  public async listOverrideHistory(
    query: DeploymentPolicyOverrideHistoryQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverrideHistoryRecord>> {
    const clauses = ["scope_kind = ?", "scope_id = ?"];
    const params: unknown[] = [query.scope.kind, normalizeLookup(query.scope.scopeId)];

    if (query.profileId) {
      clauses.push("profile_id = ?");
      params.push(query.profileId);
    }
    if (query.familyId) {
      clauses.push("family_id = ?");
      params.push(normalizeLookup(query.familyId));
    }
    if (query.settingKey) {
      clauses.push("setting_key = ?");
      params.push(query.settingKey.trim());
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        change_id,
        scope_kind,
        scope_id,
        profile_id,
        family_id,
        setting_key,
        operation,
        value_type,
        value_string,
        value_number,
        value_boolean,
        provenance_actor_user_identity_id,
        provenance_ticket_reference,
        provenance_reason,
        provenance_updated_at,
        operation_key,
        changed_at,
        changed_by_user_identity_id,
        reason,
        ticket_reference,
        correlation_id,
        revision
      FROM deployment_policy_override_history
      WHERE ${clauses.join(" AND ")}
      ORDER BY changed_at DESC, change_id DESC
      ${paging.sql}
    `).all(...params, ...paging.params) as DeploymentPolicyOverrideHistoryRow[];

    return Object.freeze(rows.map((row) => mapOverrideHistoryRowToRecord(row)));
  }

  public async getEffectivePolicyMetadata(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyEffectiveMetadataRecord | undefined> {
    const normalizedScope = normalizeScope(scope);
    const row = this.getDatabase().prepare(`
      SELECT
        scope_kind,
        scope_id,
        profile_id,
        evaluated_at,
        evaluation_layer,
        contract_version,
        family_count,
        setting_count,
        source_counts_json,
        validation_json,
        recorded_at,
        recorded_by_user_identity_id,
        revision
      FROM deployment_policy_effective_metadata
      WHERE scope_kind = ?
        AND scope_id = ?
      LIMIT 1
    `).get(normalizedScope.kind, normalizedScope.scopeId) as DeploymentPolicyEffectiveMetadataRow | undefined;

    return row ? mapEffectiveMetadataRowToRecord(row) : undefined;
  }

  public async saveEffectivePolicyMetadata(
    input: SaveDeploymentPolicyEffectiveMetadataInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>> {
    const operationKey = normalizeDeploymentPolicyMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<DeploymentPolicyEffectiveMetadataRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let persisted: DeploymentPolicyEffectiveMetadataRecord | undefined;

    this.getDatabase().transaction(() => {
      const record = this.normalizeEffectiveMetadataRecord(input.record);
      const existing = this.getEffectivePolicyMetadataInternal(record.scope);
      const metadata = resolvePersistenceMutationMetadata({
        existing,
        createdAt: existing?.recordedAt ?? record.recordedAt,
        createdBy: existing?.recordedByUserIdentityId ?? record.recordedByUserIdentityId,
        actorId: normalizeLookup(input.mutation.context.actorUserIdentityId),
        expectedRevision: input.mutation.expectedRevision,
        occurredAt: input.mutation.context.occurredAt,
        entityName: "Deployment policy effective metadata",
      });

      persisted = Object.freeze({
        ...record,
        recordedAt: metadata.lastModifiedAt,
        recordedByUserIdentityId: metadata.lastModifiedBy,
        revision: metadata.revision,
      });

      this.executeMutation("save deployment policy effective metadata", () => this.getDatabase().prepare(`
          INSERT INTO deployment_policy_effective_metadata (
            scope_kind,
            scope_id,
            profile_id,
            evaluated_at,
            evaluation_layer,
            contract_version,
            family_count,
            setting_count,
            source_counts_json,
            validation_json,
            recorded_at,
            recorded_by_user_identity_id,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(scope_kind, scope_id) DO UPDATE SET
            profile_id = excluded.profile_id,
            evaluated_at = excluded.evaluated_at,
            evaluation_layer = excluded.evaluation_layer,
            contract_version = excluded.contract_version,
            family_count = excluded.family_count,
            setting_count = excluded.setting_count,
            source_counts_json = excluded.source_counts_json,
            validation_json = excluded.validation_json,
            recorded_at = excluded.recorded_at,
            recorded_by_user_identity_id = excluded.recorded_by_user_identity_id,
            revision = excluded.revision
          WHERE excluded.revision > deployment_policy_effective_metadata.revision
        `).run(...mapEffectiveMetadataRecordToRowValues(persisted as DeploymentPolicyEffectiveMetadataRecord)));

      this.persistMutationReplayRecord(
        operationKey,
        "save-effective-metadata",
        persisted as DeploymentPolicyEffectiveMetadataRecord,
      );
    })();

    return Object.freeze({
      record: persisted as DeploymentPolicyEffectiveMetadataRecord,
      changed: true,
      wasReplay: false,
    });
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
    if (currentVersion > DEPLOYMENT_POLICY_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Deployment policy schema version ${currentVersion} is newer than supported version ${DEPLOYMENT_POLICY_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of DEPLOYMENT_POLICY_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO deployment_policy_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS deployment_policy_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM deployment_policy_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
  private getMutationReplayRecord<TRecord>(operationKey: string): TRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        operation_key,
        mutation_kind,
        record_snapshot_json,
        created_at
      FROM deployment_policy_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as DeploymentPolicyMutationReplayRow | undefined;

    if (!row) {
      return undefined;
    }
    return JSON.parse(row.record_snapshot_json) as TRecord;
  }

  private persistMutationReplayRecord(
    operationKey: string,
    mutationKind: DeploymentPolicyMutationKind,
    record: unknown,
  ): void {
    this.executeMutation("persist deployment policy mutation replay", () => this.getDatabase().prepare(`
        INSERT INTO deployment_policy_mutation_replays (
          operation_key,
          mutation_kind,
          record_snapshot_json,
          created_at
        ) VALUES (?, ?, ?, ?)
      `).run(
      operationKey,
      mutationKind,
      JSON.stringify(record),
      new Date().toISOString(),
    ));
  }

  private getActiveProfileSelectionInternal(
    scope: DeploymentPolicyPersistenceScope,
  ): DeploymentPolicyActiveProfileSelectionRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        scope_kind,
        scope_id,
        profile_id,
        changed_at,
        changed_by_user_identity_id,
        reason,
        ticket_reference,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM deployment_policy_active_profile_selection
      WHERE scope_kind = ?
        AND scope_id = ?
      LIMIT 1
    `).get(scope.kind, scope.scopeId) as DeploymentPolicyActiveProfileSelectionRow | undefined;

    return row ? mapActiveProfileSelectionRowToRecord(row) : undefined;
  }

  private getOverrideRecordInternal(input: {
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly profileId: string;
    readonly familyId: string;
    readonly settingKey: string;
  }): DeploymentPolicyOverridePersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        scope_kind,
        scope_id,
        profile_id,
        family_id,
        setting_key,
        value_type,
        value_string,
        value_number,
        value_boolean,
        provenance_actor_user_identity_id,
        provenance_ticket_reference,
        provenance_reason,
        provenance_updated_at,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM deployment_policy_overrides
      WHERE scope_kind = ?
        AND scope_id = ?
        AND profile_id = ?
        AND family_id = ?
        AND setting_key = ?
      LIMIT 1
    `).get(
      input.scope.kind,
      input.scope.scopeId,
      input.profileId,
      normalizeLookup(input.familyId),
      input.settingKey.trim(),
    ) as DeploymentPolicyOverrideRow | undefined;
    return row ? mapOverrideRowToRecord(row) : undefined;
  }

  private getEffectivePolicyMetadataInternal(
    scope: DeploymentPolicyPersistenceScope,
  ): DeploymentPolicyEffectiveMetadataRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        scope_kind,
        scope_id,
        profile_id,
        evaluated_at,
        evaluation_layer,
        contract_version,
        family_count,
        setting_count,
        source_counts_json,
        validation_json,
        recorded_at,
        recorded_by_user_identity_id,
        revision
      FROM deployment_policy_effective_metadata
      WHERE scope_kind = ?
        AND scope_id = ?
      LIMIT 1
    `).get(scope.kind, scope.scopeId) as DeploymentPolicyEffectiveMetadataRow | undefined;
    return row ? mapEffectiveMetadataRowToRecord(row) : undefined;
  }

  private insertOverrideHistoryRecord(record: DeploymentPolicyOverrideHistoryRecord): void {
    this.executeMutation("insert deployment policy override history", () => this.getDatabase().prepare(`
        INSERT INTO deployment_policy_override_history (
          change_id,
          scope_kind,
          scope_id,
          profile_id,
          family_id,
          setting_key,
          operation,
          value_type,
          value_string,
          value_number,
          value_boolean,
          provenance_actor_user_identity_id,
          provenance_ticket_reference,
          provenance_reason,
          provenance_updated_at,
          operation_key,
          changed_at,
          changed_by_user_identity_id,
          reason,
          ticket_reference,
          correlation_id,
          revision,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...mapOverrideHistoryRecordToRowValues(record)));
  }

  private normalizeActiveProfileRecord(
    record: DeploymentPolicyActiveProfileSelectionRecord,
  ): DeploymentPolicyActiveProfileSelectionRecord {
    return Object.freeze({
      ...record,
      scope: normalizeScope(record.scope),
      changedByUserIdentityId: normalizeLookup(record.changedByUserIdentityId),
      createdBy: normalizeLookup(record.createdBy),
      lastModifiedBy: normalizeLookup(record.lastModifiedBy),
    });
  }

  private normalizeOverrideRecord(record: DeploymentPolicyOverridePersistenceRecord): DeploymentPolicyOverridePersistenceRecord {
    return Object.freeze({
      ...record,
      scope: normalizeScope(record.scope),
      familyId: normalizeLookup(record.familyId),
      settingKey: record.settingKey.trim(),
      createdBy: normalizeLookup(record.createdBy),
      lastModifiedBy: normalizeLookup(record.lastModifiedBy),
    });
  }

  private normalizeEffectiveMetadataRecord(
    record: DeploymentPolicyEffectiveMetadataRecord,
  ): DeploymentPolicyEffectiveMetadataRecord {
    return Object.freeze({
      ...record,
      scope: normalizeScope(record.scope),
      recordedByUserIdentityId: normalizeLookup(record.recordedByUserIdentityId),
    });
  }
}
