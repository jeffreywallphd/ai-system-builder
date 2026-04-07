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
import { RunNodeClaimConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  AuthoritativeRunNodePlacementHoldRecord,
  AuthoritativeRunNodePlacementHoldResult,
  AuthoritativeRunDispatchAttemptResult,
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  AuthoritativeRunNodeClaimResult,
  IRunNodePlacementHoldRepository,
  IRunOrchestrationQueuePersistenceRepository,
  RunQueueEligibilityMarker,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { RunLifecycleState } from "@domain/runs/RunDomain";
import { RunNodePlacementHoldConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";

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
  readonly assignment_node_id: string | null;
  readonly assignment_claimed_at: string | null;
  readonly dispatch_prepared_at: string | null;
  readonly last_dispatch_attempt_id: string | null;
  readonly dequeued_at: string | null;
  readonly defer_count: number;
  readonly last_no_placement_category: string | null;
  readonly last_no_placement_reason_codes_json: string | null;
  readonly last_no_placement_reason_message: string | null;
  readonly last_no_placement_decision_id: string | null;
  readonly last_no_placement_recorded_at: string | null;
  readonly last_no_placement_admin_attention: number;
  readonly updated_at: string;
  readonly revision: number;
}

interface PlatformRunDispatchAttemptRow {
  readonly attempt_id: string;
  readonly run_id: string;
  readonly queue_id: string;
  readonly workspace_id: string | null;
  readonly node_id: string;
  readonly reservation_owner: string;
  readonly claim_token: string;
  readonly prepared_at: string;
  readonly dispatch_metadata_json: string;
  readonly dispatch_result_json: string | null;
}

interface PlatformRunNodePlacementHoldRow {
  readonly node_id: string;
  readonly hold_token: string;
  readonly run_id: string;
  readonly queue_id: string;
  readonly reservation_owner: string;
  readonly claim_token: string;
  readonly decision_id: string | null;
  readonly held_at: string;
  readonly expires_at: string;
  readonly updated_at: string;
  readonly created_at: string;
}

export class SqlitePlatformPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements
    IPlatformRunRecordRepository,
    IPlatformAuditEventRepository,
    IPlatformTransactionManager,
    IRunNodePlacementHoldRepository,
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

  public async listQueueEntries(query: {
    readonly workspaceId?: string;
    readonly queueId?: string;
    readonly lifecycleStates?: ReadonlyArray<RunLifecycleState>;
    readonly includeDequeued?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const whereBuilder = createSqliteWhereBuilder();
    whereBuilder.addEquals("workspace_id", normalizePlatformLookup(query.workspaceId ?? ""));
    whereBuilder.addEquals("queue_id", normalizePlatformLookup(query.queueId ?? ""));
    whereBuilder.addIn("lifecycle_state", query.lifecycleStates);
    if (!query.includeDequeued) {
      whereBuilder.add("dequeued_at IS NULL");
    }
    const where = whereBuilder.build();
    const paging = this.buildPagingClause(query.limit, query.offset);

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
        assignment_node_id,
        assignment_claimed_at,
        dispatch_prepared_at,
        last_dispatch_attempt_id,
        dequeued_at,
        defer_count,
        last_no_placement_category,
        last_no_placement_reason_codes_json,
        last_no_placement_reason_message,
        last_no_placement_decision_id,
        last_no_placement_recorded_at,
        last_no_placement_admin_attention,
        updated_at,
        revision
      FROM platform_run_orchestration_queue
      ${where.sql}
      ORDER BY eligible_at ASC, order_key ASC, entered_at ASC, run_id ASC
      ${paging.sql}
    `).all(...where.params, ...paging.params) as PlatformRunQueueRow[];

    return Object.freeze(rows.map((row) => this.mapQueueRowToRecord(row)));
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
      assignment_node_id: null,
      assignment_claimed_at: null,
      dispatch_prepared_at: null,
      last_dispatch_attempt_id: null,
      dequeued_at: null,
      defer_count: 0,
      last_no_placement_category: null,
      last_no_placement_reason_codes_json: null,
      last_no_placement_reason_message: null,
      last_no_placement_decision_id: null,
      last_no_placement_recorded_at: null,
      last_no_placement_admin_attention: 0,
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
          assignment_node_id,
          assignment_claimed_at,
          dispatch_prepared_at,
          last_dispatch_attempt_id,
          dequeued_at,
          defer_count,
          last_no_placement_category,
          last_no_placement_reason_codes_json,
          last_no_placement_reason_message,
          last_no_placement_decision_id,
          last_no_placement_recorded_at,
          last_no_placement_admin_attention,
          updated_at,
          revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      persistedRow.assignment_node_id,
      persistedRow.assignment_claimed_at,
      persistedRow.dispatch_prepared_at,
      persistedRow.last_dispatch_attempt_id,
      persistedRow.dequeued_at,
      persistedRow.defer_count,
      persistedRow.last_no_placement_category,
      persistedRow.last_no_placement_reason_codes_json,
      persistedRow.last_no_placement_reason_message,
      persistedRow.last_no_placement_decision_id,
      persistedRow.last_no_placement_recorded_at,
      persistedRow.last_no_placement_admin_attention,
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
        assignment_node_id,
        assignment_claimed_at,
        dispatch_prepared_at,
        last_dispatch_attempt_id,
        dequeued_at,
        defer_count,
        last_no_placement_category,
        last_no_placement_reason_codes_json,
        last_no_placement_reason_message,
        last_no_placement_decision_id,
        last_no_placement_recorded_at,
        last_no_placement_admin_attention,
        updated_at,
        revision
      FROM platform_run_orchestration_queue
      WHERE dequeued_at IS NULL
        AND eligibility_marker IN ('ready', 'deferred')
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
          AND eligibility_marker IN ('ready', 'deferred')
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
            AND eligibility_marker IN ('ready', 'deferred')
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
        assignment_node_id,
        assignment_claimed_at,
        dispatch_prepared_at,
        last_dispatch_attempt_id,
        dequeued_at,
        defer_count,
        last_no_placement_category,
        last_no_placement_reason_codes_json,
        last_no_placement_reason_message,
        last_no_placement_decision_id,
        last_no_placement_recorded_at,
        last_no_placement_admin_attention,
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

  public async deferRunClaimForNoPlacement(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly deferredAt: string;
    readonly reasonCategory: string;
    readonly reasonCodes: ReadonlyArray<string>;
    readonly reasonMessage: string;
    readonly decisionId?: string;
    readonly requiresAdministrativeAttention?: boolean;
    readonly initialDelaySeconds?: number;
    readonly maxDelaySeconds?: number;
    readonly multiplier?: number;
  }): Promise<AuthoritativeRunQueueMutationResult | undefined> {
    const runId = normalizePlatformLookup(input.runId);
    const claimToken = normalizePlatformLookup(input.claimToken);
    if (!runId || !claimToken) {
      return undefined;
    }

    const deferredAt = input.deferredAt.trim();
    if (!deferredAt || Number.isNaN(Date.parse(deferredAt))) {
      return undefined;
    }
    const existing = this.getQueueRowByRunId(runId);
    if (!existing || existing.claim_token !== claimToken || existing.dequeued_at) {
      return undefined;
    }

    const nextDeferCount = Math.max(0, existing.defer_count) + 1;
    const initialDelaySeconds = Math.max(1, Math.floor(input.initialDelaySeconds ?? 15));
    const multiplier = Math.max(1, input.multiplier ?? 2);
    const maxDelaySeconds = Math.max(initialDelaySeconds, Math.floor(input.maxDelaySeconds ?? 600));
    const rawDelaySeconds = initialDelaySeconds * Math.pow(multiplier, Math.max(0, nextDeferCount - 1));
    const delaySeconds = Math.max(1, Math.min(maxDelaySeconds, Math.floor(rawDelaySeconds)));
    const nextEligibleAt = new Date(Date.parse(deferredAt) + (delaySeconds * 1000)).toISOString();

    const reasonCategory = (normalizePlatformLookup(input.reasonCategory) ?? "policy-deferred");
    const reasonCodes = [...new Set(
      input.reasonCodes
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    )];
    const reasonCodesJson = reasonCodes.length > 0
      ? JSON.stringify(reasonCodes)
      : JSON.stringify(["unspecified-no-placement"]);
    const reasonMessage = input.reasonMessage.trim().slice(0, 512);
    const decisionId = normalizePlatformLookup(input.decisionId ?? "") ?? null;
    const adminAttention = input.requiresAdministrativeAttention ? 1 : 0;

    const mutationResult = this.executeMutation("defer run claim for no placement", () => this.getDatabase().prepare(`
        UPDATE platform_run_orchestration_queue
        SET
          eligibility_marker = 'deferred',
          eligible_at = ?,
          claim_token = NULL,
          claimed_by = NULL,
          claimed_at = NULL,
          claim_expires_at = NULL,
          defer_count = ?,
          last_no_placement_category = ?,
          last_no_placement_reason_codes_json = ?,
          last_no_placement_reason_message = ?,
          last_no_placement_decision_id = ?,
          last_no_placement_recorded_at = ?,
          last_no_placement_admin_attention = ?,
          updated_at = ?,
          revision = revision + 1
        WHERE run_id = ?
          AND claim_token = ?
          AND dequeued_at IS NULL
      `).run(
      nextEligibleAt,
      nextDeferCount,
      reasonCategory,
      reasonCodesJson,
      reasonMessage || "Run could not be placed and was deferred for re-evaluation.",
      decisionId,
      deferredAt,
      adminAttention,
      deferredAt,
      runId,
      claimToken,
    ));
    if (mutationResult.changes !== 1) {
      return undefined;
    }

    const nextRow = this.getQueueRowByRunId(runId);
    if (!nextRow) {
      return undefined;
    }
    return Object.freeze({
      changed: true,
      record: this.mapQueueRowToRecord(nextRow),
    });
  }

  public async acquireNodePlacementHold(input: {
    readonly holdToken: string;
    readonly runId: string;
    readonly queueId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly decisionId?: string;
    readonly heldAt: string;
    readonly expiresAt: string;
  }): Promise<AuthoritativeRunNodePlacementHoldResult> {
    const holdToken = normalizePlatformLookup(input.holdToken);
    const runId = normalizePlatformLookup(input.runId);
    const queueId = normalizePlatformLookup(input.queueId);
    const nodeId = normalizePlatformLookup(input.nodeId);
    const reservationOwner = normalizePlatformLookup(input.reservationOwner);
    const claimToken = normalizePlatformLookup(input.claimToken);
    const decisionId = normalizePlatformLookup(input.decisionId ?? "") ?? null;
    if (!holdToken || !runId || !queueId || !nodeId || !reservationOwner || !claimToken) {
      throw new Error(
        "Node placement hold acquisition requires holdToken, runId, queueId, nodeId, reservationOwner, and claimToken.",
      );
    }

    const heldAt = input.heldAt.trim();
    const expiresAt = input.expiresAt.trim();
    if (!heldAt || Number.isNaN(Date.parse(heldAt)) || !expiresAt || Number.isNaN(Date.parse(expiresAt))) {
      throw new Error("Node placement hold timestamps must be valid ISO strings.");
    }
    if (Date.parse(expiresAt) <= Date.parse(heldAt)) {
      throw new Error("Node placement hold expiresAt must be after heldAt.");
    }

    const acquireResult = this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        DELETE FROM platform_run_node_placement_holds
        WHERE node_id = ?
          AND expires_at <= ?
      `).run(nodeId, heldAt);

      const existing = this.getNodePlacementHoldRowByNodeId(nodeId);
      if (existing && existing.expires_at > heldAt && existing.hold_token !== holdToken) {
        return Object.freeze({
          outcome: "conflict" as const,
          currentHold: this.mapNodePlacementHoldRowToRecord(existing),
        });
      }

      this.getDatabase().prepare(`
        INSERT INTO platform_run_node_placement_holds (
          node_id,
          hold_token,
          run_id,
          queue_id,
          reservation_owner,
          claim_token,
          decision_id,
          held_at,
          expires_at,
          updated_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET
          hold_token = excluded.hold_token,
          run_id = excluded.run_id,
          queue_id = excluded.queue_id,
          reservation_owner = excluded.reservation_owner,
          claim_token = excluded.claim_token,
          decision_id = excluded.decision_id,
          held_at = excluded.held_at,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `).run(
        nodeId,
        holdToken,
        runId,
        queueId,
        reservationOwner,
        claimToken,
        decisionId,
        heldAt,
        expiresAt,
        heldAt,
        heldAt,
      );

      const acquired = this.getNodePlacementHoldRowByNodeId(nodeId);
      if (!acquired) {
        throw new Error(`Failed to acquire node placement hold for node '${nodeId}'.`);
      }
      return Object.freeze({
        outcome: "acquired" as const,
        hold: this.mapNodePlacementHoldRowToRecord(acquired),
      });
    })();

    if (acquireResult.outcome === "conflict") {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodePlacementHoldConflictReasons.heldByAnotherOwner,
          nodeId,
          message: `Node '${nodeId}' already has an active placement hold.`,
          currentHold: acquireResult.currentHold,
        }),
      });
    }

    return Object.freeze({
      outcome: "acquired",
      hold: acquireResult.hold,
    });
  }

  public async releaseNodePlacementHold(input: {
    readonly nodeId: string;
    readonly holdToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const nodeId = normalizePlatformLookup(input.nodeId);
    const holdToken = normalizePlatformLookup(input.holdToken);
    if (!nodeId || !holdToken) {
      return false;
    }

    const releasedAt = input.releasedAt.trim();
    const mutationResult = this.executeMutation("release node placement hold", () => this.getDatabase().prepare(`
        DELETE FROM platform_run_node_placement_holds
        WHERE node_id = ?
          AND hold_token = ?
      `).run(
      nodeId,
      holdToken,
    ));
    if (mutationResult.changes === 0) {
      return false;
    }

    this.executeMutation("cleanup expired node placement holds", () => this.getDatabase().prepare(`
        DELETE FROM platform_run_node_placement_holds
        WHERE expires_at <= ?
      `).run(releasedAt));

    return true;
  }

  public async claimQueuedRunForNodeDispatch(input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult> {
    const runId = normalizePlatformLookup(input.runId);
    const nodeId = normalizePlatformLookup(input.nodeId);
    const reservationOwner = normalizePlatformLookup(input.reservationOwner);
    const claimToken = normalizePlatformLookup(input.claimToken);
    const dispatchAttemptId = normalizePlatformLookup(input.dispatchAttemptId);
    if (!runId || !nodeId || !reservationOwner || !claimToken || !dispatchAttemptId) {
      throw new Error("Node dispatch claim requires runId, nodeId, reservationOwner, claimToken, and dispatchAttemptId.");
    }

    const preparedAt = input.preparedAt.trim();
    const existing = this.getQueueRowByRunId(runId);
    if (!existing) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.notFound,
          runId,
          nodeId,
          message: `Queued run '${runId}' was not found for node claim.`,
        }),
      });
    }

    if (existing.assignment_node_id) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.alreadyAssigned,
          runId,
          nodeId,
          message: `Run '${runId}' is already claimed by node '${existing.assignment_node_id}'.`,
          currentEntry: this.mapQueueRowToRecord(existing),
        }),
      });
    }

    if (
      existing.dequeued_at
      || (existing.lifecycle_state !== "queued" && existing.lifecycle_state !== "assignment-pending")
    ) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.queueStateConflict,
          runId,
          nodeId,
          message: `Run '${runId}' is not claimable from queue lifecycle state '${existing.lifecycle_state}'.`,
          currentEntry: this.mapQueueRowToRecord(existing),
        }),
      });
    }

    if (
      existing.claim_token !== claimToken
      || existing.claimed_by !== reservationOwner
      || !existing.claim_expires_at
      || existing.claim_expires_at < preparedAt
    ) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.reservationConflict,
          runId,
          nodeId,
          message: `Run '${runId}' reservation claim no longer matches the provided claim token and owner.`,
          currentEntry: this.mapQueueRowToRecord(existing),
        }),
      });
    }

    const claimed = this.getDatabase().transaction(() => {
      const updateResult = this.getDatabase().prepare(`
          UPDATE platform_run_orchestration_queue
          SET
            lifecycle_state = 'assigned',
            assignment_node_id = ?,
            assignment_claimed_at = ?,
          dispatch_prepared_at = ?,
          last_dispatch_attempt_id = ?,
          dequeued_at = ?,
          defer_count = 0,
          last_no_placement_category = NULL,
          last_no_placement_reason_codes_json = NULL,
          last_no_placement_reason_message = NULL,
          last_no_placement_decision_id = NULL,
          last_no_placement_recorded_at = NULL,
          last_no_placement_admin_attention = 0,
          updated_at = ?,
          revision = revision + 1
          WHERE run_id = ?
            AND claim_token = ?
            AND claimed_by = ?
            AND claim_expires_at IS NOT NULL
            AND claim_expires_at >= ?
            AND assignment_node_id IS NULL
            AND dequeued_at IS NULL
            AND lifecycle_state IN ('queued', 'assignment-pending')
        `).run(
        nodeId,
        preparedAt,
        preparedAt,
        dispatchAttemptId,
        preparedAt,
        preparedAt,
        runId,
        claimToken,
        reservationOwner,
        preparedAt,
      );
      if (updateResult.changes !== 1) {
        return false;
      }

      this.getDatabase().prepare(`
          INSERT INTO platform_run_dispatch_attempts (
            attempt_id,
            run_id,
            queue_id,
            workspace_id,
            node_id,
            reservation_owner,
            claim_token,
            prepared_at,
            dispatch_metadata_json,
            dispatch_result_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
        dispatchAttemptId,
        runId,
        existing.queue_id,
        existing.workspace_id,
        nodeId,
        reservationOwner,
        claimToken,
        preparedAt,
        JSON.stringify(input.dispatchMetadata),
        null,
        preparedAt,
      );
      return true;
    })();

    if (!claimed) {
      const conflicted = this.getQueueRowByRunId(runId);
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.queueStateConflict,
          runId,
          nodeId,
          message: `Run '${runId}' could not be claimed due to a concurrent queue state change.`,
          currentEntry: conflicted ? this.mapQueueRowToRecord(conflicted) : undefined,
        }),
      });
    }

    const claimedRow = this.getQueueRowByRunId(runId);
    if (!claimedRow) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.notFound,
          runId,
          nodeId,
          message: `Run '${runId}' disappeared after claim update.`,
        }),
      });
    }

    return Object.freeze({
      outcome: "claimed",
      queueEntry: this.mapQueueRowToRecord(claimedRow),
      dispatchAttempt: Object.freeze({
        attemptId: dispatchAttemptId,
        runId,
        queueId: existing.queue_id,
        workspaceId: normalizePlatformLookup(existing.workspace_id ?? ""),
        nodeId,
        reservationOwner,
        claimToken,
        preparedAt,
        dispatchMetadata: Object.freeze({ ...input.dispatchMetadata }),
      }),
    });
  }

  public async requeueAssignedRunForRecovery(input: {
    readonly runId: string;
    readonly requeuedAt: string;
    readonly eligibilityMarker?: RunQueueEligibilityMarker;
  }): Promise<boolean> {
    const runId = normalizePlatformLookup(input.runId);
    if (!runId) {
      return false;
    }

    const requeuedAt = input.requeuedAt.trim();
    const eligibilityMarker = input.eligibilityMarker ?? "ready";
    const mutationResult = this.executeMutation("requeue assigned run for recovery", () => this.getDatabase().prepare(`
        UPDATE platform_run_orchestration_queue
        SET
          lifecycle_state = 'queued',
          eligibility_marker = ?,
          claim_token = NULL,
          claimed_by = NULL,
          claimed_at = NULL,
          claim_expires_at = NULL,
          assignment_node_id = NULL,
          assignment_claimed_at = NULL,
          dispatch_prepared_at = NULL,
          last_dispatch_attempt_id = NULL,
          dequeued_at = NULL,
          defer_count = 0,
          last_no_placement_category = NULL,
          last_no_placement_reason_codes_json = NULL,
          last_no_placement_reason_message = NULL,
          last_no_placement_decision_id = NULL,
          last_no_placement_recorded_at = NULL,
          last_no_placement_admin_attention = 0,
          updated_at = ?,
          revision = revision + 1
        WHERE run_id = ?
          AND lifecycle_state = 'assigned'
      `).run(
      eligibilityMarker,
      requeuedAt,
      runId,
    ));

    return mutationResult.changes === 1;
  }

  public async recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    const runId = normalizePlatformLookup(input.runId);
    const attemptId = normalizePlatformLookup(input.attemptId);
    if (!runId || !attemptId) {
      return false;
    }

    const mutationResult = this.executeMutation("record dispatch attempt result", () => this.getDatabase().prepare(`
        UPDATE platform_run_dispatch_attempts
        SET dispatch_result_json = ?
        WHERE attempt_id = ?
          AND run_id = ?
      `).run(
      JSON.stringify(input.result),
      attemptId,
      runId,
    ));

    return mutationResult.changes === 1;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    const runId = normalizePlatformLookup(input.runId);
    if (!runId) {
      return false;
    }

    const finalizedAt = input.finalizedAt.trim();
    const mutationResult = this.executeMutation("finalize run queue entry", () => this.getDatabase().prepare(`
        UPDATE platform_run_orchestration_queue
        SET
          lifecycle_state = ?,
          claim_token = NULL,
          claimed_by = NULL,
          claimed_at = NULL,
          claim_expires_at = NULL,
          dequeued_at = COALESCE(dequeued_at, ?),
          updated_at = ?,
          revision = revision + 1
        WHERE run_id = ?
      `).run(
      input.lifecycleState,
      finalizedAt,
      finalizedAt,
      runId,
    ));

    return mutationResult.changes === 1;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    const normalizedRunId = normalizePlatformLookup(runId);
    if (!normalizedRunId) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase().prepare(`
      SELECT
        attempt_id,
        run_id,
        queue_id,
        workspace_id,
        node_id,
        reservation_owner,
        claim_token,
        prepared_at,
        dispatch_metadata_json,
        dispatch_result_json
      FROM platform_run_dispatch_attempts
      WHERE run_id = ?
      ORDER BY prepared_at DESC, attempt_id ASC
    `).all(normalizedRunId) as PlatformRunDispatchAttemptRow[];

    return Object.freeze(rows.map((row) => this.mapDispatchAttemptRowToRecord(row)));
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
        assignment_node_id,
        assignment_claimed_at,
        dispatch_prepared_at,
        last_dispatch_attempt_id,
        dequeued_at,
        defer_count,
        last_no_placement_category,
        last_no_placement_reason_codes_json,
        last_no_placement_reason_message,
        last_no_placement_decision_id,
        last_no_placement_recorded_at,
        last_no_placement_admin_attention,
        updated_at,
        revision
      FROM platform_run_orchestration_queue
      WHERE run_id = ?
      LIMIT 1
    `).get(runId) as PlatformRunQueueRow | undefined;
  }

  private getNodePlacementHoldRowByNodeId(nodeId: string): PlatformRunNodePlacementHoldRow | undefined {
    return this.getDatabase().prepare(`
      SELECT
        node_id,
        hold_token,
        run_id,
        queue_id,
        reservation_owner,
        claim_token,
        decision_id,
        held_at,
        expires_at,
        updated_at,
        created_at
      FROM platform_run_node_placement_holds
      WHERE node_id = ?
      LIMIT 1
    `).get(nodeId) as PlatformRunNodePlacementHoldRow | undefined;
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
      assignmentNodeId: normalizePlatformLookup(row.assignment_node_id ?? ""),
      assignmentClaimedAt: normalizePlatformLookup(row.assignment_claimed_at ?? ""),
      dispatchPreparedAt: normalizePlatformLookup(row.dispatch_prepared_at ?? ""),
      lastDispatchAttemptId: normalizePlatformLookup(row.last_dispatch_attempt_id ?? ""),
      dequeuedAt: normalizePlatformLookup(row.dequeued_at ?? ""),
      deferCount: row.defer_count,
      lastNoPlacementCategory: normalizePlatformLookup(row.last_no_placement_category ?? ""),
      lastNoPlacementReasonCodes: parseStringArrayJson(row.last_no_placement_reason_codes_json),
      lastNoPlacementReasonMessage: normalizePlatformLookup(row.last_no_placement_reason_message ?? ""),
      lastNoPlacementDecisionId: normalizePlatformLookup(row.last_no_placement_decision_id ?? ""),
      lastNoPlacementRecordedAt: normalizePlatformLookup(row.last_no_placement_recorded_at ?? ""),
      lastNoPlacementRequiresAdministrativeAttention: row.last_no_placement_admin_attention === 1,
      updatedAt: row.updated_at,
      revision: row.revision,
    });
  }

  private mapDispatchAttemptRowToRecord(row: PlatformRunDispatchAttemptRow): AuthoritativeRunDispatchAttemptRecord {
    return Object.freeze({
      attemptId: row.attempt_id,
      runId: row.run_id,
      queueId: row.queue_id,
      workspaceId: normalizePlatformLookup(row.workspace_id ?? ""),
      nodeId: row.node_id,
      reservationOwner: row.reservation_owner,
      claimToken: row.claim_token,
      preparedAt: row.prepared_at,
      dispatchMetadata: Object.freeze(JSON.parse(row.dispatch_metadata_json) as Record<string, unknown>),
      dispatchResult: row.dispatch_result_json
        ? Object.freeze(JSON.parse(row.dispatch_result_json) as AuthoritativeRunDispatchAttemptResult)
        : undefined,
    });
  }

  private mapNodePlacementHoldRowToRecord(row: PlatformRunNodePlacementHoldRow): AuthoritativeRunNodePlacementHoldRecord {
    return Object.freeze({
      holdToken: row.hold_token,
      runId: row.run_id,
      queueId: row.queue_id,
      nodeId: row.node_id,
      reservationOwner: row.reservation_owner,
      claimToken: row.claim_token,
      decisionId: normalizePlatformLookup(row.decision_id ?? ""),
      heldAt: row.held_at,
      expiresAt: row.expires_at,
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

function parseStringArrayJson(payload: string | null): ReadonlyArray<string> | undefined {
  const normalized = normalizePlatformLookup(payload ?? "");
  if (!normalized) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    const values = parsed
      .map((value) => typeof value === "string" ? value.trim() : "")
      .filter((value) => value.length > 0);
    return values.length > 0 ? Object.freeze(values) : undefined;
  } catch {
    return undefined;
  }
}

