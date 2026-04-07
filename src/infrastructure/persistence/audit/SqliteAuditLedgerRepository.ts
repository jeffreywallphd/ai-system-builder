import fs from "node:fs";
import path from "node:path";
import type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "@application/audit/ports/AuditLedgerPersistencePorts";
import { normalizeAuditLedgerOperationKey } from "@application/audit/ports/AuditLedgerPersistencePorts";
import { AuditEventSortFields, AuditEventThinSafeCategories } from "@shared/contracts/audit/AuditEventContracts";
import { SharedApiSortDirections } from "@shared/contracts/api/SharedApiContractPrimitives";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import { createSqliteWhereBuilder } from "../common/SqliteQueryHelpers";
import {
  AUDIT_LEDGER_PERSISTENCE_MIGRATIONS,
  AUDIT_LEDGER_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteAuditLedgerPersistenceMigrations";
import {
  mapCanonicalAuditEventToRowValues,
  parseCanonicalAuditEventRow,
  type AuditLedgerEventRow,
  type AuditLedgerMutationReplayRow,
} from "./AuditLedgerPersistenceMapper";
import { AuditImmutabilityPostures, type CanonicalAuditEvent } from "@domain/audit/AuditDomain";

interface AuditLedgerTailRow {
  readonly sequence: number;
  readonly event_id: string;
  readonly integrity_event_digest: string | null;
}

const SqlSortFieldMap = Object.freeze({
  [AuditEventSortFields.occurredAt]: "occurred_at",
  [AuditEventSortFields.recordedAt]: "recorded_at",
  [AuditEventSortFields.eventType]: "event_type",
  [AuditEventSortFields.category]: "category",
  [AuditEventSortFields.outcome]: "outcome",
  [AuditEventSortFields.actorId]: "actor_id",
} as const);

export class SqliteAuditLedgerRepository extends SafeSqliteRepositoryBase implements IAuditLedgerRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {
    super("AuditLedger");
  }

  public async appendAuditEvent(
    event: CanonicalAuditEvent,
    context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    const operationKey = normalizeAuditLedgerOperationKey(context.operationKey);
    const replayRow = this.getMutationReplayByOperationKey(operationKey);
    if (replayRow) {
      const replayEvent = this.getAuditEventByIdInternal(replayRow.event_id);
      if (!replayEvent) {
        throw new Error(`Audit mutation replay '${operationKey}' references missing event '${replayRow.event_id}'.`);
      }

      return Object.freeze({
        changed: false,
        wasReplay: true,
        sequence: replayRow.sequence,
        event: replayEvent,
      });
    }

    const existing = this.getAuditEventRowByEventId(event.eventId);
    if (existing) {
      const existingEvent = parseCanonicalAuditEventRow(existing);
      if (JSON.stringify(existingEvent) !== JSON.stringify(event)) {
        throw new Error(`Audit event '${event.eventId}' already exists with different contents.`);
      }

      this.persistMutationReplay({
        operationKey,
        eventId: event.eventId,
        sequence: existing.sequence,
        context,
      });

      return Object.freeze({
        changed: false,
        wasReplay: false,
        sequence: existing.sequence,
        event: existingEvent,
      });
    }

    let insertedSequence = 0;
    this.getDatabase().transaction(() => {
      const previousTail = this.getLatestAuditLedgerTail();
      this.assertAppendIntegrityConstraints(event, previousTail);

      this.executeMutation("append canonical audit event", () => this.getDatabase().prepare(`
          INSERT INTO authoritative_audit_ledger_events (
            event_id,
            event_type,
            category,
            action,
            outcome,
            occurred_at,
            recorded_at,
            actor_id,
            actor_kind,
            actor_user_identity_id,
            actor_service_id,
            actor_session_id,
            scope_kind,
            scope_workspace_id,
            resource_type,
            resource_id,
            resource_ref,
            resource_sensitivity_class,
            resource_workspace_id,
            payload_has_protected_data,
            payload_redaction_reasons_json,
            payload_user_safe_json,
            payload_admin_only_json,
            integrity_schema_version,
            integrity_hash_algorithm,
            integrity_event_digest,
            integrity_previous_event_digest,
            retention,
            immutability,
            correlation_id,
            request_id,
            event_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...mapCanonicalAuditEventToRowValues(event)));

      const inserted = this.getAuditEventRowByEventId(event.eventId);
      if (!inserted) {
        throw new Error(`Audit event '${event.eventId}' was not persisted.`);
      }
      insertedSequence = inserted.sequence;
      if (previousTail && insertedSequence <= previousTail.sequence) {
        throw new Error(
          `Audit event '${event.eventId}' sequence '${insertedSequence}' is not monotonic after '${previousTail.sequence}'.`,
        );
      }

      this.persistMutationReplay({
        operationKey,
        eventId: event.eventId,
        sequence: insertedSequence,
        context,
      });
    })();

    return Object.freeze({
      changed: true,
      wasReplay: false,
      sequence: insertedSequence,
      event,
    });
  }

  public async listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    const whereClause = this.buildAuditEventsWhereClause(query);
    const limit = query.limit ?? query.pagination?.limit;
    const offset = query.offset ?? query.pagination?.offset;
    const paging = this.buildPagingClause(limit, offset);

    const sortBy = query.sorting?.sortBy;
    const sortDirection = query.sorting?.sortDirection === SharedApiSortDirections.ascending
      ? SharedApiSortDirections.ascending
      : SharedApiSortDirections.descending;
    const sortColumn = sortBy && sortBy in SqlSortFieldMap
      ? SqlSortFieldMap[sortBy as keyof typeof SqlSortFieldMap]
      : SqlSortFieldMap[AuditEventSortFields.occurredAt];
    const sortOrder = sortDirection === SharedApiSortDirections.ascending ? "ASC" : "DESC";

    const rows = this.getDatabase().prepare(`
      SELECT sequence, event_id, event_json
      FROM authoritative_audit_ledger_events
      ${whereClause.sql}
      ORDER BY ${sortColumn} ${sortOrder}, sequence ${sortOrder}
      ${paging.sql}
    `).all(...whereClause.params, ...paging.params) as AuditLedgerEventRow[];

    return Object.freeze(rows.map((row) => parseCanonicalAuditEventRow(row)));
  }

  public async countAuditEvents(query: AuditLedgerQuery): Promise<number> {
    const whereClause = this.buildAuditEventsWhereClause(query);
    const row = this.getDatabase().prepare(`
      SELECT COUNT(1) AS total_count
      FROM authoritative_audit_ledger_events
      ${whereClause.sql}
    `).get(...whereClause.params) as { total_count?: number } | undefined;
    return typeof row?.total_count === "number" ? row.total_count : 0;
  }

  public async getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined> {
    const normalizedEventId = normalizeOptional(eventId);
    if (!normalizedEventId) {
      return undefined;
    }
    return this.getAuditEventByIdInternal(normalizedEventId);
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
    if (currentVersion > AUDIT_LEDGER_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Audit ledger schema version ${currentVersion} is newer than supported version ${AUDIT_LEDGER_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of AUDIT_LEDGER_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO audit_ledger_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS audit_ledger_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM audit_ledger_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private getAuditEventRowByEventId(eventId: string): AuditLedgerEventRow | undefined {
    return this.getDatabase().prepare(`
      SELECT sequence, event_id, event_json
      FROM authoritative_audit_ledger_events
      WHERE event_id = ?
      LIMIT 1
    `).get(eventId) as AuditLedgerEventRow | undefined;
  }

  private getAuditEventByIdInternal(eventId: string): CanonicalAuditEvent | undefined {
    const row = this.getAuditEventRowByEventId(eventId);
    return row ? parseCanonicalAuditEventRow(row) : undefined;
  }

  private getMutationReplayByOperationKey(operationKey: string): AuditLedgerMutationReplayRow | undefined {
    return this.getDatabase().prepare(`
      SELECT operation_key, event_id, sequence
      FROM authoritative_audit_ledger_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as AuditLedgerMutationReplayRow | undefined;
  }

  private getLatestAuditLedgerTail(): AuditLedgerTailRow | undefined {
    return this.getDatabase().prepare(`
      SELECT sequence, event_id, integrity_event_digest
      FROM authoritative_audit_ledger_events
      ORDER BY sequence DESC
      LIMIT 1
    `).get() as AuditLedgerTailRow | undefined;
  }

  private assertAppendIntegrityConstraints(event: CanonicalAuditEvent, previousTail: AuditLedgerTailRow | undefined): void {
    const eventDigest = normalizeOptional(event.integrity.eventDigest);
    const previousEventDigest = normalizeOptional(event.integrity.previousEventDigest);
    const requiresHashChainDigest = event.immutability === AuditImmutabilityPostures.appendOnlyHashChained;

    if (requiresHashChainDigest && !eventDigest) {
      throw new Error(
        `Audit event '${event.eventId}' with immutability '${AuditImmutabilityPostures.appendOnlyHashChained}' requires integrity.eventDigest.`,
      );
    }

    if (!previousTail) {
      if (previousEventDigest) {
        throw new Error(
          `Audit event '${event.eventId}' cannot set integrity.previousEventDigest when no prior events exist.`,
        );
      }
      return;
    }

    if (requiresHashChainDigest && !previousEventDigest) {
      throw new Error(
        `Audit event '${event.eventId}' with immutability '${AuditImmutabilityPostures.appendOnlyHashChained}' requires integrity.previousEventDigest when prior events exist.`,
      );
    }

    if (!previousEventDigest) {
      return;
    }

    const expectedPreviousDigest = normalizeOptional(previousTail.integrity_event_digest ?? undefined);
    if (!expectedPreviousDigest) {
      throw new Error(
        `Audit event '${event.eventId}' cannot verify integrity.previousEventDigest because latest persisted event '${previousTail.event_id}' has no integrity.eventDigest.`,
      );
    }

    if (previousEventDigest !== expectedPreviousDigest) {
      throw new Error(
        `Audit event '${event.eventId}' integrity.previousEventDigest '${previousEventDigest}' does not match latest ledger digest '${expectedPreviousDigest}'.`,
      );
    }
  }

  private persistMutationReplay(input: {
    readonly operationKey: string;
    readonly eventId: string;
    readonly sequence: number;
    readonly context: AuditLedgerAppendContext;
  }): void {
    this.executeMutation("persist audit mutation replay", () => this.getDatabase().prepare(`
        INSERT INTO authoritative_audit_ledger_mutation_replays (
          operation_key,
          event_id,
          sequence,
          actor_id,
          correlation_id,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
      input.operationKey,
      input.eventId,
      input.sequence,
      input.context.actorId,
      normalizeOptional(input.context.correlationId),
      input.context.occurredAt ?? new Date().toISOString(),
      new Date().toISOString(),
    ));
  }

  private buildAuditEventsWhereClause(query: AuditLedgerQuery): { readonly sql: string; readonly params: readonly unknown[] } {
    const where = createSqliteWhereBuilder();
    const normalizedFilters = query.filters;

    where.addEquals("actor_id", query.actorId);
    where.addEquals("category", query.category);
    where.addEquals("event_type", query.eventType);

    const normalizedActionPrefix = normalizeOptional(query.actionPrefix) ?? normalizeOptional(normalizedFilters?.actionPrefix);
    if (normalizedActionPrefix) {
      where.add("action LIKE ?", `${normalizedActionPrefix}%`);
    }

    const actionFilters = normalizedFilters?.actions;
    if (actionFilters && actionFilters.length > 0) {
      where.addIn("action", actionFilters);
    }

    const categories = normalizedFilters?.categories ?? (query.category ? [query.category] : undefined);
    if (categories && categories.length > 0) {
      where.addIn("category", categories);
    }

    if (normalizedFilters?.includeThinSafeOnly) {
      where.addIn("category", AuditEventThinSafeCategories);
    }

    if (normalizedFilters?.outcomes && normalizedFilters.outcomes.length > 0) {
      where.addIn("outcome", normalizedFilters.outcomes);
    }

    const eventTypes = normalizedFilters?.eventTypes ?? (query.eventType ? [query.eventType] : undefined);
    if (eventTypes && eventTypes.length > 0) {
      where.addIn("event_type", eventTypes);
    }

    if (normalizedFilters?.actorIds && normalizedFilters.actorIds.length > 0) {
      where.addIn("actor_id", normalizedFilters.actorIds);
    }

    const workspaceId = normalizeOptional(query.workspaceId);
    if (workspaceId) {
      where.add("scope_workspace_id = ?", workspaceId);
    }

    if (normalizedFilters?.workspaceIds && normalizedFilters.workspaceIds.length > 0) {
      where.addIn("scope_workspace_id", normalizedFilters.workspaceIds);
    }

    if (normalizedFilters?.resourceTypes && normalizedFilters.resourceTypes.length > 0) {
      where.addIn("resource_type", normalizedFilters.resourceTypes);
    }

    if (normalizedFilters?.resourceIds && normalizedFilters.resourceIds.length > 0) {
      where.addIn("resource_id", normalizedFilters.resourceIds);
    }

    if (typeof normalizedFilters?.hasProtectedData === "boolean") {
      where.add("payload_has_protected_data = ?", normalizedFilters.hasProtectedData ? 1 : 0);
    }

    const occurredAfter = normalizeOptional(query.occurredAfter) ?? normalizeOptional(normalizedFilters?.occurredAfter);
    const occurredBefore = normalizeOptional(query.occurredBefore) ?? normalizeOptional(normalizedFilters?.occurredBefore);
    if (occurredAfter) {
      where.add("occurred_at >= ?", occurredAfter);
    }
    if (occurredBefore) {
      where.add("occurred_at <= ?", occurredBefore);
    }

    const search = normalizeOptional(query.search);
    if (search) {
      const pattern = `%${search}%`;
      where.add("(event_type LIKE ? OR action LIKE ? OR actor_id LIKE ? OR resource_ref LIKE ?)", pattern, pattern, pattern, pattern);
    }

    return where.build();
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
