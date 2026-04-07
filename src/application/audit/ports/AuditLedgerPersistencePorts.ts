import type {
  CanonicalAuditEvent,
  AuditEventCategory,
} from "@domain/audit/AuditDomain";
import type { AuditLedgerListQueryDto, AuditLedgerAppendMutationDto } from "@shared/dto/audit/AuditEventDtos";

export interface AuditLedgerAppendContext extends AuditLedgerAppendMutationDto {}

export interface AuditLedgerAppendResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly sequence: number;
  readonly event: CanonicalAuditEvent;
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
}

export function normalizeAuditLedgerOperationKey(operationKey: string): string {
  const normalized = operationKey.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Audit ledger operationKey is required.");
  }
  return normalized;
}
