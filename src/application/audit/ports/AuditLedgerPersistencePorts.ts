import type {
  CanonicalAuditEvent,
  AuditEventCategory,
  AuditLifecycleState,
  AuditRetentionPosture,
} from "@domain/audit/AuditDomain";
import type { AuditLedgerListQueryDto, AuditLedgerAppendMutationDto } from "@shared/dto/audit/AuditEventDtos";

export interface AuditLedgerAppendContext extends AuditLedgerAppendMutationDto {}

export interface AuditLedgerAppendResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly sequence: number;
  readonly event: CanonicalAuditEvent;
}

export const AuditLedgerWriteResolutionStatuses = Object.freeze({
  committed: "committed",
  notCommitted: "not-committed",
  ambiguous: "ambiguous",
});

export type AuditLedgerWriteResolutionStatus =
  typeof AuditLedgerWriteResolutionStatuses[keyof typeof AuditLedgerWriteResolutionStatuses];

export interface AuditLedgerWriteResolution {
  readonly status: AuditLedgerWriteResolutionStatus;
  readonly sequence?: number;
  readonly event?: CanonicalAuditEvent;
  readonly repairedReplayMapping?: boolean;
  readonly details?: string;
}

export interface AuditLedgerReconciliationIssue {
  readonly kind: "orphaned-mutation-replay";
  readonly operationKey: string;
  readonly eventId: string;
  readonly details: string;
}

export interface AuditLedgerReconciliationResult {
  readonly checkedAt: string;
  readonly repairedCount: number;
  readonly manualFollowUpCount: number;
  readonly issues: ReadonlyArray<AuditLedgerReconciliationIssue>;
}

export interface AuditLedgerQuery extends AuditLedgerListQueryDto {
  readonly actorId?: string;
  readonly category?: AuditEventCategory;
  readonly actionPrefix?: string;
  readonly eventType?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly eventGroupId?: string;
  readonly rootEventId?: string;
  readonly parentEventId?: string;
  readonly workflowId?: string;
  readonly sessionRef?: string;
  readonly runId?: string;
  readonly governanceActionId?: string;
  readonly retentionPosture?: AuditRetentionPosture;
  readonly lifecycleState?: AuditLifecycleState;
  readonly retentionPolicyKey?: string;
  readonly retainUntilAfter?: string;
  readonly retainUntilBefore?: string;
  readonly occurredAfter?: string;
  readonly occurredBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface IAuditLedgerRepository {
  appendAuditEvent(event: CanonicalAuditEvent, context: AuditLedgerAppendContext): Promise<AuditLedgerAppendResult>;
  listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>>;
  countAuditEvents(query: AuditLedgerQuery): Promise<number>;
  getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined>;
  resolveAppendOutcome?(input: {
    readonly eventId: string;
    readonly context: AuditLedgerAppendContext;
  }): Promise<AuditLedgerWriteResolution>;
  reconcileWritePathAnomalies?(input?: {
    readonly asOf?: string;
    readonly limit?: number;
  }): Promise<AuditLedgerReconciliationResult>;
}

export function normalizeAuditLedgerOperationKey(operationKey: string): string {
  const normalized = operationKey.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Audit ledger operationKey is required.");
  }
  return normalized;
}
