import { describe, expect, it } from "bun:test";
import {
  OfflineOperationalEventChannels,
  OfflineOperationalEventTypes,
} from "@application/common/OfflineOperationalEventPorts";
import { RuntimeRealtimeTopics } from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import { DesktopOfflineOperationalEventSink } from "../DesktopOfflineOperationalEventSink";

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
    const sink = new DesktopOfflineOperationalEventSink(api as never);

    await sink.recordOfflineOperationalEvent({
      channel: OfflineOperationalEventChannels.audit,
      type: OfflineOperationalEventTypes.protectedLocalExecutionRegistered,
      occurredAt: "2026-04-08T12:01:00.000Z",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      operationId: "operation:1",
      resourceClass: "run-submission-intent",
      resourceId: "run:intent:1",
      outcome: "succeeded",
      summary: "Protected local execution registered.",
    });

    expect(api.topics).toEqual([RuntimeRealtimeTopics.auditGovernance]);
    expect(api.auditPayloads[0]).toMatchObject({
      eventType: "protected-local-execution-registered",
      action: "offline.local-execution.protected.registered",
      eventKind: "protected-data-action-recorded",
      hasProtectedData: true,
    });
  });
});
