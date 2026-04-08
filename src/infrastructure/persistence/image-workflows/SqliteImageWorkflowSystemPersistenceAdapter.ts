import fs from "node:fs";
import path from "node:path";
import type {
  IImageSystemDefinitionRepository,
  IImageWorkflowDefinitionRepository,
  ImageSystemDefinitionListQuery,
  ImageWorkflowDefinitionListQuery,
  ImageWorkflowSystemMutationContext,
  ImageWorkflowSystemMutationResult,
  ImageWorkflowVersionSelector,
} from "@application/image-workflows/ports";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowLifecycleStates,
  transitionImageWorkflowLifecycle,
  type ImageWorkflowBackendTranslationReference,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageSystemLifecycleStates,
  transitionImageSystemLifecycle,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import {
  assertExpectedPersistenceRevision,
  nextPersistenceRevision,
} from "@shared/persistence/PersistenceVersioning";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import {
  IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_MIGRATIONS,
  IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteImageWorkflowSystemPersistenceMigrations";
import {
  mapImageSystemDefinitionRowToDomain,
  mapImageSystemDefinitionToRowValues,
  mapImageWorkflowDefinitionRowToDomain,
  mapImageWorkflowDefinitionToRowValues,
  normalizeImageWorkflowSystemLookup,
  normalizeImageWorkflowSystemOperationKey,
  parseSystemMutationReplayRow,
  parseTagsJson,
  parseWorkflowMutationReplayRow,
  type ImageSystemDefinitionRecordRow,
  type ImageWorkflowDefinitionRecordRow,
  type ImageWorkflowSystemMutationReplayRow,
} from "./ImageWorkflowSystemPersistenceMapper";

type WorkflowMutationKind =
  | "create-workflow-definition"
  | "save-workflow-definition"
  | "archive-workflow-definition";

type SystemMutationKind =
  | "create-system-definition"
  | "save-system-definition"
  | "archive-system-definition";

interface PersistWorkflowMutationOptions {
  readonly mutationKind: WorkflowMutationKind;
  readonly workflow: ImageWorkflowDefinition;
  readonly mutation: ImageWorkflowSystemMutationContext;
  readonly requireExisting: boolean;
  readonly requireAbsent: boolean;
}

interface PersistSystemMutationOptions {
  readonly mutationKind: SystemMutationKind;
  readonly system: ImageSystemDefinition;
  readonly mutation: ImageWorkflowSystemMutationContext;
  readonly requireExisting: boolean;
  readonly requireAbsent: boolean;
}

export class SqliteImageWorkflowSystemPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements IImageWorkflowDefinitionRepository, IImageSystemDefinitionRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {
    super("ImageWorkflowSystem");
  }

  public async findWorkflowDefinitionById(
    workflowId: string,
    query: {
      readonly workspaceId: string;
      readonly includeRetired?: boolean;
    },
  ): Promise<ImageWorkflowDefinition | undefined> {
    const normalizedWorkflowId = normalizeImageWorkflowSystemLookup(workflowId);
    const normalizedWorkspaceId = normalizeImageWorkflowSystemLookup(query.workspaceId);
    if (!normalizedWorkflowId || !normalizedWorkspaceId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_workflow_definition_records
      WHERE workflow_id = ?
        AND workspace_id = ?
      LIMIT 1
    `).get(normalizedWorkflowId, normalizedWorkspaceId) as ImageWorkflowDefinitionRecordRow | undefined;

    if (!row) {
      return undefined;
    }

    if (!query.includeRetired && row.lifecycle_state === ImageWorkflowLifecycleStates.retired) {
      return undefined;
    }

    return mapImageWorkflowDefinitionRowToDomain(row);
  }

  public async resolveWorkflowDefinitionVersion(
    query: {
      readonly workspaceId: string;
      readonly selector: ImageWorkflowVersionSelector;
    },
  ): Promise<ImageWorkflowDefinition | undefined> {
    const normalizedWorkspaceId = normalizeImageWorkflowSystemLookup(query.workspaceId);
    if (!normalizedWorkspaceId) {
      return undefined;
    }

    const selector = query.selector;
    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [normalizedWorkspaceId];

    switch (selector.strategy) {
      case "workflow-id": {
        const workflowId = normalizeImageWorkflowSystemLookup(selector.workflowId);
        if (!workflowId) {
          return undefined;
        }
        clauses.push("workflow_id = ?");
        params.push(workflowId);
        break;
      }
      case "lineage-version-tag": {
        const lineageId = normalizeImageWorkflowSystemLookup(selector.lineageId);
        const versionTag = normalizeImageWorkflowSystemLookup(selector.versionTag);
        if (!lineageId || !versionTag) {
          return undefined;
        }
        clauses.push("lineage_id = ?");
        clauses.push("version_tag = ?");
        params.push(lineageId, versionTag);
        break;
      }
      case "lineage-revision": {
        const lineageId = normalizeImageWorkflowSystemLookup(selector.lineageId);
        if (!lineageId || !Number.isInteger(selector.revision)) {
          return undefined;
        }
        clauses.push("lineage_id = ?");
        clauses.push("revision = ?");
        params.push(lineageId, selector.revision);
        break;
      }
      case "latest-revision-in-lineage": {
        const lineageId = normalizeImageWorkflowSystemLookup(selector.lineageId);
        if (!lineageId) {
          return undefined;
        }
        clauses.push("lineage_id = ?");
        params.push(lineageId);
        break;
      }
      case "latest-published-in-lineage": {
        const lineageId = normalizeImageWorkflowSystemLookup(selector.lineageId);
        if (!lineageId) {
          return undefined;
        }
        clauses.push("lineage_id = ?");
        clauses.push("lifecycle_state = ?");
        params.push(lineageId, ImageWorkflowLifecycleStates.published);
        break;
      }
      case "active-published-in-lineage": {
        const lineageId = normalizeImageWorkflowSystemLookup(selector.lineageId);
        if (!lineageId) {
          return undefined;
        }
        clauses.push("lineage_id = ?");
        clauses.push("lifecycle_state = ?");
        clauses.push("activation_status = ?");
        params.push(
          lineageId,
          ImageWorkflowLifecycleStates.published,
          ImageWorkflowActivationStatuses.active,
        );
        break;
      }
      default:
        return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_workflow_definition_records
      WHERE ${clauses.join(" AND ")}
      ORDER BY revision DESC, updated_at DESC, workflow_id ASC
      LIMIT 1
    `).get(...params) as ImageWorkflowDefinitionRecordRow | undefined;

    return row ? mapImageWorkflowDefinitionRowToDomain(row) : undefined;
  }

  public async listWorkflowDefinitions(
    query: ImageWorkflowDefinitionListQuery,
  ): Promise<ReadonlyArray<ImageWorkflowDefinition>> {
    const normalizedWorkspaceId = normalizeImageWorkflowSystemLookup(query.workspaceId);
    if (!normalizedWorkspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [normalizedWorkspaceId];

    const ownerUserIds = this.normalizeLookupList(query.ownerUserIds);
    if (ownerUserIds.length > 0) {
      clauses.push(`owner_user_id IN (${ownerUserIds.map(() => "?").join(", ")})`);
      params.push(...ownerUserIds);
    }

    if (query.visibilities && query.visibilities.length > 0) {
      clauses.push(`visibility IN (${query.visibilities.map(() => "?").join(", ")})`);
      params.push(...query.visibilities);
    }

    if (query.operationKinds && query.operationKinds.length > 0) {
      clauses.push(`operation_kind IN (${query.operationKinds.map(() => "?").join(", ")})`);
      params.push(...query.operationKinds);
    }

    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      clauses.push(`lifecycle_state IN (${query.lifecycleStates.map(() => "?").join(", ")})`);
      params.push(...query.lifecycleStates);
    }

    if (query.activationStatuses && query.activationStatuses.length > 0) {
      clauses.push(`activation_status IN (${query.activationStatuses.map(() => "?").join(", ")})`);
      params.push(...query.activationStatuses);
    }

    const lineageIds = this.normalizeLookupList(query.lineageIds);
    if (lineageIds.length > 0) {
      clauses.push(`lineage_id IN (${lineageIds.map(() => "?").join(", ")})`);
      params.push(...lineageIds);
    }

    if (!query.includeRetired) {
      clauses.push("lifecycle_state <> ?");
      params.push(ImageWorkflowLifecycleStates.retired);
    }

    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM image_workflow_definition_records
      WHERE ${clauses.join(" AND ")}
      ORDER BY revision DESC, updated_at DESC, workflow_id ASC
    `).all(...params) as ImageWorkflowDefinitionRecordRow[];

    const tagFilter = this.normalizeLookupList(query.tags);
    const filteredRows = tagFilter.length > 0
      ? rows.filter((row) => {
        const rowTags = new Set(parseTagsJson(row.tags_json).map((tag) => tag.trim().toLowerCase()));
        return tagFilter.some((tag) => rowTags.has(tag.trim().toLowerCase()));
      })
      : rows;

    const pagedRows = this.page(filteredRows, query.limit, query.offset);
    return Object.freeze(pagedRows.map((row) => mapImageWorkflowDefinitionRowToDomain(row)));
  }

  public async createWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    return this.persistWorkflowMutation({
      mutationKind: "create-workflow-definition",
      workflow: definition,
      mutation,
      requireExisting: false,
      requireAbsent: true,
    });
  }

  public async saveWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    return this.persistWorkflowMutation({
      mutationKind: "save-workflow-definition",
      workflow: definition,
      mutation,
      requireExisting: false,
      requireAbsent: false,
    });
  }

  public async archiveWorkflowDefinition(
    workflowId: string,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition> | undefined> {
    const normalizedWorkflowId = normalizeImageWorkflowSystemLookup(workflowId);
    if (!normalizedWorkflowId) {
      return undefined;
    }
    const currentRow = this.getWorkflowRowById(normalizedWorkflowId);
    const current = currentRow ? mapImageWorkflowDefinitionRowToDomain(currentRow) : undefined;
    if (!current) {
      return undefined;
    }

    const archived = transitionImageWorkflowLifecycle(current, {
      targetState: ImageWorkflowLifecycleStates.retired,
      actorUserId: mutation.actorUserId,
      now: toMutationDate(mutation.occurredAt),
    });

    return this.persistWorkflowMutation({
      mutationKind: "archive-workflow-definition",
      workflow: archived,
      mutation,
      requireExisting: true,
      requireAbsent: false,
    });
  }

  public async getWorkflowBackendTranslationReference(
    query: {
      readonly workspaceId: string;
      readonly selector: ImageWorkflowVersionSelector;
    },
  ): Promise<ImageWorkflowBackendTranslationReference | undefined> {
    const workflow = await this.resolveWorkflowDefinitionVersion(query);
    return workflow?.backendTranslation;
  }

  public async findSystemDefinitionById(
    systemId: string,
    query: {
      readonly workspaceId: string;
      readonly includeArchived?: boolean;
    },
  ): Promise<ImageSystemDefinition | undefined> {
    const normalizedSystemId = normalizeImageWorkflowSystemLookup(systemId);
    const normalizedWorkspaceId = normalizeImageWorkflowSystemLookup(query.workspaceId);
    if (!normalizedSystemId || !normalizedWorkspaceId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_system_definition_records
      WHERE system_id = ?
        AND workspace_id = ?
      LIMIT 1
    `).get(normalizedSystemId, normalizedWorkspaceId) as ImageSystemDefinitionRecordRow | undefined;

    if (!row) {
      return undefined;
    }

    if (!query.includeArchived && row.lifecycle_state === ImageSystemLifecycleStates.archived) {
      return undefined;
    }

    return mapImageSystemDefinitionRowToDomain(row);
  }

  public async listSystemDefinitions(
    query: ImageSystemDefinitionListQuery,
  ): Promise<ReadonlyArray<ImageSystemDefinition>> {
    const normalizedWorkspaceId = normalizeImageWorkflowSystemLookup(query.workspaceId);
    if (!normalizedWorkspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [normalizedWorkspaceId];

    const ownerUserIds = this.normalizeLookupList(query.ownerUserIds);
    if (ownerUserIds.length > 0) {
      clauses.push(`owner_user_id IN (${ownerUserIds.map(() => "?").join(", ")})`);
      params.push(...ownerUserIds);
    }

    if (query.visibilities && query.visibilities.length > 0) {
      clauses.push(`visibility IN (${query.visibilities.map(() => "?").join(", ")})`);
      params.push(...query.visibilities);
    }

    const sharingPolicyIds = this.normalizeLookupList(query.sharingPolicyIds);
    if (sharingPolicyIds.length > 0) {
      clauses.push(`sharing_policy_id IN (${sharingPolicyIds.map(() => "?").join(", ")})`);
      params.push(...sharingPolicyIds);
    }

    const workflowIds = this.normalizeLookupList(query.workflowIds);
    if (workflowIds.length > 0) {
      clauses.push(`workflow_id IN (${workflowIds.map(() => "?").join(", ")})`);
      params.push(...workflowIds);
    }

    const workflowLineageIds = this.normalizeLookupList(query.workflowLineageIds);
    if (workflowLineageIds.length > 0) {
      clauses.push(`workflow_lineage_id IN (${workflowLineageIds.map(() => "?").join(", ")})`);
      params.push(...workflowLineageIds);
    }

    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      clauses.push(`lifecycle_state IN (${query.lifecycleStates.map(() => "?").join(", ")})`);
      params.push(...query.lifecycleStates);
    }

    if (query.runtimeStatuses && query.runtimeStatuses.length > 0) {
      clauses.push(`runtime_status IN (${query.runtimeStatuses.map(() => "?").join(", ")})`);
      params.push(...query.runtimeStatuses);
    }

    if (!query.includeArchived) {
      clauses.push("lifecycle_state <> ?");
      params.push(ImageSystemLifecycleStates.archived);
    }

    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM image_system_definition_records
      WHERE ${clauses.join(" AND ")}
      ORDER BY updated_at DESC, system_id ASC
    `).all(...params) as ImageSystemDefinitionRecordRow[];

    const tagFilter = this.normalizeLookupList(query.tags);
    const filteredRows = tagFilter.length > 0
      ? rows.filter((row) => {
        const rowTags = new Set(parseTagsJson(row.tags_json).map((tag) => tag.trim().toLowerCase()));
        return tagFilter.some((tag) => rowTags.has(tag.trim().toLowerCase()));
      })
      : rows;

    const pagedRows = this.page(filteredRows, query.limit, query.offset);
    return Object.freeze(pagedRows.map((row) => mapImageSystemDefinitionRowToDomain(row)));
  }

  public async createSystemDefinition(
    definition: ImageSystemDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    return this.persistSystemMutation({
      mutationKind: "create-system-definition",
      system: definition,
      mutation,
      requireExisting: false,
      requireAbsent: true,
    });
  }

  public async saveSystemDefinition(
    definition: ImageSystemDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    return this.persistSystemMutation({
      mutationKind: "save-system-definition",
      system: definition,
      mutation,
      requireExisting: false,
      requireAbsent: false,
    });
  }

  public async archiveSystemDefinition(
    systemId: string,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition> | undefined> {
    const normalizedSystemId = normalizeImageWorkflowSystemLookup(systemId);
    if (!normalizedSystemId) {
      return undefined;
    }
    const currentRow = this.getSystemRowById(normalizedSystemId);
    const current = currentRow ? mapImageSystemDefinitionRowToDomain(currentRow) : undefined;
    if (!current) {
      return undefined;
    }

    const archived = transitionImageSystemLifecycle(current, {
      targetState: ImageSystemLifecycleStates.archived,
      actorUserId: mutation.actorUserId,
      now: toMutationDate(mutation.occurredAt),
    });

    return this.persistSystemMutation({
      mutationKind: "archive-system-definition",
      system: archived,
      mutation,
      requireExisting: true,
      requireAbsent: false,
    });
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistWorkflowMutation(
    options: PersistWorkflowMutationOptions,
  ): ImageWorkflowSystemMutationResult<ImageWorkflowDefinition> {
    const operationKey = normalizeImageWorkflowSystemOperationKey(options.mutation.operationKey);
    const replay = this.getWorkflowMutationReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    const normalizedWorkflowId = normalizeImageWorkflowSystemLookup(options.workflow.workflowId);
    if (!normalizedWorkflowId) {
      throw new Error("Image workflow persistence requires workflowId.");
    }

    const existingRow = this.getWorkflowRowById(normalizedWorkflowId);
    const existing = existingRow ? mapImageWorkflowDefinitionRowToDomain(existingRow) : undefined;

    if (options.requireAbsent && existingRow) {
      throw new Error(`Image workflow '${normalizedWorkflowId}' already exists.`);
    }
    if (options.requireExisting && !existingRow) {
      throw new Error(`Image workflow '${normalizedWorkflowId}' was not found.`);
    }

    assertExpectedPersistenceRevision(
      options.mutation.expectedRevision,
      existingRow?.persistence_revision,
      "ImageWorkflowDefinition",
    );

    const changed = !existing || JSON.stringify(existing) !== JSON.stringify(options.workflow);
    const persistenceRevision = changed
      ? nextPersistenceRevision(existingRow?.persistence_revision)
      : (existingRow?.persistence_revision ?? 1);

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        INSERT INTO image_workflow_definition_records (
          workflow_id,
          workspace_id,
          owner_user_id,
          visibility,
          operation_kind,
          lifecycle_state,
          activation_status,
          lineage_id,
          version_tag,
          revision,
          translator_id,
          template_id,
          tags_json,
          created_at,
          updated_at,
          persistence_revision,
          schema_version,
          definition_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workflow_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          owner_user_id = excluded.owner_user_id,
          visibility = excluded.visibility,
          operation_kind = excluded.operation_kind,
          lifecycle_state = excluded.lifecycle_state,
          activation_status = excluded.activation_status,
          lineage_id = excluded.lineage_id,
          version_tag = excluded.version_tag,
          revision = excluded.revision,
          translator_id = excluded.translator_id,
          template_id = excluded.template_id,
          tags_json = excluded.tags_json,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          persistence_revision = excluded.persistence_revision,
          schema_version = excluded.schema_version,
          definition_json = excluded.definition_json
        WHERE excluded.updated_at >= image_workflow_definition_records.updated_at
      `).run(...mapImageWorkflowDefinitionToRowValues({
        workflow: options.workflow,
        persistenceRevision,
        schemaVersion: IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_SCHEMA_VERSION,
      }));

      this.persistMutationReplayRecord({
        operationKey,
        mutationKind: options.mutationKind,
        recordKind: "workflow-definition",
        recordId: options.workflow.workflowId,
        record: options.workflow,
        mutation: options.mutation,
      });
    })();

    return Object.freeze({
      changed,
      wasReplay: false,
      record: options.workflow,
    });
  }

  private persistSystemMutation(
    options: PersistSystemMutationOptions,
  ): ImageWorkflowSystemMutationResult<ImageSystemDefinition> {
    const operationKey = normalizeImageWorkflowSystemOperationKey(options.mutation.operationKey);
    const replay = this.getSystemMutationReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    const normalizedSystemId = normalizeImageWorkflowSystemLookup(options.system.systemId);
    if (!normalizedSystemId) {
      throw new Error("Image system persistence requires systemId.");
    }

    const existingRow = this.getSystemRowById(normalizedSystemId);
    const existing = existingRow ? mapImageSystemDefinitionRowToDomain(existingRow) : undefined;

    if (options.requireAbsent && existingRow) {
      throw new Error(`Image system '${normalizedSystemId}' already exists.`);
    }
    if (options.requireExisting && !existingRow) {
      throw new Error(`Image system '${normalizedSystemId}' was not found.`);
    }

    assertExpectedPersistenceRevision(
      options.mutation.expectedRevision,
      existingRow?.persistence_revision,
      "ImageSystemDefinition",
    );

    const changed = !existing || JSON.stringify(existing) !== JSON.stringify(options.system);
    const persistenceRevision = changed
      ? nextPersistenceRevision(existingRow?.persistence_revision)
      : (existingRow?.persistence_revision ?? 1);

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        INSERT INTO image_system_definition_records (
          system_id,
          workspace_id,
          owner_user_id,
          visibility,
          sharing_policy_id,
          workflow_id,
          workflow_lineage_id,
          workflow_version_tag,
          workflow_revision,
          lifecycle_state,
          runtime_status,
          tags_json,
          created_at,
          updated_at,
          persistence_revision,
          schema_version,
          definition_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(system_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          owner_user_id = excluded.owner_user_id,
          visibility = excluded.visibility,
          sharing_policy_id = excluded.sharing_policy_id,
          workflow_id = excluded.workflow_id,
          workflow_lineage_id = excluded.workflow_lineage_id,
          workflow_version_tag = excluded.workflow_version_tag,
          workflow_revision = excluded.workflow_revision,
          lifecycle_state = excluded.lifecycle_state,
          runtime_status = excluded.runtime_status,
          tags_json = excluded.tags_json,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          persistence_revision = excluded.persistence_revision,
          schema_version = excluded.schema_version,
          definition_json = excluded.definition_json
        WHERE excluded.updated_at >= image_system_definition_records.updated_at
      `).run(...mapImageSystemDefinitionToRowValues({
        system: options.system,
        persistenceRevision,
        schemaVersion: IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_SCHEMA_VERSION,
      }));

      this.persistMutationReplayRecord({
        operationKey,
        mutationKind: options.mutationKind,
        recordKind: "system-definition",
        recordId: options.system.systemId,
        record: options.system,
        mutation: options.mutation,
      });
    })();

    return Object.freeze({
      changed,
      wasReplay: false,
      record: options.system,
    });
  }

  private getWorkflowRowById(workflowId: string): ImageWorkflowDefinitionRecordRow | undefined {
    return this.getDatabase().prepare(`
      SELECT *
      FROM image_workflow_definition_records
      WHERE workflow_id = ?
      LIMIT 1
    `).get(workflowId) as ImageWorkflowDefinitionRecordRow | undefined;
  }

  private getSystemRowById(systemId: string): ImageSystemDefinitionRecordRow | undefined {
    return this.getDatabase().prepare(`
      SELECT *
      FROM image_system_definition_records
      WHERE system_id = ?
      LIMIT 1
    `).get(systemId) as ImageSystemDefinitionRecordRow | undefined;
  }

  private getWorkflowMutationReplayRecord(operationKey: string): ImageWorkflowDefinition | undefined {
    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_workflow_system_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as ImageWorkflowSystemMutationReplayRow | undefined;

    if (!row || row.record_kind !== "workflow-definition") {
      return undefined;
    }

    return parseWorkflowMutationReplayRow(row);
  }

  private getSystemMutationReplayRecord(operationKey: string): ImageSystemDefinition | undefined {
    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_workflow_system_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as ImageWorkflowSystemMutationReplayRow | undefined;

    if (!row || row.record_kind !== "system-definition") {
      return undefined;
    }

    return parseSystemMutationReplayRow(row);
  }

  private persistMutationReplayRecord(input: {
    readonly operationKey: string;
    readonly mutationKind: WorkflowMutationKind | SystemMutationKind;
    readonly recordKind: "workflow-definition" | "system-definition";
    readonly recordId: string;
    readonly record: ImageWorkflowDefinition | ImageSystemDefinition;
    readonly mutation: ImageWorkflowSystemMutationContext;
  }): void {
    this.getDatabase().prepare(`
      INSERT INTO image_workflow_system_mutation_replays (
        operation_key,
        mutation_kind,
        record_kind,
        record_id,
        record_snapshot_json,
        actor_user_id,
        correlation_id,
        reason,
        occurred_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.operationKey,
      input.mutationKind,
      input.recordKind,
      input.recordId,
      JSON.stringify(input.record),
      input.mutation.actorUserId,
      input.mutation.correlationId ?? null,
      input.mutation.reason ?? null,
      this.resolveMutationTimestamp(input.mutation.occurredAt),
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
    if (currentVersion > IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Image workflow/system schema version ${currentVersion} is newer than supported version ${IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO image_workflow_system_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS image_workflow_system_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM image_workflow_system_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private normalizeLookupList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
    if (!values || values.length === 0) {
      return Object.freeze([]);
    }

    return Object.freeze(values
      .map((value) => normalizeImageWorkflowSystemLookup(value))
      .filter((value): value is string => Boolean(value)));
  }

  private page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
    const normalizedOffset = Number.isInteger(offset) && (offset ?? 0) > 0 ? offset as number : 0;
    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? limit as number : undefined;
    const paged = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
    return normalizedLimit ? paged.slice(0, normalizedLimit) : paged;
  }
}

function toMutationDate(candidate?: string): Date | undefined {
  const normalized = candidate?.trim();
  if (!normalized) {
    return undefined;
  }
  return new Date(normalized);
}
