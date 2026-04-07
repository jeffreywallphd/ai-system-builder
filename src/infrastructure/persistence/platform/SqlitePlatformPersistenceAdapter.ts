import fs from "node:fs";
import path from "node:path";
import type {
  IPlatformAuditEventRepository,
  IPlatformRunRecordRepository,
  PlatformAuditEventListQuery,
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { normalizePlatformPersistenceOperationKey } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapPlatformAuditEventRecordToRowValues,
  mapPlatformAuditEventRowToRecord,
  mapPlatformRunRecordToRowValues,
  mapPlatformRunRowToRecord,
  normalizePlatformLookup,
  parsePlatformAuditMutationReplayRecord,
  parsePlatformRunMutationReplayRecord,
  toPlatformAuditReplaySnapshot,
  toPlatformRunReplaySnapshot,
  type PlatformAuditEventRow,
  type PlatformMutationReplayRow,
  type PlatformRunRow,
} from "./PlatformPersistenceMapper";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import {
  createSqliteWhereBuilder,
} from "../common/SqliteQueryHelpers";
import { applyTenancyScopeFilter } from "../common/PersistenceTenancyScopeQuery";
import {
  PLATFORM_PERSISTENCE_MIGRATIONS,
  PLATFORM_PERSISTENCE_SCHEMA_VERSION,
} from "./SqlitePlatformPersistenceMigrations";

type PlatformMutationKind = "create-run" | "save-run" | "append-audit-event";

export class SqlitePlatformPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements IPlatformRunRecordRepository, IPlatformAuditEventRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {
    super("Platform");
  }

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    const normalizedRunId = normalizePlatformLookup(runId);
    if (!normalizedRunId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        run_id,
        run_kind,
        status,
        workspace_id,
        user_identity_id,
        source_aggregate_ref,
        initiated_at,
        started_at,
        completed_at,
        terminal_reason,
        metadata_json,
        actor_id,
        correlation_id,
        revision,
        schema_version
      FROM platform_run_records
      WHERE run_id = ?
      LIMIT 1
    `).get(normalizedRunId) as PlatformRunRow | undefined;

    return row ? mapPlatformRunRowToRecord(row) : undefined;
  }

  public async listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    const whereBuilder = createSqliteWhereBuilder();
    whereBuilder.addIn("run_kind", query.runKinds);
    whereBuilder.addIn("status", query.statuses);
    applyTenancyScopeFilter(whereBuilder, {
      workspaceId: query.workspaceId,
      userIdentityId: query.userIdentityId,
    }, {
      workspaceId: "workspace_id",
      userIdentityId: "user_identity_id",
    });
    whereBuilder.addEquals("source_aggregate_ref", query.sourceAggregateRef);
    if (query.initiatedAfter) {
      whereBuilder.add("initiated_at >= ?", query.initiatedAfter);
    }
    if (query.initiatedBefore) {
      whereBuilder.add("initiated_at <= ?", query.initiatedBefore);
    }
    const where = whereBuilder.build();
    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        run_id,
        run_kind,
        status,
        workspace_id,
        user_identity_id,
        source_aggregate_ref,
        initiated_at,
        started_at,
        completed_at,
        terminal_reason,
        metadata_json,
        actor_id,
        correlation_id,
        revision,
        schema_version
      FROM platform_run_records
      ${where.sql}
      ORDER BY initiated_at DESC, run_id ASC
      ${paging.sql}
    `).all(...where.params, ...paging.params) as PlatformRunRow[];

    return Object.freeze(rows.map((row) => mapPlatformRunRowToRecord(row)));
  }

  public async createRun(
    record: PlatformRunRecord,
    mutation: PlatformPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult> {
    return this.persistRunMutation("create-run", record, mutation, true);
  }

  public async saveRun(
    record: PlatformRunRecord,
    mutation: PlatformPersistenceMutationContext & {
      readonly expectedRevision?: number;
    },
  ): Promise<PlatformRunMutationResult> {
    return this.persistRunMutation("save-run", record, mutation, false, mutation.expectedRevision);
  }

  public async appendAuditEvent(
    event: PlatformAuditEventRecord,
    mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    const operationKey = normalizePlatformPersistenceOperationKey(mutation.operationKey);
    const replay = this.getAuditReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    const eventId = normalizePlatformLookup(event.eventId);
    if (!eventId) {
      throw new Error("Platform audit persistence requires eventId.");
    }

    const existing = this.getAuditEventByIdInternal(eventId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(event)) {
        throw new Error(`Platform audit event '${event.eventId}' already exists with different contents.`);
      }

      this.persistMutationReplayRecord(
        operationKey,
        "append-audit-event",
        "audit",
        existing.eventId,
        toPlatformAuditReplaySnapshot(existing),
        mutation,
      );

      return Object.freeze({
        changed: false,
        wasReplay: false,
        record: existing,
      });
    }

    this.executeMutation("append platform audit event", () => this.getDatabase().prepare(`
        INSERT INTO platform_audit_events (
          event_id,
          event_kind,
          action,
          actor_id,
          workspace_id,
          user_identity_id,
          target_ref,
          outcome,
          occurred_at,
          correlation_id,
          details_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
      ...mapPlatformAuditEventRecordToRowValues(event),
      new Date().toISOString(),
    ));

    this.persistMutationReplayRecord(
      operationKey,
      "append-audit-event",
      "audit",
      event.eventId,
      toPlatformAuditReplaySnapshot(event),
      mutation,
    );

    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }

  public async listAuditEvents(query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    const whereBuilder = createSqliteWhereBuilder();
    whereBuilder.addIn("event_kind", query.eventKinds);
    applyTenancyScopeFilter(whereBuilder, {
      workspaceId: query.workspaceId,
      userIdentityId: query.userIdentityId,
    }, {
      workspaceId: "workspace_id",
      userIdentityId: "user_identity_id",
    });
    whereBuilder.addEquals("actor_id", query.actorId);
    whereBuilder.addEquals("target_ref", query.targetRef);
    if (query.occurredAfter) {
      whereBuilder.add("occurred_at >= ?", query.occurredAfter);
    }
    if (query.occurredBefore) {
      whereBuilder.add("occurred_at <= ?", query.occurredBefore);
    }
    const where = whereBuilder.build();
    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        event_id,
        event_kind,
        action,
        actor_id,
        workspace_id,
        user_identity_id,
        target_ref,
        outcome,
        occurred_at,
        correlation_id,
        details_json
      FROM platform_audit_events
      ${where.sql}
      ORDER BY occurred_at DESC, event_id ASC
      ${paging.sql}
    `).all(...where.params, ...paging.params) as PlatformAuditEventRow[];

    return Object.freeze(rows.map((row) => mapPlatformAuditEventRowToRecord(row)));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistRunMutation(
    mutationKind: "create-run" | "save-run",
    record: PlatformRunRecord,
    mutation: PlatformPersistenceMutationContext,
    createOnly: boolean,
    expectedRevision?: number,
  ): PlatformRunMutationResult {
    const operationKey = normalizePlatformPersistenceOperationKey(mutation.operationKey);
    const replay = this.getRunReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    const runId = normalizePlatformLookup(record.runId);
    if (!runId) {
      throw new Error("Platform run persistence requires runId.");
    }

    const existing = this.getRunByIdInternal(runId);
    if (createOnly && existing) {
      throw new Error(`Platform run '${record.runId}' already exists.`);
    }

    this.assertExpectedRevision(expectedRevision, existing?.revision, "Platform run");

    const createdAt = existing ? existing.initiatedAt : record.initiatedAt;
    const changedAt = this.resolveMutationTimestamp(mutation.occurredAt);
    const persistedRecord: PlatformRunRecord = Object.freeze({
      ...record,
      revision: existing ? existing.revision + 1 : Math.max(1, record.revision),
    });

    const mutationResult = this.executeMutation("upsert platform run record", () => this.getDatabase().prepare(`
        INSERT INTO platform_run_records (
          run_id,
          run_kind,
          status,
          workspace_id,
          user_identity_id,
          source_aggregate_ref,
          initiated_at,
          started_at,
          completed_at,
          terminal_reason,
          metadata_json,
          actor_id,
          correlation_id,
          revision,
          schema_version,
          created_at,
          last_modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          run_kind = excluded.run_kind,
          status = excluded.status,
          workspace_id = excluded.workspace_id,
          user_identity_id = excluded.user_identity_id,
          source_aggregate_ref = excluded.source_aggregate_ref,
          initiated_at = excluded.initiated_at,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          terminal_reason = excluded.terminal_reason,
          metadata_json = excluded.metadata_json,
          actor_id = excluded.actor_id,
          correlation_id = excluded.correlation_id,
          revision = excluded.revision,
          schema_version = excluded.schema_version,
          created_at = excluded.created_at,
          last_modified_at = excluded.last_modified_at
        WHERE excluded.revision > platform_run_records.revision
      `).run(...mapPlatformRunRecordToRowValues(persistedRecord, {
      actorId: mutation.actorId,
      correlationId: mutation.correlationId,
      revision: persistedRecord.revision,
      createdAt,
      lastModifiedAt: changedAt,
    })));

    if (mutationResult.changes === 0) {
      const persisted = this.getRunByIdInternal(runId);
      if (persisted && persisted.revision >= persistedRecord.revision) {
        throw new Error(
          `Platform run persistence conflict while saving run '${record.runId}': a newer record already exists.`,
        );
      }
    }

    this.persistMutationReplayRecord(
      operationKey,
      mutationKind,
      "run",
      persistedRecord.runId,
      toPlatformRunReplaySnapshot(persistedRecord, mutation.actorId, mutation.correlationId),
      mutation,
    );

    return Object.freeze({
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(persistedRecord),
      wasReplay: false,
      record: persistedRecord,
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
    if (currentVersion > PLATFORM_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Platform persistence schema version ${currentVersion} is newer than supported version ${PLATFORM_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of PLATFORM_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO platform_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS platform_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM platform_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private getRunByIdInternal(runId: string): PlatformRunRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        run_id,
        run_kind,
        status,
        workspace_id,
        user_identity_id,
        source_aggregate_ref,
        initiated_at,
        started_at,
        completed_at,
        terminal_reason,
        metadata_json,
        actor_id,
        correlation_id,
        revision,
        schema_version
      FROM platform_run_records
      WHERE run_id = ?
      LIMIT 1
    `).get(runId) as PlatformRunRow | undefined;

    return row ? mapPlatformRunRowToRecord(row) : undefined;
  }

  private getAuditEventByIdInternal(eventId: string): PlatformAuditEventRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        event_id,
        event_kind,
        action,
        actor_id,
        workspace_id,
        user_identity_id,
        target_ref,
        outcome,
        occurred_at,
        correlation_id,
        details_json
      FROM platform_audit_events
      WHERE event_id = ?
      LIMIT 1
    `).get(eventId) as PlatformAuditEventRow | undefined;

    return row ? mapPlatformAuditEventRowToRecord(row) : undefined;
  }

  private getRunReplayRecord(operationKey: string): PlatformRunRecord | undefined {
    const row = this.getMutationReplayRecord(operationKey, "run");
    return row ? parsePlatformRunMutationReplayRecord(row) : undefined;
  }

  private getAuditReplayRecord(operationKey: string): PlatformAuditEventRecord | undefined {
    const row = this.getMutationReplayRecord(operationKey, "audit");
    return row ? parsePlatformAuditMutationReplayRecord(row) : undefined;
  }

  private getMutationReplayRecord(
    operationKey: string,
    scope: "run" | "audit",
  ): PlatformMutationReplayRow | undefined {
    return this.getDatabase().prepare(`
      SELECT
        operation_key,
        mutation_kind,
        record_scope,
        record_id,
        record_snapshot_json,
        actor_id,
        correlation_id,
        occurred_at,
        created_at
      FROM platform_persistence_mutation_replays
      WHERE operation_key = ?
        AND record_scope = ?
      LIMIT 1
    `).get(operationKey, scope) as PlatformMutationReplayRow | undefined;
  }

  private persistMutationReplayRecord(
    operationKey: string,
    mutationKind: PlatformMutationKind,
    recordScope: "run" | "audit",
    recordId: string,
    recordSnapshotJson: string,
    mutation: PlatformPersistenceMutationContext,
  ): void {
    this.executeMutation("persist platform mutation replay", () => this.getDatabase().prepare(`
        INSERT INTO platform_persistence_mutation_replays (
          operation_key,
          mutation_kind,
          record_scope,
          record_id,
          record_snapshot_json,
          actor_id,
          correlation_id,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
      operationKey,
      mutationKind,
      recordScope,
      recordId,
      recordSnapshotJson,
      mutation.actorId,
      mutation.correlationId ?? null,
      this.resolveMutationTimestamp(mutation.occurredAt),
      new Date().toISOString(),
    ));
  }

  private assertExpectedRevision(
    expectedRevision: number | undefined,
    persistedRevision: number | undefined,
    entityName: string,
  ): void {
    if (typeof expectedRevision !== "number") {
      return;
    }

    const currentRevision = persistedRevision ?? 0;
    if (expectedRevision !== currentRevision) {
      throw new Error(
        `${entityName} expectedRevision '${expectedRevision}' did not match persisted revision '${currentRevision}'.`,
      );
    }
  }

}

