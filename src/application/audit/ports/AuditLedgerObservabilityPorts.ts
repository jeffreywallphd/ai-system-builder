export interface AuditLedgerWriteObservabilityEvent {
  readonly event:
    | "audit-ledger.write.completed"
    | "audit-ledger.write.failed"
    | "audit-ledger.write.recovered"
    | "audit-ledger.write.reconciliation.completed";
  readonly source: string;
  readonly outcome: "success" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly operationKey?: string;
  readonly action?: string;
  readonly eventType?: string;
  readonly eventId?: string;
  readonly actorId?: string;
  readonly workspaceId?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly counters?: Readonly<Record<string, number>>;
}

export interface IAuditLedgerWriteObservabilityPort {
  recordAuditLedgerWrite(event: AuditLedgerWriteObservabilityEvent): Promise<void>;
}

export async function publishAuditLedgerWriteObservabilityBestEffort(
  observabilityPort: IAuditLedgerWriteObservabilityPort | undefined,
  event: AuditLedgerWriteObservabilityEvent,
): Promise<void> {
  if (!observabilityPort) {
    return;
  }

  try {
    await observabilityPort.recordAuditLedgerWrite(event);
  } catch {
    // Observability failures must stay non-blocking for authoritative audit writes.
  }
}
