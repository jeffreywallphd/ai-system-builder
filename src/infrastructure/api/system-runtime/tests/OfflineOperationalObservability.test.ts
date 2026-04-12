import { describe, expect, it } from "bun:test";
import {
  OfflineOperationalEventChannels,
  OfflineOperationalEventTypes,
} from "@application/common/OfflineOperationalEventPorts";
import {
  OfflineOperationalObservability,
  type OfflineOperationalMetricsEvent,
  type OfflineOperationalMetricsSink,
  type OfflineOperationalObservabilityLogEvent,
  type OfflineOperationalObservabilityLogger,
} from "../OfflineOperationalObservability";

class CapturingOfflineObservabilityLogger implements OfflineOperationalObservabilityLogger {
  public readonly infoEvents: OfflineOperationalObservabilityLogEvent[] = [];
  public readonly warnEvents: OfflineOperationalObservabilityLogEvent[] = [];
  public readonly errorEvents: OfflineOperationalObservabilityLogEvent[] = [];

  public info(event: OfflineOperationalObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: OfflineOperationalObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: OfflineOperationalObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

class CapturingOfflineMetricsSink implements OfflineOperationalMetricsSink {
  public readonly events: OfflineOperationalMetricsEvent[] = [];

  public emit(event: OfflineOperationalMetricsEvent): void {
    this.events.push(event);
  }
}

describe("OfflineOperationalObservability", () => {
  it("records structured sync-attempt diagnostics and emits counters", async () => {
    const logger = new CapturingOfflineObservabilityLogger();
    const metrics = new CapturingOfflineMetricsSink();
    const observability = new OfflineOperationalObservability({
      logger,
      metricsSink: metrics,
    });

    await observability.recordOfflineOperationalEvent({
      channel: OfflineOperationalEventChannels.operational,
      type: OfflineOperationalEventTypes.resynchronizationAttemptCompleted,
      occurredAt: "2026-04-08T12:00:00.000Z",
      correlationId: "corr-sync-1",
      syncAttemptId: "sync-attempt-1",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      classification: "operational-diagnostic",
      outcome: "failed",
      summary: "Resynchronization completed with failures.",
      diagnostics: Object.freeze({
        replayFailureSummaries: Object.freeze({
          totalFailures: 2,
        }),
        localPath: "C:\\Users\\alice\\private.txt",
      }),
    });

    expect(logger.warnEvents).toHaveLength(1);
    expect(logger.warnEvents[0]).toMatchObject({
      operation: "offline-resynchronization",
      correlationId: "corr-sync-1",
      syncAttemptId: "sync-attempt-1",
    });
    expect(logger.warnEvents[0]?.details).toMatchObject({
      diagnostics: {
        replayFailureSummaries: {
          totalFailures: 2,
        },
        localPath: "[REDACTED]",
      },
    });
    expect(metrics.events.map((entry) => entry.name)).toEqual([
      "offline_operational_event_total",
      "offline_event_total",
      "offline_event_type_resynchronization_attempt_completed_total",
      "offline_resync_attempt_total",
    ]);
  });

  it("marks replay failures as error severity with replay-failure metrics", async () => {
    const logger = new CapturingOfflineObservabilityLogger();
    const metrics = new CapturingOfflineMetricsSink();
    const observability = new OfflineOperationalObservability({
      logger,
      metricsSink: metrics,
    });

    await observability.recordOfflineOperationalEvent({
      channel: OfflineOperationalEventChannels.operational,
      type: OfflineOperationalEventTypes.replayFailed,
      occurredAt: "2026-04-08T12:01:00.000Z",
      correlationId: "corr-sync-2",
      syncAttemptId: "sync-attempt-2",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      operationId: "operation:1",
      resourceClass: "workflow-draft",
      resourceId: "workflow:draft:1",
      classification: "combined",
      outcome: "failed",
      summary: "Replay failed.",
    });

    expect(logger.errorEvents).toHaveLength(1);
    expect(logger.errorEvents[0]?.markers).toContain("replay-failure");
    expect(metrics.events.some((entry) => entry.name === "offline_resync_replay_failure_total")).toBeTrue();
  });
});
