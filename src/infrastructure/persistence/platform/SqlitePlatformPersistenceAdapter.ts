import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
import type { IPlatformTransactionManager } from "@application/common/ports/PlatformTransactionPorts";
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
import { SqliteTransactionCoordinator } from "../sqlite/SqliteTransactionCoordinator";
import type {
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IRunOrchestrationQueuePersistenceRepository,
  RunQueueEligibilityMarker,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { RunLifecycleState } from "@domain/runs/RunDomain";

type PlatformMutationKind = "create-run" | "save-run" | "append-audit-event";

interface PlatformRunQueueRow {
  readonly run_id: string;
  readonly queue_id: string;
  readonly workspace_id: string | null;
  readonly lifecycle_state: string;
  readonly entered_at: string;
  readonly order_key: string;
  readonly eligibility_marker: RunQueueEligibilityMarker;
  readonly eligible_at: string;
  readonly claim_token: string | null;
  readonly claimed_by: string | null;
  readonly claimed_at: string | null;
  readonly claim_expires_at: string | null;
  readonly dequeued_at: string | null;
  readonly updated_at: string;
  readonly revision: number;
}

export class SqlitePlatformPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements
    IPlatformRunRecordRepository,
    IPlatformAuditEventRepository,
    IPlatformTransactionManager,
    IRunOrchestrationQueuePersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;
  private readonly transactionCoordinator: SqliteTransactionCoordinator;

  public constructor(private readonly databasePath: string) {
    super("Platform");
    this.transactionCoordinator = new SqliteTransactionCoordinator(() => this.getDatabase());
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

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    const normalizedRunId = normalizePlatformLookup(runId);
    if (!normalizedRunId) {
      return undefined;
    }

    const row = this.getQueueRowByRunId(normalizedRunId);
    return row ? this.mapQueueRowToRecord(row) : undefined;
  }

  public async enqueueRunForAssignment(
    record: Omit<
      AuthoritativeRunQueueEntryRecord,
      "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision"
    >,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    const runId = normalizePlatformLookup(record.runId);
    if (!runId) {
      throw new Error("Run queue persistence requires runId.");
    }

    const existing = this.getQueueRowByRunId(runId);
    if (existing) {
      return Object.freeze({
        changed: false,
        record: this.mapQueueRowToRecord(existing),
      });
    }

    const persistedRow: PlatformRunQueueRow = Object.freeze({
      run_id: runId,
      queue_id: record.queueId.trim(),
      workspace_id: normalizePlatformLookup(record.workspaceId ?? "") ?? null,
      lifecycle_state: record.lifecycleState,
      entered_at: record.enteredAt.trim(),
      order_key: record.orderKey.trim(),
      eligibility_marker: record.eligibilityMarker,
      eligible_at: record.eligibleAt.trim(),
      claim_token: null,
      claimed_by: null,
      claimed_at: null,
      claim_expires_at: null,
      dequeued_at: null,
      updated_at: record.updatedAt.trim(),
      revision: 1,
    });

    this.executeMutation("enqueue run for assignment", () => this.getDatabase().prepare(`
        INSERT INTO platform_run_orchestration_queue (
          run_id,
          queue_id,
          workspace_id,
          lifecycle_state,
          entered_at,
          order_key,
          eligibility_marker,
          eligible_at,
          claim_token,
          claimed_by,
          claimed_at,
          claim_expires_at,
          dequeued_at,
          updated_at,
          revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
      persistedRow.run_id,
      persistedRow.queue_id,
      persistedRow.workspace_id,
      persistedRow.lifecycle_state,
      persistedRow.entered_at,
      persistedRow.order_key,
      persistedRow.eligibility_marker,
      persistedRow.eligible_at,
      persistedRow.claim_token,
      persistedRow.claimed_by,
      persistedRow.claimed_at,
      persistedRow.claim_expires_at,
      persistedRow.dequeued_at,
      persistedRow.updated_at,
      persistedRow.revision,
    ));

    return Object.freeze({
      changed: true,
      record: this.mapQueueRowToRecord(persistedRow),
    });
  }

  public async listAssignmentReadyRuns(query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const asOf = query.asOf.trim();
    const limit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0
      ? query.limit as number
      : 10;
    const queueId = normalizePlatformLookup(query.queueId ?? "");
    const workspaceId = normalizePlatformLookup(query.workspaceId ?? "");

    const rows = this.getDatabase().prepare(`
      SELECT
        run_id,
        queue_id,
        workspace_id,
        lifecycle_state,
        entered_at,
        order_key,
        eligibility_marker,
        eligible_at,
        claim_token,
        claimed_by,
        claimed_at,
        claim_expires_at,
        dequeued_at,
        updated_at,
        revision
      FROM platform_run_orchestration_queue
      WHERE dequeued_at IS NULL
        AND eligibility_marker = 'ready'
        AND eligible_at <= ?
        AND (? IS NULL OR queue_id = ?)
        AND (? IS NULL OR workspace_id = ?)
        AND (claim_token IS NULL OR claim_expires_at <= ?)
      ORDER BY eligible_at ASC, order_key ASC, entered_at ASC, run_id ASC
      LIMIT ?
    `).all(
      asOf,
      queueId ?? null,
      queueId ?? null,
      workspaceId ?? null,
      workspaceId ?? null,
      asOf,
      limit,
    ) as PlatformRunQueueRow[];

    return Object.freeze(rows.map((row) => this.mapQueueRowToRecord(row)));
  }

  public async claimAssignmentReadyRuns(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const asOf = input.asOf.trim();
    const limit = Math.max(1, input.limit);
    const reservationOwner = input.reservationOwner.trim();
    if (!reservationOwner) {
      return Object.freeze([]);
    }
    const reservationTtlSeconds = Math.max(1, input.reservationTtlSeconds);
    const queueId = normalizePlatformLookup(input.queueId ?? "");
    const workspaceId = normalizePlatformLookup(input.workspaceId ?? "");
    const claimExpiresAt = new Date(Date.parse(asOf) + (reservationTtlSeconds * 1000)).toISOString();

    const claimedRunIds = this.getDatabase().transaction(() => {
      const candidateRows = this.getDatabase().prepare(`
        SELECT run_id
        FROM platform_run_orchestration_queue
        WHERE dequeued_at IS NULL
          AND eligibility_marker = 'ready'
          AND eligible_at <= ?
          AND (? IS NULL OR queue_id = ?)
          AND (? IS NULL OR workspace_id = ?)
          AND (claim_token IS NULL OR claim_expires_at <= ?)
        ORDER BY eligible_at ASC, order_key ASC, entered_at ASC, run_id ASC
        LIMIT ?
      `).all(
        asOf,
        queueId ?? null,
        queueId ?? null,
        workspaceId ?? null,
        workspaceId ?? null,
        asOf,
        limit,
      ) as Array<{ run_id: string }>;

      const runIds: string[] = [];
      for (const candidateRow of candidateRows) {
        const claimToken = `queue-claim:${randomUUID()}`;
        const mutationResult = this.getDatabase().prepare(`
          UPDATE platform_run_orchestration_queue
          SET
            claim_token = ?,
            claimed_by = ?,
            claimed_at = ?,
            claim_expires_at = ?,
            updated_at = ?,
            revision = revision + 1
          WHERE run_id = ?
            AND dequeued_at IS NULL
            AND eligibility_marker = 'ready'
            AND eligible_at <= ?
            AND (claim_token IS NULL OR claim_expires_at <= ?)
        `).run(
          claimToken,
          reservationOwner,
          asOf,
          claimExpiresAt,
          asOf,
          candidateRow.run_id,
          asOf,
          asOf,
        );
        if (mutationResult.changes === 1) {
          runIds.push(candidateRow.run_id);
        }
      }

      return runIds;
    })();

    if (claimedRunIds.length === 0) {
      return Object.freeze([]);
    }

    const placeholders = claimedRunIds.map(() => "?").join(", ");
    const rows = this.getDatabase().prepare(`
      SELECT
        run_id,
        queue_id,
        workspace_id,
        lifecycle_state,
        entered_at,
        order_key,
        eligibility_marker,
        eligible_at,
        claim_token,
        claimed_by,
        claimed_at,
        claim_expires_at,
        dequeued_at,
        updated_at,
        revision
      FROM platform_run_orchestration_queue
      WHERE run_id IN (${placeholders})
      ORDER BY eligible_at ASC, order_key ASC, entered_at ASC, run_id ASC
    `).all(...claimedRunIds) as PlatformRunQueueRow[];

    return Object.freeze(rows.map((row) => this.mapQueueRowToRecord(row)));
  }

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const runId = normalizePlatformLookup(input.runId);
    const claimToken = normalizePlatformLookup(input.claimToken);
    if (!runId || !claimToken) {
      return false;
    }

    const releasedAt = input.releasedAt.trim();
    const mutationResult = this.executeMutation("release run claim", () => this.getDatabase().prepare(`
        UPDATE platform_run_orchestration_queue
        SET
          claim_token = NULL,
          claimed_by = NULL,
          claimed_at = NULL,
          claim_expires_at = NULL,
          updated_at = ?,
          revision = revision + 1
        WHERE run_id = ?
          AND claim_token = ?
          AND dequeued_at IS NULL
      `).run(
      releasedAt,
      runId,
      claimToken,
    ));

    return mutationResult.changes === 1;
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

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    return this.transactionCoordinator.runInTransaction(operation);
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

  private getQueueRowByRunId(runId: string): PlatformRunQueueRow | undefined {
    return this.getDatabase().prepare(`
      SELECT
        run_id,
        queue_id,
        workspace_id,
        lifecycle_state,
        entered_at,
        order_key,
        eligibility_marker,
        eligible_at,
        claim_token,
        claimed_by,
        claimed_at,
        claim_expires_at,
        dequeued_at,
        updated_at,
        revision
      FROM platform_run_orchestration_queue
      WHERE run_id = ?
      LIMIT 1
    `).get(runId) as PlatformRunQueueRow | undefined;
  }

  private mapQueueRowToRecord(row: PlatformRunQueueRow): AuthoritativeRunQueueEntryRecord {
    return Object.freeze({
      runId: row.run_id,
      queueId: row.queue_id,
      workspaceId: normalizePlatformLookup(row.workspace_id ?? ""),
      lifecycleState: row.lifecycle_state as RunLifecycleState,
      enteredAt: row.entered_at,
      orderKey: row.order_key,
      eligibilityMarker: row.eligibility_marker,
      eligibleAt: row.eligible_at,
      claimToken: normalizePlatformLookup(row.claim_token ?? ""),
      claimedBy: normalizePlatformLookup(row.claimed_by ?? ""),
      claimedAt: normalizePlatformLookup(row.claimed_at ?? ""),
      claimExpiresAt: normalizePlatformLookup(row.claim_expires_at ?? ""),
      dequeuedAt: normalizePlatformLookup(row.dequeued_at ?? ""),
      updatedAt: row.updated_at,
      revision: row.revision,
    });
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

