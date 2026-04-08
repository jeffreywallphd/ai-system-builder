import { describe, expect, it } from "bun:test";
import {
  OfflineOperationalEventChannels,
  OfflineOperationalEventTypes,
} from "@application/common/OfflineOperationalEventPorts";
import { RuntimeRealtimeTopics } from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import { DesktopOfflineOperationalEventSink } from "../DesktopOfflineOperationalEventSink";
import {
  OfflineOperationalObservability,
  type OfflineOperationalObservabilityLogEvent,
  type OfflineOperationalObservabilityLogger,
} from "../OfflineOperationalObservability";

class RecordingRuntimeBackendApi {
  public readonly topics: string[] = [];
  public readonly connectivityPayloads: Array<unknown> = [];
  public readonly auditPayloads: Array<unknown> = [];

  public publishRuntimeConnectivityState(input: { readonly payload: unknown }) {
    this.topics.push(RuntimeRealtimeTopics.connectivity);
    this.connectivityPayloads.push(input.payload);
    return Object.freeze({ topic: RuntimeRealtimeTopics.connectivity });
  }

  public publishRuntimeAuditGovernance(input: { readonly payload: unknown }) {
    this.topics.push(RuntimeRealtimeTopics.auditGovernance);
    this.auditPayloads.push(input.payload);
    return Object.freeze({ topic: RuntimeRealtimeTopics.auditGovernance });
  }
}

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

describe("DesktopOfflineOperationalEventSink", () => {
  it("routes offline transition events to connectivity realtime publication", async () => {
    const api = new RecordingRuntimeBackendApi();
    const sink = new DesktopOfflineOperationalEventSink(api as never);

    await sink.recordOfflineOperationalEvent({
      channel: OfflineOperationalEventChannels.operational,
      type: OfflineOperationalEventTypes.offlineEntered,
      occurredAt: "2026-04-08T12:00:00.000Z",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      summary: "Entered offline mode.",
    });

    expect(api.topics).toEqual([RuntimeRealtimeTopics.connectivity]);
    expect(api.connectivityPayloads[0]).toMatchObject({
      state: "disconnected",
      observedAt: "2026-04-08T12:00:00.000Z",
    });
  });

  it("routes replay/conflict/protected registration events to audit/governance realtime publication", async () => {
    const api = new RecordingRuntimeBackendApi();
    const logger = new CapturingOfflineObservabilityLogger();
    const observability = new OfflineOperationalObservability({ logger });
    const sink = new DesktopOfflineOperationalEventSink(api as never, observability);

    await sink.recordOfflineOperationalEvent({
      channel: OfflineOperationalEventChannels.audit,
      type: OfflineOperationalEventTypes.protectedLocalExecutionRegistered,
      occurredAt: "2026-04-08T12:01:00.000Z",
      requestId: "req-1",
      correlationId: "corr-1",
      syncAttemptId: "sync-attempt-1",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      operationId: "operation:1",
      resourceClass: "run-submission-intent",
      resourceId: "run:intent:1",
      classification: "combined",
      outcome: "succeeded",
      summary: "Protected local execution registered.",
      diagnostics: Object.freeze({
        registrationStatus: "applied",
      }),
    });

    expect(api.topics).toEqual([RuntimeRealtimeTopics.auditGovernance]);
    expect(api.auditPayloads[0]).toMatchObject({
      eventType: "protected-local-execution-registered",
      action: "offline.local-execution.protected.registered",
      eventKind: "protected-data-action-recorded",
      correlationId: "corr-1",
      hasProtectedData: true,
      details: {
        requestId: "req-1",
        syncAttemptId: "sync-attempt-1",
        classification: "combined",
        diagnostics: {
          registrationStatus: "applied",
        },
      },
    });
    expect(logger.infoEvents).toHaveLength(1);
    expect(logger.infoEvents[0]).toMatchObject({
      operation: "offline-local-execution",
      correlationId: "corr-1",
      syncAttemptId: "sync-attempt-1",
    });
  });
});
