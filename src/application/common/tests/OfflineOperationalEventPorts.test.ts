import { describe, expect, it } from "bun:test";
import {
  OfflineOperationalEventChannels,
  OfflineOperationalEventTypes,
  type IOfflineOperationalEventSink,
  publishOfflineOperationalEventBestEffort,
} from "../OfflineOperationalEventPorts";

class RecordingOfflineOperationalSink implements IOfflineOperationalEventSink {
  public readonly events: Array<Parameters<IOfflineOperationalEventSink["recordOfflineOperationalEvent"]>[0]> = [];

  public async recordOfflineOperationalEvent(
    event: Parameters<IOfflineOperationalEventSink["recordOfflineOperationalEvent"]>[0],
  ): Promise<void> {
    this.events.push(event);
  }
}

describe("OfflineOperationalEventPorts", () => {
  it("sanitizes sensitive details before publishing", async () => {
    const sink = new RecordingOfflineOperationalSink();

    await publishOfflineOperationalEventBestEffort(sink, Object.freeze({
      channel: OfflineOperationalEventChannels.operational,
      type: OfflineOperationalEventTypes.replayFailed,
      occurredAt: "2026-04-08T12:00:00.000Z",
      requestId: "req-1",
      correlationId: "corr-1",
      syncAttemptId: "sync-attempt-1",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      classification: "combined",
      summary: "Replay failed.",
      details: Object.freeze({
        safeCode: "conflict",
        rawPayload: "should-not-appear",
        suggestedPath: "/v1/offline/replay",
        promptSnippet: "prompt: generate a full secret model",
        nested: Object.freeze({
          internalTrace: "drop-me",
          localFile: "C:\\Users\\alice\\secret.txt",
          retained: true,
        }),
      }),
      diagnostics: Object.freeze({
        replayFailureSummary: "blocked:permission-changed",
        absolutePath: "C:\\Users\\alice\\secret.log",
      }),
    }));

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.details).toEqual(Object.freeze({
      safeCode: "conflict",
      rawPayload: "[REDACTED]",
      suggestedPath: "[REDACTED]",
      promptSnippet: "[REDACTED]",
      nested: Object.freeze({
        internalTrace: "[REDACTED]",
        localFile: "[REDACTED]",
        retained: true,
      }),
    }));
    expect(sink.events[0]).toMatchObject({
      requestId: "req-1",
      correlationId: "corr-1",
      syncAttemptId: "sync-attempt-1",
      classification: "combined",
      diagnostics: Object.freeze({
        replayFailureSummary: "blocked:permission-changed",
        absolutePath: "[REDACTED]",
      }),
    });
  });

  it("does not throw when no sink is configured", async () => {
    await expect(publishOfflineOperationalEventBestEffort(undefined, Object.freeze({
      channel: OfflineOperationalEventChannels.operational,
      type: OfflineOperationalEventTypes.offlineEntered,
      occurredAt: "2026-04-08T12:00:00.000Z",
      summary: "Offline mode entered.",
    }))).resolves.toBeUndefined();
  });
});
