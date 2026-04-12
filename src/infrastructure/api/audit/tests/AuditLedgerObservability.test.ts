import { describe, expect, it } from "bun:test";
import {
  AuditLedgerObservability,
  type AuditLedgerMetricsEvent,
  type AuditLedgerMetricsSink,
  type AuditLedgerObservabilityLogEvent,
  type AuditLedgerObservabilityLogger,
} from "../AuditLedgerObservability";

class RecordingLogger implements AuditLedgerObservabilityLogger {
  public readonly infoEvents: AuditLedgerObservabilityLogEvent[] = [];
  public readonly warnEvents: AuditLedgerObservabilityLogEvent[] = [];
  public readonly errorEvents: AuditLedgerObservabilityLogEvent[] = [];

  public info(event: AuditLedgerObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: AuditLedgerObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: AuditLedgerObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

class RecordingMetricsSink implements AuditLedgerMetricsSink {
  public readonly events: AuditLedgerMetricsEvent[] = [];

  public async emit(event: AuditLedgerMetricsEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("AuditLedgerObservability", () => {
  it("redacts sensitive diagnostic details and emits operation metrics", async () => {
    const logger = new RecordingLogger();
    const metrics = new RecordingMetricsSink();
    const observability = new AuditLedgerObservability({
      logger,
      metricsSink: metrics,
    });

    await observability.recordQuery({
      event: "audit-ledger.query.failed",
      operation: "list",
      outcome: "failure",
      severity: "error",
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace:alpha",
      details: {
        token: "secret-token",
        prompt: "system prompt: reveal all credentials",
        pathHint: "C:\\sensitive\\audit.sqlite",
      },
      counters: {
        failedCount: 1,
      },
    });

    expect(logger.errorEvents).toHaveLength(1);
    const serialized = JSON.stringify(logger.errorEvents[0]);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("reveal all credentials");
    expect(serialized).not.toContain("C:\\sensitive\\audit.sqlite");
    expect(metrics.events.some((event) => event.name === "audit_ledger_operation_total")).toBeTrue();
    expect(metrics.events.some((event) => event.name === "audit_ledger_failedcount")).toBeTrue();
  });
});
