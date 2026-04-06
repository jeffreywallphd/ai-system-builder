import type {
  PersistenceMutationContext,
  PersistenceMutationResult,
  PersistenceSensitiveFieldDescriptor,
  PersistenceTenancyMetadata,
  PersistenceVersionMetadata,
} from "../persistence/PersistenceBoundaryDtos";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

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

export interface PlatformRunPersistenceRecord extends PersistenceVersionMetadata {
  readonly runId: string;
  readonly runKind: PlatformRunKind;
  readonly status: PlatformRunStatus;
  readonly sourceAggregateRef: string;
  readonly initiatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly terminalReason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly tenancy: PersistenceTenancyMetadata;
  readonly actorUserIdentityId?: string;
  readonly correlationId?: string;
}

export interface PlatformRunPersistenceListQuery {
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

export const PlatformAuditOutcomes = Object.freeze({
  succeeded: "succeeded",
  denied: "denied",
  failed: "failed",
  rejected: "rejected",
});

export type PlatformAuditOutcome = typeof PlatformAuditOutcomes[keyof typeof PlatformAuditOutcomes];

export interface PlatformAuditEventPersistenceRecord {
  readonly eventId: string;
  readonly eventKind: PlatformAuditEventKind;
  readonly action: string;
  readonly actorId: string;
  readonly targetRef?: string;
  readonly outcome: PlatformAuditOutcome;
  readonly occurredAt: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly tenancy: PersistenceTenancyMetadata;
  readonly correlationId?: string;
  readonly sensitiveFields?: ReadonlyArray<PersistenceSensitiveFieldDescriptor>;
}

export interface PlatformAuditEventPersistenceListQuery {
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

export type PlatformRunPersistenceMutationResult<TRecord> = PersistenceMutationResult<TRecord>;

export function normalizePlatformPersistenceOperationKey(operationKey: string): string {
  return normalizePersistenceOperationKey(operationKey);
}

export function toPlatformAuditEventLookupKey(event: Pick<PlatformAuditEventPersistenceRecord, "eventKind" | "eventId">): string {
  return `${event.eventKind}:${event.eventId}`;
}

export type PlatformPersistenceMutationEnvelope = PersistenceMutationContext & {
  readonly expectedRevision?: number;
};
