import {
  PlatformAuditEventKinds,
  PlatformAuditOutcomes,
  PlatformRunKinds,
  PlatformRunStatuses,
  parsePlatformAuditEventPersistenceRecord,
  parsePlatformRunPersistenceRecord,
  type PlatformAuditEventKind,
  type PlatformAuditEventPersistenceRecord,
  type PlatformAuditOutcome,
  type PlatformRunKind,
  type PlatformRunPersistenceRecord,
  type PlatformRunStatus,
} from "../../../shared/dto/platform/PlatformPersistenceDtos";
import { parsePersistenceReplaySnapshot } from "../../../shared/dto/persistence/PersistenceMapperBoundary";
import type { PersistenceTenancyMetadata } from "../../../shared/dto/persistence/PersistenceBoundaryDtos";
import type {
  PlatformAuditEventRecord,
  PlatformRunRecord,
} from "../../../application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  createPersistenceTenancyMetadataFromLookup,
  normalizePersistenceLookup,
  parseOptionalPersistenceObjectJson,
  toPersistenceTenancyScopeFields,
} from "../common/PersistenceMapperUtilities";

const PlatformRunSchemaVersion = 1;

export interface PlatformRunRow {
  readonly run_id: string;
  readonly run_kind: PlatformRunKind;
  readonly status: PlatformRunStatus;
  readonly workspace_id: string | null;
  readonly user_identity_id: string | null;
  readonly source_aggregate_ref: string;
  readonly initiated_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly terminal_reason: string | null;
  readonly metadata_json: string | null;
  readonly actor_id: string;
  readonly correlation_id: string | null;
  readonly revision: number;
  readonly schema_version: number;
}

export interface PlatformAuditEventRow {
  readonly event_id: string;
  readonly event_kind: PlatformAuditEventKind;
  readonly action: string;
  readonly actor_id: string;
  readonly workspace_id: string | null;
  readonly user_identity_id: string | null;
  readonly target_ref: string | null;
  readonly outcome: PlatformAuditOutcome;
  readonly occurred_at: string;
  readonly correlation_id: string | null;
  readonly details_json: string | null;
}

export interface PlatformMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: "create-run" | "save-run" | "append-audit-event";
  readonly record_scope: "run" | "audit";
  readonly record_id: string;
  readonly record_snapshot_json: string;
  readonly actor_id: string;
  readonly correlation_id: string | null;
  readonly occurred_at: string;
  readonly created_at: string;
}

export function normalizePlatformLookup(value: string): string | undefined {
  return normalizePersistenceLookup(value);
}

export function mapPlatformRunRowToRecord(row: PlatformRunRow): PlatformRunRecord {
  return toApplicationRunRecord(parsePlatformRunPersistenceRecord({
    runId: row.run_id,
    runKind: assertPlatformRunKind(row.run_kind),
    status: assertPlatformRunStatus(row.status),
    sourceAggregateRef: row.source_aggregate_ref,
    initiatedAt: row.initiated_at,
    startedAt: normalizePlatformLookup(row.started_at ?? ""),
    completedAt: normalizePlatformLookup(row.completed_at ?? ""),
    terminalReason: normalizePlatformLookup(row.terminal_reason ?? ""),
    metadata: parseOptionalPersistenceObjectJson(row.metadata_json, "platform"),
    tenancy: toTenancyMetadata(row.workspace_id ?? undefined, row.user_identity_id ?? undefined),
    actorUserIdentityId: row.actor_id,
    correlationId: normalizePlatformLookup(row.correlation_id ?? ""),
    revision: row.revision,
    schemaVersion: row.schema_version || PlatformRunSchemaVersion,
  }));
}

export function mapPlatformRunRecordToRowValues(
  record: PlatformRunRecord,
  options: {
    readonly actorId: string;
    readonly correlationId?: string;
    readonly revision: number;
    readonly createdAt: string;
    readonly lastModifiedAt: string;
  },
): ReadonlyArray<unknown> {
  const persistenceRecord = toPlatformRunPersistenceRecord(record, options.actorId, options.correlationId, options.revision);
  const scope = toScopeFields(persistenceRecord.tenancy);
  return Object.freeze([
    persistenceRecord.runId,
    persistenceRecord.runKind,
    persistenceRecord.status,
    scope.workspaceId ?? null,
    scope.userIdentityId ?? null,
    persistenceRecord.sourceAggregateRef,
    persistenceRecord.initiatedAt,
    persistenceRecord.startedAt ?? null,
    persistenceRecord.completedAt ?? null,
    persistenceRecord.terminalReason ?? null,
    persistenceRecord.metadata ? JSON.stringify(persistenceRecord.metadata) : null,
    options.actorId,
    options.correlationId ?? null,
    persistenceRecord.revision,
    persistenceRecord.schemaVersion,
    options.createdAt,
    options.lastModifiedAt,
  ]);
}

export function mapPlatformAuditEventRowToRecord(row: PlatformAuditEventRow): PlatformAuditEventRecord {
  return toApplicationAuditRecord(parsePlatformAuditEventPersistenceRecord({
    eventId: row.event_id,
    eventKind: assertPlatformAuditEventKind(row.event_kind),
    action: row.action,
    actorId: row.actor_id,
    targetRef: normalizePlatformLookup(row.target_ref ?? ""),
    outcome: assertPlatformAuditOutcome(row.outcome),
    occurredAt: row.occurred_at,
    details: parseOptionalPersistenceObjectJson(row.details_json, "platform"),
    tenancy: toTenancyMetadata(row.workspace_id ?? undefined, row.user_identity_id ?? undefined),
    correlationId: normalizePlatformLookup(row.correlation_id ?? ""),
  }));
}

export function mapPlatformAuditEventRecordToRowValues(
  event: PlatformAuditEventRecord,
): ReadonlyArray<unknown> {
  const persistenceRecord = toPlatformAuditPersistenceRecord(event);
  const scope = toScopeFields(persistenceRecord.tenancy);
  return Object.freeze([
    persistenceRecord.eventId,
    persistenceRecord.eventKind,
    persistenceRecord.action,
    persistenceRecord.actorId,
    scope.workspaceId ?? null,
    scope.userIdentityId ?? null,
    persistenceRecord.targetRef ?? null,
    persistenceRecord.outcome,
    persistenceRecord.occurredAt,
    persistenceRecord.correlationId ?? null,
    persistenceRecord.details ? JSON.stringify(persistenceRecord.details) : null,
  ]);
}

export function parsePlatformRunMutationReplayRecord(row: PlatformMutationReplayRow): PlatformRunRecord {
  return parsePersistenceReplaySnapshot(
    row.record_snapshot_json,
    (payload) => toApplicationRunRecord(parsePlatformRunPersistenceRecord(payload)),
  );
}

export function parsePlatformAuditMutationReplayRecord(row: PlatformMutationReplayRow): PlatformAuditEventRecord {
  return parsePersistenceReplaySnapshot(
    row.record_snapshot_json,
    (payload) => toApplicationAuditRecord(parsePlatformAuditEventPersistenceRecord(payload)),
  );
}

export function toPlatformRunReplaySnapshot(
  record: PlatformRunRecord,
  actorId: string,
  correlationId?: string,
): string {
  return JSON.stringify(toPlatformRunPersistenceRecord(record, actorId, correlationId));
}

export function toPlatformAuditReplaySnapshot(record: PlatformAuditEventRecord): string {
  return JSON.stringify(toPlatformAuditPersistenceRecord(record));
}

function toPlatformRunPersistenceRecord(
  record: PlatformRunRecord,
  actorId: string,
  correlationId?: string,
  revisionOverride?: number,
): PlatformRunPersistenceRecord {
  return parsePlatformRunPersistenceRecord({
    runId: record.runId,
    runKind: record.runKind,
    status: record.status,
    sourceAggregateRef: record.sourceAggregateRef,
    initiatedAt: record.initiatedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    terminalReason: record.terminalReason,
    metadata: record.metadata,
    tenancy: toTenancyMetadata(record.workspaceId, record.userIdentityId),
    actorUserIdentityId: actorId,
    correlationId: correlationId,
    revision: revisionOverride ?? record.revision,
    schemaVersion: PlatformRunSchemaVersion,
  });
}

function toPlatformAuditPersistenceRecord(record: PlatformAuditEventRecord): PlatformAuditEventPersistenceRecord {
  return parsePlatformAuditEventPersistenceRecord({
    eventId: record.eventId,
    eventKind: record.eventKind,
    action: record.action,
    actorId: record.actorId,
    targetRef: record.targetRef,
    outcome: record.outcome,
    occurredAt: record.occurredAt,
    details: record.details,
    tenancy: toTenancyMetadata(record.workspaceId, record.userIdentityId),
    correlationId: record.correlationId,
  });
}

function toApplicationRunRecord(record: PlatformRunPersistenceRecord): PlatformRunRecord {
  const scope = toScopeFields(record.tenancy);
  return Object.freeze({
    runId: record.runId,
    runKind: record.runKind,
    status: record.status,
    workspaceId: scope.workspaceId,
    userIdentityId: scope.userIdentityId,
    sourceAggregateRef: record.sourceAggregateRef,
    initiatedAt: record.initiatedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    terminalReason: record.terminalReason,
    metadata: record.metadata,
    revision: record.revision,
  });
}

function toApplicationAuditRecord(record: PlatformAuditEventPersistenceRecord): PlatformAuditEventRecord {
  const scope = toScopeFields(record.tenancy);
  return Object.freeze({
    eventId: record.eventId,
    eventKind: record.eventKind,
    action: record.action,
    actorId: record.actorId,
    workspaceId: scope.workspaceId,
    userIdentityId: scope.userIdentityId,
    targetRef: record.targetRef,
    outcome: record.outcome,
    occurredAt: record.occurredAt,
    correlationId: record.correlationId,
    details: record.details,
  });
}

function toTenancyMetadata(workspaceId?: string, userIdentityId?: string): PersistenceTenancyMetadata {
  return createPersistenceTenancyMetadataFromLookup({
    workspaceId,
    userIdentityId,
  });
}

function toScopeFields(
  tenancy: PersistenceTenancyMetadata,
): { readonly workspaceId?: string; readonly userIdentityId?: string } {
  const scope = toPersistenceTenancyScopeFields(tenancy);
  return Object.freeze({
    workspaceId: scope.workspaceId,
    userIdentityId: scope.userIdentityId,
  });
}

function assertPlatformRunKind(value: string): PlatformRunKind {
  if (Object.values(PlatformRunKinds).includes(value as PlatformRunKind)) {
    return value as PlatformRunKind;
  }
  throw new Error(`Persisted platform run kind '${value}' is invalid.`);
}

function assertPlatformRunStatus(value: string): PlatformRunStatus {
  if (Object.values(PlatformRunStatuses).includes(value as PlatformRunStatus)) {
    return value as PlatformRunStatus;
  }
  throw new Error(`Persisted platform run status '${value}' is invalid.`);
}

function assertPlatformAuditEventKind(value: string): PlatformAuditEventKind {
  if (Object.values(PlatformAuditEventKinds).includes(value as PlatformAuditEventKind)) {
    return value as PlatformAuditEventKind;
  }
  throw new Error(`Persisted platform audit event kind '${value}' is invalid.`);
}

function assertPlatformAuditOutcome(value: string): PlatformAuditOutcome {
  if (Object.values(PlatformAuditOutcomes).includes(value as PlatformAuditOutcome)) {
    return value as PlatformAuditOutcome;
  }
  throw new Error(`Persisted platform audit outcome '${value}' is invalid.`);
}
