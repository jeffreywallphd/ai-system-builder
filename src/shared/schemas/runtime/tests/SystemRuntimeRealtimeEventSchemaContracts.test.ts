import { describe, expect, it } from "bun:test";
import {
  parseRuntimeRealtimeEventEnvelope,
  parseRuntimeRealtimeSubscriptionRequest,
  RuntimeRealtimeSchemaValidationError,
} from "../SystemRuntimeRealtimeEventSchemaContracts";

describe("SystemRuntimeRealtimeEventSchemaContracts", () => {
  it("parses serialized runtime realtime envelopes", () => {
    const envelope = JSON.parse(JSON.stringify({
      eventId: "event-1",
      schemaVersion: "2026-04-07",
      emittedAt: "2026-04-07T12:00:00.000Z",
      sequence: 2,
      cursor: "runtime-realtime:2",
      category: "run-status",
      topic: "runtime.run.status",
      workspaceScope: {
        workspaceId: "workspace-a",
      },
      actorScope: {
        actorUserIdentityId: "user-a",
        sessionId: "session-a",
      },
      runScope: {
        executionId: "exec-a",
      },
      payload: {
        executionId: "exec-a",
        status: "running",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    }));

    const parsed = parseRuntimeRealtimeEventEnvelope(envelope);
    expect(parsed.eventId).toBe("event-1");
    expect(parsed.payload).toMatchObject({ executionId: "exec-a", status: "running" });
  });

  it("parses subscription requests with reconnect cursors", () => {
    const parsed = parseRuntimeRealtimeSubscriptionRequest({
      actor: {
        actorUserIdentityId: "user-a",
        accessChannel: "thin-client",
        workspaceId: "workspace-a",
      },
      topics: [
        {
          topic: "runtime.run.status",
          workspaceId: "workspace-a",
          executionId: "exec-a",
        },
      ],
      mode: "resume-from-cursor",
      reconnect: {
        afterCursor: "runtime-realtime:41",
      },
    });

    expect(parsed.mode).toBe("resume-from-cursor");
    expect(parsed.reconnect?.afterCursor).toBe("runtime-realtime:41");
  });

  it("rejects malformed realtime payloads", () => {
    expect(() => parseRuntimeRealtimeEventEnvelope({
      eventId: "event-1",
      schemaVersion: "2026-04-07",
      emittedAt: "not-a-date",
      sequence: 0,
      cursor: "bad",
      category: "run-status",
      topic: "runtime.run.status",
      workspaceScope: {},
      actorScope: {},
      runScope: {},
      payload: {
        executionId: "exec-a",
        status: "running",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    })).toThrow(RuntimeRealtimeSchemaValidationError);
  });
});
