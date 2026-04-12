import { describe, expect, it } from "bun:test";
import {
  parseRuntimeRealtimeEventEnvelope,
  parseRuntimeRealtimeSubscriptionRequest,
  parseRuntimeRealtimeWebSocketErrorMessage,
  parseRuntimeRealtimeWebSocketEventMessage,
  parseRuntimeRealtimeWebSocketSubscribeMessage,
  parseRuntimeRealtimeWebSocketSubscriptionAckMessage,
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
        runId: "run:exec-a",
        workflowId: "workflow:demo",
        queueId: "queue:default",
        lifecycleState: "running",
        eventKind: "progress-updated",
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

  it("parses websocket subscribe/ack/event/error runtime realtime envelopes", () => {
    const subscribe = parseRuntimeRealtimeWebSocketSubscribeMessage({
      action: "runtime-realtime.subscribe",
      request: {
        topics: [{ topic: "runtime.queue", workspaceId: "workspace-a" }],
        mode: "resume-from-cursor",
        reconnect: { afterCursor: "runtime-realtime:2" },
      },
    });
    expect(subscribe.action).toBe("runtime-realtime.subscribe");

    const ack = parseRuntimeRealtimeWebSocketSubscriptionAckMessage({
      type: "runtime-realtime.subscription-ack",
      subscriptionId: "sub-1",
      acceptedAt: "2026-04-07T12:00:00.000Z",
      mode: "live-only",
      topics: [{ topic: "runtime.queue", workspaceId: "workspace-a" }],
    });
    expect(ack.type).toBe("runtime-realtime.subscription-ack");

    const event = parseRuntimeRealtimeWebSocketEventMessage({
      type: "runtime-realtime.event",
      event: {
        eventId: "event-1",
        schemaVersion: "2026-04-07",
        emittedAt: "2026-04-07T12:00:00.000Z",
        sequence: 1,
        cursor: "runtime-realtime:1",
        category: "queue-movement",
        topic: "runtime.queue",
        workspaceScope: { workspaceId: "workspace-a" },
        actorScope: {},
        runScope: { executionId: "exec-1" },
        payload: {
          queueItemId: "queue-1",
          executionId: "exec-1",
          status: "queued",
          runId: "run:1",
          workflowId: "workflow:demo",
          queueId: "queue:default",
          lifecycleState: "queued",
          eventKind: "queue-enqueued",
          changedAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });
    expect(event.type).toBe("runtime-realtime.event");

    const error = parseRuntimeRealtimeWebSocketErrorMessage({
      type: "runtime-realtime.error",
      error: {
        code: "forbidden",
        message: "Workspace scope is not allowed.",
      },
    });
    expect(error.error.code).toBe("forbidden");
  });

  it("accepts scheduling-specific orchestration event kinds", () => {
    const envelope = parseRuntimeRealtimeEventEnvelope({
      eventId: "event-scheduling-1",
      schemaVersion: "2026-04-07",
      emittedAt: "2026-04-07T12:00:00.000Z",
      sequence: 9,
      cursor: "runtime-realtime:9",
      category: "queue-movement",
      topic: "runtime.queue",
      workspaceScope: { workspaceId: "workspace-a" },
      actorScope: {},
      runScope: { executionId: "run:1" },
      payload: {
        queueItemId: "runtime-queue:run:1",
        executionId: "run:1",
        status: "queued",
        runId: "run:1",
        eventKind: "scheduling-requeued",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    });

    expect(envelope.payload).toMatchObject({
      executionId: "run:1",
      eventKind: "scheduling-requeued",
    });
  });

  it("parses audit/governance realtime payloads with user-safe details only", () => {
    const envelope = parseRuntimeRealtimeEventEnvelope({
      eventId: "event-audit-1",
      schemaVersion: "2026-04-07",
      emittedAt: "2026-04-07T12:00:00.000Z",
      sequence: 19,
      cursor: "runtime-realtime:19",
      category: "audit-governance",
      topic: "runtime.audit.governance",
      workspaceScope: { workspaceId: "workspace-a" },
      actorScope: { actorUserIdentityId: "user-admin" },
      runScope: {},
      payload: {
        eventId: "audit:event:1",
        eventType: "workspace-policy-updated",
        auditCategory: "policy",
        eventKind: "policy-action-recorded",
        action: "policy.updated",
        outcome: "succeeded",
        occurredAt: "2026-04-07T11:59:00.000Z",
        recordedAt: "2026-04-07T12:00:00.000Z",
        actorId: "user:admin",
        actorKind: "user",
        workspaceId: "workspace-a",
        details: {
          summary: "retention policy changed",
        },
        hasProtectedData: false,
        redactionReasons: [],
      },
    });

    expect(envelope.topic).toBe("runtime.audit.governance");
    expect(envelope.category).toBe("audit-governance");
    expect(envelope.payload).toMatchObject({
      eventId: "audit:event:1",
      eventKind: "policy-action-recorded",
      action: "policy.updated",
    });
  });
});
