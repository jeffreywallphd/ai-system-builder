import fs from "node:fs";
import path from "node:path";
import type {
  GeneratedResultLineageRecord,
  GeneratedResultRecordListQuery,
  IGeneratedResultPersistenceRepository,
} from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import {
  assertExpectedPersistenceRevision,
  nextPersistenceRevision,
} from "@shared/persistence/PersistenceVersioning";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import {
  GENERATED_RESULT_PERSISTENCE_MIGRATIONS,
  GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteGeneratedResultPersistenceMigrations";
import {
  mapGeneratedResultPreviewRowToRecord,
  mapGeneratedResultRowToRecord,
  normalizeGeneratedResultLookup,
  normalizeGeneratedResultOperationKey,
  parseGeneratedResultMutationReplayRow,
  toGeneratedResultPreviewRowValues,
  toGeneratedResultRecordRowValues,
  type GeneratedResultMutationReplayRow,
  type GeneratedResultPreviewRow,
  type GeneratedResultRecordRow,
} from "./GeneratedResultPersistenceMapper";

type ResultMutationKind = "create-result" | "save-result";

export class SqliteGeneratedResultPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements IGeneratedResultPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {
    super("GeneratedResult");
  }

  public async findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined> {
    const normalizedResultAssetId = normalizeGeneratedResultLookup(resultAssetId);
    if (!normalizedResultAssetId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM generated_result_records
      WHERE result_asset_id = ?
      LIMIT 1
    `).get(normalizedResultAssetId) as GeneratedResultRecordRow | undefined;

    if (!row) {
      return undefined;
    }

    return this.hydrateResultRecord(row);
  }

  public async listResults(query: GeneratedResultRecordListQuery): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    const workspaceId = normalizeGeneratedResultLookup(query.workspaceId);
    if (!workspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [workspaceId];

    if (!query.includeArchived) {
      clauses.push("status <> 'archived'");
    }

    this.addOptionalExactClause(clauses, params, "run_id", query.runId);
    this.addOptionalExactClause(clauses, params, "system_id", query.systemId);
    this.addOptionalExactClause(clauses, params, "workflow_id", query.workflowId);
    this.addOptionalExactClause(clauses, params, "workflow_template_id", query.workflowTemplateId);
    this.addOptionalExactClause(clauses, params, "execution_node_id", query.executionNodeId);

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    if (query.visibilities && query.visibilities.length > 0) {
      clauses.push(`visibility IN (${query.visibilities.map(() => "?").join(", ")})`);
      params.push(...query.visibilities);
    }

    if (query.mediaTypes && query.mediaTypes.length > 0) {
      clauses.push(`media_type IN (${query.mediaTypes.map(() => "?").join(", ")})`);
      params.push(...query.mediaTypes);
    }

    if (query.createdAfter) {
      clauses.push("created_at >= ?");
      params.push(query.createdAfter);
    }
    if (query.createdBefore) {
      clauses.push("created_at <= ?");
      params.push(query.createdBefore);
    }
    if (query.updatedAfter) {
      clauses.push("last_modified_at >= ?");
      params.push(query.updatedAfter);
    }
    if (query.updatedBefore) {
      clauses.push("last_modified_at <= ?");
      params.push(query.updatedBefore);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM generated_result_records
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC, result_asset_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as GeneratedResultRecordRow[];

    return Object.freeze(rows.map((row) => this.hydrateResultRecord(row)));
  }

  public async listResultsByRun(input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return this.listResults({
      workspaceId: input.workspaceId,
      runId: input.runId,
      includeArchived: true,
      limit: input.limit,
      offset: input.offset,
    });
  }

  public async createResult(
    record: GeneratedResultPersistenceRecord,
    mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    return this.persistResultMutation({
      mutationKind: "create-result",
      record,
      mutation,
      requireAbsent: true,
    });
  }

  public async saveResult(
    record: GeneratedResultPersistenceRecord,
    mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    return this.persistResultMutation({
      mutationKind: "save-result",
      record,
      mutation,
      requireAbsent: false,
    });
  }

  public async savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>> {
    const operationKey = this.normalizeOperationKey(mutation.operationKey);
    const replay = this.getPreviewReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.getDatabase().prepare(`
      SELECT *
      FROM generated_result_previews
      WHERE derivative_id = ?
      LIMIT 1
    `).get(record.derivativeId) as GeneratedResultPreviewRow | undefined;

    assertExpectedPersistenceRevision(mutation.expectedRevision, existing?.revision, "GeneratedResultPreview");

    const existingRecord = existing ? mapGeneratedResultPreviewRowToRecord(existing) : undefined;
    const changed = !existingRecord || JSON.stringify(existingRecord) !== JSON.stringify(record);
    const revision = changed ? nextPersistenceRevision(existing?.revision) : (existing?.revision ?? 1);
    const persistedRecord: GeneratedResultPreviewPersistenceRecord = Object.freeze({
      ...record,
      revision,
      schemaVersion: GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION,
    });

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        INSERT INTO generated_result_previews (
          derivative_id,
          result_asset_id,
          result_logical_asset_version_id,
          preview_kind,
          availability_status,
          is_primary_preview,
          protected_resource_id,
          access_handle,
          media_type,
          width,
          height,
          byte_size,
          generated_at,
          failure_code,
          failure_message,
          tenancy_scope,
          tenancy_workspace_id,
          tenancy_user_identity_id,
          tenancy_node_id,
          created_at,
          created_by,
          last_modified_at,
          last_modified_by,
          revision,
          schema_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(derivative_id) DO UPDATE SET
          result_asset_id = excluded.result_asset_id,
          result_logical_asset_version_id = excluded.result_logical_asset_version_id,
          preview_kind = excluded.preview_kind,
          availability_status = excluded.availability_status,
          is_primary_preview = excluded.is_primary_preview,
          protected_resource_id = excluded.protected_resource_id,
          access_handle = excluded.access_handle,
          media_type = excluded.media_type,
          width = excluded.width,
          height = excluded.height,
          byte_size = excluded.byte_size,
          generated_at = excluded.generated_at,
          failure_code = excluded.failure_code,
          failure_message = excluded.failure_message,
          tenancy_scope = excluded.tenancy_scope,
          tenancy_workspace_id = excluded.tenancy_workspace_id,
          tenancy_user_identity_id = excluded.tenancy_user_identity_id,
          tenancy_node_id = excluded.tenancy_node_id,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          last_modified_at = excluded.last_modified_at,
          last_modified_by = excluded.last_modified_by,
          revision = excluded.revision,
          schema_version = excluded.schema_version
        WHERE excluded.last_modified_at >= generated_result_previews.last_modified_at
      `).run(...toGeneratedResultPreviewRowValues({
        record: persistedRecord,
        revision,
        schemaVersion: GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION,
      }));

      this.getDatabase().prepare(`
        INSERT INTO generated_result_preview_mutation_replays (
          operation_key,
          mutation_kind,
          derivative_id,
          mutation_snapshot_json,
          actor_user_id,
          correlation_id,
          reason,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        operationKey,
        "save-preview",
        record.derivativeId,
        JSON.stringify(persistedRecord),
        mutation.context.actorUserId,
        mutation.context.correlationId ?? null,
        mutation.context.reason ?? null,
        this.resolveMutationTimestamp(mutation.context.occurredAt),
        new Date().toISOString(),
      );
    })();

    return Object.freeze({
      record: persistedRecord,
      changed,
      wasReplay: false,
    });
  }

  public async listPreviewsByResultId(resultAssetId: string): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    const normalizedResultAssetId = normalizeGeneratedResultLookup(resultAssetId);
    if (!normalizedResultAssetId) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM generated_result_previews
      WHERE result_asset_id = ?
      ORDER BY is_primary_preview DESC, preview_kind ASC, derivative_id ASC
    `).all(normalizedResultAssetId) as GeneratedResultPreviewRow[];

    return Object.freeze(rows.map((row) => mapGeneratedResultPreviewRowToRecord(row)));
  }

  public async getLineageByResultId(resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined> {
    const record = await this.findResultById(resultAssetId);
    if (!record) {
      return undefined;
    }

    return Object.freeze({
      resultAssetId: record.resultAssetId,
      runId: record.runId,
      systemId: record.systemId,
      workflowId: record.workflowId,
      workflowTemplateId: record.workflowTemplateId,
      executionNodeId: record.executionNodeId,
      outputSlot: record.outputSlot,
      inputAssetIds: record.inputAssetIds,
      workflowTemplateVersionId: record.workflowTemplateVersionId,
      workflowTemplateVersionTag: record.workflowTemplateVersionTag,
      systemSnapshotId: record.systemSnapshotId,
      systemVersionTag: record.systemVersionTag,
      parameterSnapshotId: record.parameterSnapshotId,
      selectedNodeId: record.selectedNodeId,
      executionAdapterKind: record.executionAdapterKind,
      executionBackendFamily: record.executionBackendFamily,
      updatedAt: record.lastModifiedAt,
    });
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistResultMutation(input: {
    readonly mutationKind: ResultMutationKind;
    readonly record: GeneratedResultPersistenceRecord;
    readonly mutation: GeneratedResultPersistenceMutationEnvelope;
    readonly requireAbsent: boolean;
  }): GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord> {
    const operationKey = this.normalizeOperationKey(input.mutation.operationKey);
    const replay = this.getResultReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    const existingRow = this.getDatabase().prepare(`
      SELECT *
      FROM generated_result_records
      WHERE result_asset_id = ?
      LIMIT 1
    `).get(input.record.resultAssetId) as GeneratedResultRecordRow | undefined;

    if (input.requireAbsent && existingRow) {
      throw new Error(`Generated result '${input.record.resultAssetId}' already exists.`);
    }

    assertExpectedPersistenceRevision(input.mutation.expectedRevision, existingRow?.revision, "GeneratedResult");

    const existingRecord = existingRow ? this.hydrateResultRecord(existingRow) : undefined;
    const changed = !existingRecord || JSON.stringify(existingRecord) !== JSON.stringify(input.record);
    const revision = changed ? nextPersistenceRevision(existingRow?.revision) : (existingRow?.revision ?? 1);
    const persistedRecord: GeneratedResultPersistenceRecord = Object.freeze({
      ...input.record,
      revision,
      schemaVersion: GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION,
    });

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        INSERT INTO generated_result_records (
          result_asset_id,
          workspace_id,
          owner_user_id,
          run_id,
          system_id,
          workflow_id,
          workflow_template_id,
          execution_node_id,
          output_slot,
          workflow_template_version_id,
          workflow_template_version_tag,
          system_snapshot_id,
          system_version_tag,
          parameter_snapshot_id,
          selected_node_id,
          execution_adapter_kind,
          execution_backend_family,
          visibility,
          sharing_policy_id,
          sharing_policy_version,
          storage_instance_id,
          storage_binding_reference,
          media_type,
          status,
          pending_since,
          logical_asset_version_id,
          persisted_at,
          persisted_by,
          preview_ready_at,
          preview_ready_by,
          failed_at,
          failed_by,
          failure_code,
          failure_message,
          archived_at,
          archived_by,
          tenancy_scope,
          tenancy_workspace_id,
          tenancy_user_identity_id,
          tenancy_node_id,
          created_at,
          created_by,
          last_modified_at,
          last_modified_by,
          revision,
          schema_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(result_asset_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          owner_user_id = excluded.owner_user_id,
          run_id = excluded.run_id,
          system_id = excluded.system_id,
          workflow_id = excluded.workflow_id,
          workflow_template_id = excluded.workflow_template_id,
          execution_node_id = excluded.execution_node_id,
          output_slot = excluded.output_slot,
          workflow_template_version_id = excluded.workflow_template_version_id,
          workflow_template_version_tag = excluded.workflow_template_version_tag,
          system_snapshot_id = excluded.system_snapshot_id,
          system_version_tag = excluded.system_version_tag,
          parameter_snapshot_id = excluded.parameter_snapshot_id,
          selected_node_id = excluded.selected_node_id,
          execution_adapter_kind = excluded.execution_adapter_kind,
          execution_backend_family = excluded.execution_backend_family,
          visibility = excluded.visibility,
          sharing_policy_id = excluded.sharing_policy_id,
          sharing_policy_version = excluded.sharing_policy_version,
          storage_instance_id = excluded.storage_instance_id,
          storage_binding_reference = excluded.storage_binding_reference,
          media_type = excluded.media_type,
          status = excluded.status,
          pending_since = excluded.pending_since,
          logical_asset_version_id = excluded.logical_asset_version_id,
          persisted_at = excluded.persisted_at,
          persisted_by = excluded.persisted_by,
          preview_ready_at = excluded.preview_ready_at,
          preview_ready_by = excluded.preview_ready_by,
          failed_at = excluded.failed_at,
          failed_by = excluded.failed_by,
          failure_code = excluded.failure_code,
          failure_message = excluded.failure_message,
          archived_at = excluded.archived_at,
          archived_by = excluded.archived_by,
          tenancy_scope = excluded.tenancy_scope,
          tenancy_workspace_id = excluded.tenancy_workspace_id,
          tenancy_user_identity_id = excluded.tenancy_user_identity_id,
          tenancy_node_id = excluded.tenancy_node_id,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          last_modified_at = excluded.last_modified_at,
          last_modified_by = excluded.last_modified_by,
          revision = excluded.revision,
          schema_version = excluded.schema_version
        WHERE excluded.last_modified_at >= generated_result_records.last_modified_at
      `).run(...toGeneratedResultRecordRowValues({
        record: persistedRecord,
        revision,
        schemaVersion: GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION,
      }));

      this.getDatabase().prepare("DELETE FROM generated_result_lineage_inputs WHERE result_asset_id = ?")
        .run(persistedRecord.resultAssetId);

      const insertLineageInput = this.getDatabase().prepare(`
        INSERT INTO generated_result_lineage_inputs (
          result_asset_id,
          input_asset_id,
          ordinal
        ) VALUES (?, ?, ?)
      `);

      for (const [index, inputAssetId] of persistedRecord.inputAssetIds.entries()) {
        insertLineageInput.run(persistedRecord.resultAssetId, inputAssetId, index);
      }

      this.getDatabase().prepare(`
        INSERT INTO generated_result_mutation_replays (
          operation_key,
          mutation_kind,
          result_asset_id,
          mutation_snapshot_json,
          actor_user_id,
          correlation_id,
          reason,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        operationKey,
        input.mutationKind,
        persistedRecord.resultAssetId,
        JSON.stringify(persistedRecord),
        input.mutation.context.actorUserId,
        input.mutation.context.correlationId ?? null,
        input.mutation.context.reason ?? null,
        this.resolveMutationTimestamp(input.mutation.context.occurredAt),
        new Date().toISOString(),
      );
    })();

    return Object.freeze({
      record: persistedRecord,
      changed,
      wasReplay: false,
    });
  }

  private hydrateResultRecord(row: GeneratedResultRecordRow): GeneratedResultPersistenceRecord {
    const lineageRows = this.getDatabase().prepare(`
      SELECT input_asset_id
      FROM generated_result_lineage_inputs
      WHERE result_asset_id = ?
      ORDER BY ordinal ASC
    `).all(row.result_asset_id) as Array<{ input_asset_id: string }>;

    return mapGeneratedResultRowToRecord(
      row,
      lineageRows.map((entry) => entry.input_asset_id),
    );
  }

  private getResultReplayRecord(operationKey: string): GeneratedResultPersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT operation_key, mutation_snapshot_json
      FROM generated_result_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as GeneratedResultMutationReplayRow | undefined;

    return row ? parseGeneratedResultMutationReplayRow<GeneratedResultPersistenceRecord>(row) : undefined;
  }

  private getPreviewReplayRecord(operationKey: string): GeneratedResultPreviewPersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT operation_key, mutation_snapshot_json
      FROM generated_result_preview_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as GeneratedResultMutationReplayRow | undefined;

    return row ? parseGeneratedResultMutationReplayRow<GeneratedResultPreviewPersistenceRecord>(row) : undefined;
  }

  private addOptionalExactClause(
    clauses: string[],
    params: unknown[],
    column: string,
    rawValue?: string,
  ): void {
    const value = normalizeGeneratedResultLookup(rawValue);
    if (!value) {
      return;
    }
    clauses.push(`${column} = ?`);
    params.push(value);
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
    if (currentVersion > GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Generated result schema version ${currentVersion} is newer than supported version ${GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of GENERATED_RESULT_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO generated_result_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS generated_result_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM generated_result_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private normalizeOperationKey(operationKey: string): string {
    return normalizeGeneratedResultOperationKey(operationKey);
  }
}
