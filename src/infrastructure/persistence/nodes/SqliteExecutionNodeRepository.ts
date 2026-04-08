import fs from "node:fs";
import path from "node:path";
import {
  recordExecutionNodeHealth,
  setExecutionNodeOperationalAvailabilityOverride,
  setExecutionNodeBackendFamilyCapabilities,
  transitionExecutionNodeActivationStatus,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import type {
  ExecutionNodeListQuery,
  ExecutionNodeMutationResult,
  IExecutionNodeRepository,
  RegisterExecutionNodeInput,
  UpdateExecutionNodeAvailabilityInput,
  UpdateExecutionNodeOperationalAvailabilityInput,
  UpdateExecutionNodeCapabilitiesInput,
  UpdateExecutionNodeHealthInput,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";
import type { IPlatformTransactionManager } from "@application/common/ports/PlatformTransactionPorts";
import { normalizePersistenceOperationKey } from "@shared/dto/persistence/PersistenceBoundaryDtos";
import {
  assertExpectedPersistenceRevision,
  nextPersistenceRevision,
} from "@shared/persistence/PersistenceVersioning";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { createSqliteWhereBuilder } from "../common/SqliteQueryHelpers";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import { SqliteTransactionCoordinator } from "../sqlite/SqliteTransactionCoordinator";
import {
  mapExecutionNodeRecordToRowValues,
  mapExecutionNodeRowToRecord,
  normalizeExecutionNodeLookup,
  parseExecutionNodeMutationReplayRecord,
  toExecutionNodeAvailabilitySummary,
  toExecutionNodeBackendFamilies,
  toExecutionNodeExecutionTargets,
  type ExecutionNodeMutationReplayRow,
  type ExecutionNodeRow,
} from "./ExecutionNodePersistenceMapper";
import {
  EXECUTION_NODE_PERSISTENCE_MIGRATIONS,
  EXECUTION_NODE_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteExecutionNodePersistenceMigrations";

type ExecutionNodeMutationKind =
  | "register-execution-node"
  | "save-execution-node"
  | "update-health"
  | "update-capabilities"
  | "update-availability";

type ExecutionNodeHistoryKind =
  | "registration"
  | "state-save"
  | "health-refresh"
  | "capability-refresh"
  | "availability-change";

interface PersistExecutionNodeOptions {
  readonly mutationKind: ExecutionNodeMutationKind;
  readonly historyKind: ExecutionNodeHistoryKind;
  readonly input: RegisterExecutionNodeInput;
  readonly requireNotExists?: boolean;
  readonly observedAt?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

interface PersistedNodeRow {
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export class SqliteExecutionNodeRepository
  extends SafeSqliteRepositoryBase
  implements IExecutionNodeRepository, IPlatformTransactionManager {
  private database?: SqliteCompatDatabase;
  private initialized = false;
  private readonly transactionCoordinator: SqliteTransactionCoordinator;

  public constructor(private readonly databasePath: string) {
    super("Execution node");
    this.transactionCoordinator = new SqliteTransactionCoordinator(() => this.getDatabase());
  }

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    const normalizedNodeId = normalizeExecutionNodeLookup(nodeId);
    if (!normalizedNodeId) {
      return undefined;
    }

    const row = this.getExecutionNodeRowById(normalizedNodeId);
    return row ? mapExecutionNodeRowToRecord(row) : undefined;
  }

  public async listExecutionNodes(query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    const whereBuilder = createSqliteWhereBuilder();

    if (query.nodeIds && query.nodeIds.length > 0) {
      whereBuilder.addIn("n.node_id", query.nodeIds.map((nodeId) => normalizeExecutionNodeLookup(nodeId)).filter(Boolean));
    }

    whereBuilder.addIn("n.activation_status", query.activationStatuses);
    whereBuilder.addIn("n.health_status", query.healthStatuses);
    whereBuilder.addIn("n.availability_override_mode", query.operationalAvailabilityModes);
    whereBuilder.addIn("n.approval_status", query.approvalStatuses);
    whereBuilder.addIn("n.trust_state", query.trustStates);

    if (typeof query.supportsRemoteScheduling === "boolean") {
      whereBuilder.add("n.supports_remote_scheduling = ?", query.supportsRemoteScheduling ? 1 : 0);
    }

    if (query.requireCertificateRef === true) {
      whereBuilder.add("n.certificate_ref IS NOT NULL");
    }

    if (query.requireCertificateRef === false) {
      whereBuilder.add("n.certificate_ref IS NULL");
    }

    if (!query.includeRevoked) {
      whereBuilder.add("n.activation_status != 'revoked'");
      whereBuilder.add("n.trust_state != 'revoked'");
    }

    if (query.lastSeenAfter) {
      whereBuilder.add("n.last_seen_at IS NOT NULL");
      whereBuilder.add("n.last_seen_at >= ?", query.lastSeenAfter.trim());
    }

    if (query.lastSeenBefore) {
      whereBuilder.add("n.last_seen_at IS NOT NULL");
      whereBuilder.add("n.last_seen_at <= ?", query.lastSeenBefore.trim());
    }

    if (query.backendFamilies && query.backendFamilies.length > 0) {
      whereBuilder.add(
        `EXISTS (
          SELECT 1
          FROM execution_node_backend_families_lookup f
          WHERE f.node_id = n.node_id
            AND f.backend_family IN (${query.backendFamilies.map(() => "?").join(", ")})
        )`,
        ...query.backendFamilies.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
      );
    }

    if (query.executionTargets && query.executionTargets.length > 0) {
      whereBuilder.add(
        `EXISTS (
          SELECT 1
          FROM execution_node_execution_targets_lookup t
          WHERE t.node_id = n.node_id
            AND t.execution_target IN (${query.executionTargets.map(() => "?").join(", ")})
        )`,
        ...query.executionTargets.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
      );
    }

    if (query.requiredCapabilitiesAnyOf && query.requiredCapabilitiesAnyOf.length > 0) {
      whereBuilder.add(
        `EXISTS (
          SELECT 1
          FROM execution_node_capabilities_lookup c
          WHERE c.node_id = n.node_id
            AND c.capability IN (${query.requiredCapabilitiesAnyOf.map(() => "?").join(", ")})
        )`,
        ...query.requiredCapabilitiesAnyOf,
      );
    }

    if (query.deploymentTagAnyOf && query.deploymentTagAnyOf.length > 0) {
      whereBuilder.add(
        `EXISTS (
          SELECT 1
          FROM execution_node_deployment_tags_lookup d
          WHERE d.node_id = n.node_id
            AND d.deployment_tag IN (${query.deploymentTagAnyOf.map(() => "?").join(", ")})
        )`,
        ...query.deploymentTagAnyOf.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
      );
    }

    const where = whereBuilder.build();
    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        n.node_id,
        n.display_name,
        n.node_type,
        n.capability_enabled_json,
        n.capability_profile_version,
        n.supports_remote_scheduling,
        n.max_concurrent_workloads,
        n.backend_family_capabilities_json,
        n.approval_status,
        n.trust_state,
        n.activation_status,
        n.health_status,
        n.availability_override_mode,
        n.availability_override_suppressed_until,
        n.availability_override_reason,
        n.availability_override_updated_at,
        n.deployment_tags_json,
        n.endpoint_ref,
        n.configuration_ref,
        n.certificate_ref,
        n.last_seen_at,
        n.metadata_json,
        n.created_at,
        n.created_by,
        n.last_modified_at,
        n.last_modified_by,
        n.revision
      FROM execution_node_records n
      ${where.sql}
      ORDER BY n.last_modified_at DESC, n.node_id ASC
      ${paging.sql}
    `).all(...where.params, ...paging.params) as ExecutionNodeRow[];

    return Object.freeze(rows.map((row) => mapExecutionNodeRowToRecord(row)));
  }

  public async registerExecutionNode(input: RegisterExecutionNodeInput): Promise<ExecutionNodeMutationResult> {
    return this.persistExecutionNode({
      mutationKind: "register-execution-node",
      historyKind: "registration",
      input,
      requireNotExists: true,
      observedAt: input.record.createdAt,
    });
  }

  public async saveExecutionNode(input: RegisterExecutionNodeInput): Promise<ExecutionNodeMutationResult> {
    return this.persistExecutionNode({
      mutationKind: "save-execution-node",
      historyKind: "state-save",
      input,
      observedAt: input.record.updatedAt,
    });
  }

  public async updateExecutionNodeHealth(input: UpdateExecutionNodeHealthInput): Promise<ExecutionNodeMutationResult> {
    const existing = await this.findExecutionNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const record = recordExecutionNodeHealth(existing, {
      healthStatus: input.healthStatus,
      observedAt: input.observedAt,
    });

    return this.persistExecutionNode({
      mutationKind: "update-health",
      historyKind: "health-refresh",
      input: {
        record,
        mutation: input.mutation,
      },
      observedAt: input.observedAt,
      details: Object.freeze({
        healthStatus: input.healthStatus,
      }),
    });
  }

  public async updateExecutionNodeCapabilities(
    input: UpdateExecutionNodeCapabilitiesInput,
  ): Promise<ExecutionNodeMutationResult> {
    const existing = await this.findExecutionNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const record = setExecutionNodeBackendFamilyCapabilities(
      existing,
      input.backendFamilyCapabilities,
      new Date(input.refreshedAt),
    );

    return this.persistExecutionNode({
      mutationKind: "update-capabilities",
      historyKind: "capability-refresh",
      input: {
        record,
        mutation: input.mutation,
      },
      observedAt: input.refreshedAt,
      details: Object.freeze({
        backendFamilies: toExecutionNodeBackendFamilies(record),
      }),
    });
  }

  public async updateExecutionNodeAvailability(
    input: UpdateExecutionNodeAvailabilityInput,
  ): Promise<ExecutionNodeMutationResult> {
    const existing = await this.findExecutionNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const transitioned = transitionExecutionNodeActivationStatus(
      existing,
      input.activationStatus,
      new Date(input.changedAt),
    );

    const record = input.healthStatus
      ? recordExecutionNodeHealth(transitioned, {
        healthStatus: input.healthStatus,
        observedAt: input.changedAt,
      })
      : transitioned;

    return this.persistExecutionNode({
      mutationKind: "update-availability",
      historyKind: "availability-change",
      input: {
        record,
        mutation: input.mutation,
      },
      observedAt: input.changedAt,
      details: input.details,
    });
  }

  public async updateExecutionNodeOperationalAvailability(
    input: UpdateExecutionNodeOperationalAvailabilityInput,
  ): Promise<ExecutionNodeMutationResult> {
    const existing = await this.findExecutionNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const record = setExecutionNodeOperationalAvailabilityOverride(existing, {
      mode: input.mode,
      updatedAt: input.changedAt,
      suppressedUntil: input.suppressedUntil,
      reason: input.mutation.reason,
    });

    return this.persistExecutionNode({
      mutationKind: "update-availability",
      historyKind: "availability-change",
      input: {
        record,
        mutation: input.mutation,
      },
      observedAt: input.changedAt,
      details: input.details,
    });
  }

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    return this.transactionCoordinator.runInTransaction(operation);
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistExecutionNode(options: PersistExecutionNodeOptions): ExecutionNodeMutationResult {
    const operationKey = this.normalizeOperationKey(options.input.mutation.operationKey);
    const replay = this.getMutationReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    let persistedRecord: ExecutionNodeRecord | undefined;
    let changed = false;

    this.getDatabase().transaction(() => {
      const existingRow = this.getExecutionNodeRowById(options.input.record.nodeId);
      if (options.requireNotExists && existingRow) {
        throw new Error(`Execution node '${options.input.record.nodeId}' is already registered.`);
      }

      assertExpectedPersistenceRevision(
        options.input.mutation.expectedRevision,
        existingRow?.revision,
        "Execution node",
      );

      const existingRecord = existingRow ? mapExecutionNodeRowToRecord(existingRow) : undefined;
      const normalizedRecord = existingRow
        ? this.rebuildRecord(options.input.record, {
          createdAt: existingRow.created_at,
          updatedAt: options.input.record.updatedAt,
        })
        : options.input.record;

      changed = !existingRecord || JSON.stringify(existingRecord) !== JSON.stringify(normalizedRecord);

      const persistedRowMeta: PersistedNodeRow = changed
        ? Object.freeze({
          created_at: existingRow?.created_at ?? normalizedRecord.createdAt,
          created_by: existingRow?.created_by ?? options.input.mutation.actorId,
          last_modified_at: normalizedRecord.updatedAt,
          last_modified_by: options.input.mutation.actorId,
          revision: nextPersistenceRevision(existingRow?.revision),
        })
        : Object.freeze({
          created_at: existingRow?.created_at ?? normalizedRecord.createdAt,
          created_by: existingRow?.created_by ?? options.input.mutation.actorId,
          last_modified_at: existingRow?.last_modified_at ?? normalizedRecord.updatedAt,
          last_modified_by: existingRow?.last_modified_by ?? options.input.mutation.actorId,
          revision: existingRow?.revision ?? 1,
        });

      if (changed) {
        const values = mapExecutionNodeRecordToRowValues({
          record: normalizedRecord,
          createdAt: persistedRowMeta.created_at,
          createdBy: persistedRowMeta.created_by,
          lastModifiedAt: persistedRowMeta.last_modified_at,
          lastModifiedBy: persistedRowMeta.last_modified_by,
          revision: persistedRowMeta.revision,
        });

        const upsertResult = this.executeMutation("upsert execution node", () => this.getDatabase().prepare(`
            INSERT INTO execution_node_records (
              node_id,
              display_name,
              node_type,
              capability_enabled_json,
              capability_profile_version,
              supports_remote_scheduling,
              max_concurrent_workloads,
              backend_family_capabilities_json,
              approval_status,
              trust_state,
              activation_status,
              health_status,
              availability_override_mode,
              availability_override_suppressed_until,
              availability_override_reason,
              availability_override_updated_at,
              deployment_tags_json,
              endpoint_ref,
              configuration_ref,
              certificate_ref,
              last_seen_at,
              metadata_json,
              created_at,
              created_by,
              last_modified_at,
              last_modified_by,
              revision
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(node_id) DO UPDATE SET
              display_name = excluded.display_name,
              node_type = excluded.node_type,
              capability_enabled_json = excluded.capability_enabled_json,
              capability_profile_version = excluded.capability_profile_version,
              supports_remote_scheduling = excluded.supports_remote_scheduling,
              max_concurrent_workloads = excluded.max_concurrent_workloads,
              backend_family_capabilities_json = excluded.backend_family_capabilities_json,
              approval_status = excluded.approval_status,
              trust_state = excluded.trust_state,
              activation_status = excluded.activation_status,
              health_status = excluded.health_status,
              availability_override_mode = excluded.availability_override_mode,
              availability_override_suppressed_until = excluded.availability_override_suppressed_until,
              availability_override_reason = excluded.availability_override_reason,
              availability_override_updated_at = excluded.availability_override_updated_at,
              deployment_tags_json = excluded.deployment_tags_json,
              endpoint_ref = excluded.endpoint_ref,
              configuration_ref = excluded.configuration_ref,
              certificate_ref = excluded.certificate_ref,
              last_seen_at = excluded.last_seen_at,
              metadata_json = excluded.metadata_json,
              created_at = excluded.created_at,
              created_by = excluded.created_by,
              last_modified_at = excluded.last_modified_at,
              last_modified_by = excluded.last_modified_by,
              revision = excluded.revision
            WHERE excluded.revision > execution_node_records.revision
          `).run(...values));

        if (upsertResult.changes === 0) {
          const persisted = this.getExecutionNodeRowById(normalizedRecord.nodeId);
          if (persisted && persisted.revision >= persistedRowMeta.revision) {
            throw new Error(
              `Execution node persistence conflict while saving '${normalizedRecord.nodeId}': a newer record already exists.`,
            );
          }
        }

        this.replaceCapabilityLookupRows(normalizedRecord);
        this.replaceDeploymentTagLookupRows(normalizedRecord);
        this.replaceBackendFamilyLookupRows(normalizedRecord);
        this.replaceExecutionTargetLookupRows(normalizedRecord);

        this.appendStatusHistory({
          record: normalizedRecord,
          revision: persistedRowMeta.revision,
          operationKey,
          historyKind: options.historyKind,
          actorId: options.input.mutation.actorId,
          reason: options.input.mutation.reason,
          details: options.details,
          observedAt: options.observedAt,
          changedAt: normalizedRecord.updatedAt,
        });
      }

      persistedRecord = this.rebuildRecord(normalizedRecord, {
        createdAt: persistedRowMeta.created_at,
        updatedAt: changed ? persistedRowMeta.last_modified_at : normalizedRecord.updatedAt,
      });

      this.persistMutationReplayRecord(operationKey, options.mutationKind, persistedRecord);
    })();

    return Object.freeze({
      changed,
      wasReplay: false,
      record: persistedRecord as ExecutionNodeRecord,
    });
  }

  private appendStatusHistory(input: {
    readonly record: ExecutionNodeRecord;
    readonly revision: number;
    readonly operationKey: string;
    readonly historyKind: ExecutionNodeHistoryKind;
    readonly actorId: string;
    readonly reason?: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly observedAt?: string;
    readonly changedAt: string;
  }): void {
    const entryId = `node-status:${input.record.nodeId}:r${input.revision}:${input.historyKind}`;
    const backendFamilySummary = JSON.stringify(toExecutionNodeBackendFamilies(input.record));
    const snapshotJson = JSON.stringify({
      nodeId: input.record.nodeId,
      revision: input.revision,
      record: input.record,
      backendFamilies: toExecutionNodeBackendFamilies(input.record),
      availabilitySummary: toExecutionNodeAvailabilitySummary(input.record),
    });

    this.executeMutation("append execution node status history", () => this.getDatabase().prepare(`
        INSERT INTO execution_node_status_history (
          history_entry_id,
          node_id,
          history_kind,
          activation_status,
          health_status,
          availability_summary,
          backend_family_summary_json,
          observed_at,
          changed_at,
          changed_by_actor_id,
          operation_key,
          reason,
          details_json,
          snapshot_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
      entryId,
      input.record.nodeId,
      input.historyKind,
      input.record.activationStatus,
      input.record.healthStatus,
      toExecutionNodeAvailabilitySummary(input.record),
      backendFamilySummary,
      input.observedAt ?? input.record.updatedAt,
      input.changedAt,
      input.actorId,
      input.operationKey,
      input.reason ?? null,
      input.details ? JSON.stringify(input.details) : null,
      snapshotJson,
      new Date().toISOString(),
    ));
  }

  private replaceCapabilityLookupRows(record: ExecutionNodeRecord): void {
    this.executeMutation("replace execution node capability lookup rows", () => this.getDatabase().prepare(
      "DELETE FROM execution_node_capabilities_lookup WHERE node_id = ?",
    ).run(record.nodeId));

    const insert = this.getDatabase().prepare(`
      INSERT INTO execution_node_capabilities_lookup (node_id, capability)
      VALUES (?, ?)
    `);

    for (const capability of record.capabilityProfile.enabledCapabilities) {
      insert.run(record.nodeId, capability);
    }
  }

  private replaceDeploymentTagLookupRows(record: ExecutionNodeRecord): void {
    this.executeMutation("replace execution node deployment tag lookup rows", () => this.getDatabase().prepare(
      "DELETE FROM execution_node_deployment_tags_lookup WHERE node_id = ?",
    ).run(record.nodeId));

    const insert = this.getDatabase().prepare(`
      INSERT INTO execution_node_deployment_tags_lookup (node_id, deployment_tag)
      VALUES (?, ?)
    `);

    for (const tag of record.deploymentTags) {
      insert.run(record.nodeId, tag.trim().toLowerCase());
    }
  }

  private replaceBackendFamilyLookupRows(record: ExecutionNodeRecord): void {
    this.executeMutation("replace execution node backend family lookup rows", () => this.getDatabase().prepare(
      "DELETE FROM execution_node_backend_families_lookup WHERE node_id = ?",
    ).run(record.nodeId));

    const insert = this.getDatabase().prepare(`
      INSERT INTO execution_node_backend_families_lookup (node_id, backend_family)
      VALUES (?, ?)
    `);

    for (const backendFamily of toExecutionNodeBackendFamilies(record)) {
      insert.run(record.nodeId, backendFamily);
    }
  }

  private replaceExecutionTargetLookupRows(record: ExecutionNodeRecord): void {
    this.executeMutation("replace execution node execution target lookup rows", () => this.getDatabase().prepare(
      "DELETE FROM execution_node_execution_targets_lookup WHERE node_id = ?",
    ).run(record.nodeId));

    const insert = this.getDatabase().prepare(`
      INSERT INTO execution_node_execution_targets_lookup (node_id, backend_family, execution_target)
      VALUES (?, ?, ?)
    `);

    for (const target of toExecutionNodeExecutionTargets(record)) {
      insert.run(record.nodeId, target.backendFamily, target.executionTarget);
    }
  }

  private getExecutionNodeRowById(nodeId: string): ExecutionNodeRow | undefined {
    return this.getDatabase().prepare(`
      SELECT
        node_id,
        display_name,
        node_type,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        backend_family_capabilities_json,
        approval_status,
        trust_state,
        activation_status,
        health_status,
        availability_override_mode,
        availability_override_suppressed_until,
        availability_override_reason,
        availability_override_updated_at,
        deployment_tags_json,
        endpoint_ref,
        configuration_ref,
        certificate_ref,
        last_seen_at,
        metadata_json,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM execution_node_records
      WHERE node_id = ?
      LIMIT 1
    `).get(nodeId) as ExecutionNodeRow | undefined;
  }

  private getMutationReplayRecord(operationKey: string): ExecutionNodeRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        operation_key,
        mutation_kind,
        record_snapshot_json,
        created_at
      FROM execution_node_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as ExecutionNodeMutationReplayRow | undefined;

    return row ? parseExecutionNodeMutationReplayRecord(row) : undefined;
  }

  private persistMutationReplayRecord(
    operationKey: string,
    mutationKind: ExecutionNodeMutationKind,
    record: ExecutionNodeRecord,
  ): void {
    this.executeMutation("persist execution node mutation replay", () => this.getDatabase().prepare(`
        INSERT INTO execution_node_mutation_replays (
          operation_key,
          mutation_kind,
          record_snapshot_json,
          created_at
        ) VALUES (?, ?, ?, ?)
      `).run(operationKey, mutationKind, JSON.stringify(record), new Date().toISOString()));
  }

  private normalizeOperationKey(operationKey: string): string {
    try {
      return normalizePersistenceOperationKey(operationKey);
    } catch {
      throw new Error("Execution node persistence mutation operationKey is required.");
    }
  }

  private rebuildRecord(
    record: ExecutionNodeRecord,
    timestamps: {
      readonly createdAt: string;
      readonly updatedAt: string;
    },
  ): ExecutionNodeRecord {
    return mapExecutionNodeRowToRecord({
      node_id: record.nodeId,
      display_name: record.displayName,
      node_type: record.nodeType,
      capability_enabled_json: JSON.stringify(record.capabilityProfile.enabledCapabilities),
      capability_profile_version: record.capabilityProfile.capabilityProfileVersion ?? null,
      supports_remote_scheduling: record.capabilityProfile.supportsRemoteScheduling ? 1 : 0,
      max_concurrent_workloads: record.capabilityProfile.maxConcurrentWorkloads ?? null,
      backend_family_capabilities_json: JSON.stringify(record.backendFamilyCapabilities),
      approval_status: record.approvalStatus,
      trust_state: record.trustState,
      activation_status: record.activationStatus,
      health_status: record.healthStatus,
      availability_override_mode: record.availabilityOverride.mode,
      availability_override_suppressed_until: record.availabilityOverride.suppressedUntil ?? null,
      availability_override_reason: record.availabilityOverride.reason ?? null,
      availability_override_updated_at: record.availabilityOverride.updatedAt,
      deployment_tags_json: JSON.stringify(record.deploymentTags),
      endpoint_ref: record.endpoint.endpointRef,
      configuration_ref: record.endpoint.configurationRef ?? null,
      certificate_ref: record.certificateRef ?? null,
      last_seen_at: record.lastSeenAt ?? null,
      metadata_json: JSON.stringify(record.metadata),
      created_at: timestamps.createdAt,
      created_by: "system",
      last_modified_at: timestamps.updatedAt,
      last_modified_by: "system",
      revision: 1,
    });
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
    if (currentVersion > EXECUTION_NODE_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Execution node persistence schema version ${currentVersion} is newer than supported version ${EXECUTION_NODE_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of EXECUTION_NODE_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO execution_node_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS execution_node_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM execution_node_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}
