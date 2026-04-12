import {
  createCanonicalAuditEvent,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";

export interface AuditLedgerEventRow {
  readonly sequence: number;
  readonly event_id: string;
  readonly event_json: string;
}

export interface AuditLedgerMutationReplayRow {
  readonly operation_key: string;
  readonly event_id: string;
  readonly sequence: number;
}

function stringifyOptionalObject(value: Readonly<Record<string, unknown>> | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

function stringifyStringArray(values: ReadonlyArray<string>): string {
  return JSON.stringify([...values]);
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function mapCanonicalAuditEventToRowValues(event: CanonicalAuditEvent): ReadonlyArray<unknown> {
  return Object.freeze([
    event.eventId,
    event.eventType,
    event.category,
    event.action,
    event.outcome,
    event.occurredAt,
    event.recordedAt,
    event.actor.actorId,
    event.actor.actorKind,
    normalizeOptional(event.actor.actorUserIdentityId),
    normalizeOptional(event.actor.actorServiceId),
    normalizeOptional(event.actor.actorSessionId),
    event.scope.kind,
    normalizeOptional(event.scope.workspaceId),
    normalizeOptional(event.protectedResource?.resourceType),
    normalizeOptional(event.protectedResource?.resourceId),
    normalizeOptional(event.protectedResource?.resourceRef),
    normalizeOptional(event.protectedResource?.sensitivityClass),
    normalizeOptional(event.protectedResource?.workspaceId),
    event.payload.hasProtectedData ? 1 : 0,
    stringifyStringArray(event.payload.redactionReasons),
    stringifyOptionalObject(event.payload.userSafeDetails),
    stringifyOptionalObject(event.payload.adminOnlyDetails),
    event.integrity.schemaVersion,
    event.integrity.hashAlgorithm,
    normalizeOptional(event.integrity.eventDigest),
    normalizeOptional(event.integrity.previousEventDigest),
    event.retention,
    normalizeOptional(event.retentionMetadata?.policyKey),
    normalizeOptional(event.retentionMetadata?.policyVersion),
    normalizeOptional(event.retentionMetadata?.retentionAnchor),
    normalizeOptional(event.retentionMetadata?.retainUntil),
    normalizeOptional(event.retentionMetadata?.archiveAfter),
    normalizeOptional(event.retentionMetadata?.lifecycleState),
    normalizeOptional(event.retentionMetadata?.lifecycleUpdatedAt),
    event.immutability,
    normalizeOptional(event.correlationId),
    normalizeOptional(event.requestId),
    normalizeOptional(event.linkage?.eventGroupId),
    normalizeOptional(event.linkage?.parentEventId),
    normalizeOptional(event.linkage?.rootEventId),
    normalizeOptional(event.linkage?.workflowId),
    normalizeOptional(event.linkage?.sessionRef),
    normalizeOptional(event.linkage?.runId),
    normalizeOptional(event.linkage?.governanceActionId),
    event.linkage?.relatedResources ? JSON.stringify(event.linkage.relatedResources) : null,
    JSON.stringify(event),
    new Date().toISOString(),
  ]);
}

export function parseCanonicalAuditEventRow(row: Pick<AuditLedgerEventRow, "event_json">): CanonicalAuditEvent {
  const parsed = JSON.parse(row.event_json) as CanonicalAuditEvent;
  return createCanonicalAuditEvent({
    eventId: parsed.eventId,
    eventType: parsed.eventType,
    category: parsed.category,
    action: parsed.action,
    outcome: parsed.outcome,
    occurredAt: parsed.occurredAt,
    recordedAt: parsed.recordedAt,
    actor: parsed.actor,
    scope: parsed.scope,
    protectedResource: parsed.protectedResource,
    payload: parsed.payload,
    integrity: parsed.integrity,
    retention: parsed.retention,
    retentionMetadata: parsed.retentionMetadata,
    immutability: parsed.immutability,
    correlationId: parsed.correlationId,
    requestId: parsed.requestId,
    linkage: parsed.linkage,
  });
}
