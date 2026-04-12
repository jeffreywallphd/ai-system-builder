export const PlatformRunKinds = Object.freeze({
  workflow: "workflow",
  agent: "agent",
  system: "system",
});

export type PlatformRunKind = typeof PlatformRunKinds[keyof typeof PlatformRunKinds];

export const PlatformRunStatuses = Object.freeze({
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  blocked: "blocked",
});

export type PlatformRunStatus = typeof PlatformRunStatuses[keyof typeof PlatformRunStatuses];

export interface PlatformPersistenceMutationContext {
  readonly operationKey: string;
  readonly actorId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
}

export function normalizePlatformPersistenceOperationKey(operationKey: string): string {
  return operationKey.trim().toLowerCase();
}

export interface PlatformRunRecord {
  readonly runId: string;
  readonly runKind: PlatformRunKind;
  readonly status: PlatformRunStatus;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly sourceAggregateRef: string;
  readonly initiatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly terminalReason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly revision: number;
}

export interface PlatformRunListQuery {
  readonly runKinds?: ReadonlyArray<PlatformRunKind>;
  readonly statuses?: ReadonlyArray<PlatformRunStatus>;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly sourceAggregateRef?: string;
  readonly initiatedAfter?: string;
  readonly initiatedBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface PlatformRunMutationResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly record: PlatformRunRecord;
}

export interface IPlatformRunRecordRepository {
  findRunById(runId: string): Promise<PlatformRunRecord | undefined>;
  listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>>;
  createRun(record: PlatformRunRecord, mutation: PlatformPersistenceMutationContext): Promise<PlatformRunMutationResult>;
  saveRun(
    record: PlatformRunRecord,
    mutation: PlatformPersistenceMutationContext & {
      readonly expectedRevision?: number;
    },
  ): Promise<PlatformRunMutationResult>;
}

/**
 * @deprecated Story 18.1.2 migration note:
 * Use canonical shared audit category contracts in
 * `@shared/contracts/audit/AuditEventContracts` for new audit workflows.
 * This legacy vocabulary remains for existing run-orchestration persistence paths.
 */
export const PlatformAuditEventKinds = Object.freeze({
  identity: "identity",
  workspace: "workspace",
  authorization: "authorization",
  nodes: "nodes",
  storage: "storage",
  assets: "assets",
  runs: "runs",
  security: "security",
  secrets: "secrets",
  sessions: "sessions",
  system: "system",
});

export type PlatformAuditEventKind =
  typeof PlatformAuditEventKinds[keyof typeof PlatformAuditEventKinds];

/**
 * @deprecated Story 18.1.2 migration note:
 * Use `AuditEventEnvelopeDto` from `@shared/contracts/audit/AuditEventContracts`
 * for canonical cross-layer audit event payloads.
 */
export interface PlatformAuditEventRecord {
  readonly eventId: string;
  readonly eventKind: PlatformAuditEventKind;
  readonly action: string;
  readonly actorId: string;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly targetRef?: string;
  readonly outcome: "succeeded" | "denied" | "failed" | "rejected";
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PlatformAuditEventListQuery {
  readonly eventKinds?: ReadonlyArray<PlatformAuditEventKind>;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly actorId?: string;
  readonly targetRef?: string;
  readonly occurredAfter?: string;
  readonly occurredBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * @deprecated Story 18.1.2 migration note:
 * Migrate to canonical audit ledger repository contracts in `src/application/audit`.
 */
export interface IPlatformAuditEventRepository {
  appendAuditEvent(
    event: PlatformAuditEventRecord,
    mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }>;
  listAuditEvents(query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>>;
}

