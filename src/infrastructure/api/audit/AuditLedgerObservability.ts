import type {
  AuditLedgerWriteObservabilityEvent,
  IAuditLedgerWriteObservabilityPort,
} from "@application/audit/ports/AuditLedgerObservabilityPorts";
import {
  sanitizeAuditOperationalDetails,
} from "@application/audit/shared/AuditOperationalSignalRedaction";

export interface AuditLedgerObservabilityLogEvent {
  readonly event:
    | "audit-ledger.write.completed"
    | "audit-ledger.write.failed"
    | "audit-ledger.query.completed"
    | "audit-ledger.query.failed";
  readonly operation:
    | "write"
    | "list"
    | "detail"
    | "governance-list"
    | "governance-detail";
  readonly outcome: "success" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly source?: string;
  readonly actorUserIdentityId?: string;
  readonly workspaceId?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly eventId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly counters?: Readonly<Record<string, number>>;
}

export interface AuditLedgerMetricsEvent {
  readonly name: string;
  readonly value: number;
  readonly occurredAt: string;
  readonly tags?: Readonly<Record<string, string>>;
}

export interface AuditLedgerObservabilityLogger {
  info(event: AuditLedgerObservabilityLogEvent): void;
  warn(event: AuditLedgerObservabilityLogEvent): void;
  error(event: AuditLedgerObservabilityLogEvent): void;
}

export interface AuditLedgerMetricsSink {
  emit(event: AuditLedgerMetricsEvent): void | Promise<void>;
}

export interface AuditLedgerObservabilityOptions {
  readonly logger?: AuditLedgerObservabilityLogger;
  readonly metricsSink?: AuditLedgerMetricsSink;
}

export class AuditLedgerObservability implements IAuditLedgerWriteObservabilityPort {
  private readonly logger: AuditLedgerObservabilityLogger;
  private readonly metricsSink?: AuditLedgerMetricsSink;

  public constructor(options: AuditLedgerObservabilityOptions = {}) {
    this.logger = options.logger ?? new ConsoleAuditLedgerObservabilityLogger();
    this.metricsSink = options.metricsSink;
  }

  public async recordAuditLedgerWrite(event: AuditLedgerWriteObservabilityEvent): Promise<void> {
    await this.record(Object.freeze({
      event: event.event,
      operation: "write",
      outcome: event.outcome,
      severity: event.severity,
      occurredAt: event.occurredAt,
      source: normalizeOptional(event.source),
      workspaceId: normalizeOptional(event.workspaceId),
      correlationId: normalizeOptional(event.correlationId),
      requestId: normalizeOptional(event.requestId),
      eventId: normalizeOptional(event.eventId),
      details: sanitizeAuditOperationalDetails(event.details),
      counters: event.counters,
    }));
  }

  public async recordQuery(input: Omit<AuditLedgerObservabilityLogEvent, "occurredAt"> & {
    readonly occurredAt?: string;
  }): Promise<void> {
    await this.record(Object.freeze({
      ...input,
      occurredAt: normalizeOptional(input.occurredAt) ?? new Date().toISOString(),
      actorUserIdentityId: normalizeOptional(input.actorUserIdentityId),
      workspaceId: normalizeOptional(input.workspaceId),
      correlationId: normalizeOptional(input.correlationId),
      requestId: normalizeOptional(input.requestId),
      eventId: normalizeOptional(input.eventId),
      source: normalizeOptional(input.source),
      details: sanitizeAuditOperationalDetails(input.details),
    }));
  }

  private async record(event: AuditLedgerObservabilityLogEvent): Promise<void> {
    if (event.severity === "error") {
      this.logger.error(event);
    } else if (event.severity === "warn") {
      this.logger.warn(event);
    } else {
      this.logger.info(event);
    }

    if (!this.metricsSink) {
      return;
    }

    await emitMetricBestEffort(this.metricsSink, Object.freeze({
      name: "audit_ledger_operation_total",
      value: 1,
      occurredAt: event.occurredAt,
      tags: Object.freeze({
        operation: event.operation,
        outcome: event.outcome,
      }),
    }));

    for (const [counterName, counterValue] of Object.entries(event.counters ?? {})) {
      if (!Number.isFinite(counterValue)) {
        continue;
      }
      await emitMetricBestEffort(this.metricsSink, Object.freeze({
        name: `audit_ledger_${sanitizeMetricName(counterName)}`,
        value: counterValue,
        occurredAt: event.occurredAt,
        tags: Object.freeze({
          operation: event.operation,
          outcome: event.outcome,
        }),
      }));
    }
  }
}

class ConsoleAuditLedgerObservabilityLogger implements AuditLedgerObservabilityLogger {
  public info(event: AuditLedgerObservabilityLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: AuditLedgerObservabilityLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: AuditLedgerObservabilityLogEvent): void {
    console.error(JSON.stringify(event));
  }
}

function sanitizeMetricName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return normalized.length > 0 ? normalized : "counter";
}

async function emitMetricBestEffort(
  metricsSink: AuditLedgerMetricsSink,
  event: AuditLedgerMetricsEvent,
): Promise<void> {
  try {
    await metricsSink.emit(event);
  } catch {
    // Metrics must remain non-blocking for audit operations.
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
