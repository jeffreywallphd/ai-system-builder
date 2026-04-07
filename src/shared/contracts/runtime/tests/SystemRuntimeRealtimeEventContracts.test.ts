import { describe, expect, it } from "bun:test";
import {
  RuntimeRealtimeOrchestrationEventKinds,
  RuntimeRealtimeTopics,
  RuntimeRealtimeWebSocketActions,
  RuntimeRealtimeWebSocketMessageTypes,
  buildRuntimeRealtimeCursor,
  parseRuntimeRealtimeCursor,
  runtimeRealtimeEventMatchesSubscriptionTopic,
  validateRuntimeRealtimeActorWorkspaceScope,
  type RuntimeRealtimeEventEnvelope,
} from "../SystemRuntimeRealtimeEventContracts";

describe("SystemRuntimeRealtimeEventContracts", () => {
  it("builds reconnect-safe cursors", () => {
    expect(buildRuntimeRealtimeCursor(1)).toBe("runtime-realtime:1");
    expect(parseRuntimeRealtimeCursor("runtime-realtime:12")).toBe(12);
    expect(parseRuntimeRealtimeCursor("invalid")).toBeUndefined();
  });

  it("matches events against topic and scope filters", () => {
    const event: RuntimeRealtimeEventEnvelope = Object.freeze({
      eventId: "event-1",
      schemaVersion: "2026-04-07",
      emittedAt: "2026-04-07T12:00:00.000Z",
      sequence: 4,
      cursor: "runtime-realtime:4",
      category: "run-status",
      topic: RuntimeRealtimeTopics.runStatus,
      workspaceScope: Object.freeze({ workspaceId: "workspace-a" }),
      actorScope: Object.freeze({ actorUserIdentityId: "user-a", sessionId: "session-a" }),
      runScope: Object.freeze({ executionId: "exec-a" }),
      payload: Object.freeze({
        executionId: "exec-a",
        status: "running",
        changedAt: "2026-04-07T12:00:00.000Z",
      }),
    });

    expect(runtimeRealtimeEventMatchesSubscriptionTopic(event, {
      topic: RuntimeRealtimeTopics.runStatus,
      workspaceId: "workspace-a",
      executionId: "exec-a",
    })).toBeTrue();
    expect(runtimeRealtimeEventMatchesSubscriptionTopic(event, {
      topic: RuntimeRealtimeTopics.runStatus,
      workspaceId: "workspace-b",
    })).toBeFalse();
  });

  it("validates actor workspace/topic scope consistency", () => {
    const valid = validateRuntimeRealtimeActorWorkspaceScope({
      actor: {
        actorUserIdentityId: "user-a",
        accessChannel: "desktop",
        workspaceId: "workspace-a",
      },
      topics: [{ topic: RuntimeRealtimeTopics.queue, workspaceId: "workspace-a" }],
    });
    expect(valid.ok).toBeTrue();

    const invalid = validateRuntimeRealtimeActorWorkspaceScope({
      actor: {
        actorUserIdentityId: "user-a",
        accessChannel: "desktop",
        workspaceId: "workspace-a",
      },
      topics: [{ topic: RuntimeRealtimeTopics.queue, workspaceId: "workspace-b" }],
    });
    expect(invalid.ok).toBeFalse();
  });

  it("defines canonical websocket control and envelope message type constants", () => {
    expect(RuntimeRealtimeWebSocketActions.subscribe).toBe("runtime-realtime.subscribe");
    expect(RuntimeRealtimeWebSocketMessageTypes.subscriptionAck).toBe("runtime-realtime.subscription-ack");
    expect(RuntimeRealtimeWebSocketMessageTypes.event).toBe("runtime-realtime.event");
    expect(RuntimeRealtimeWebSocketMessageTypes.error).toBe("runtime-realtime.error");
    expect(RuntimeRealtimeOrchestrationEventKinds.submissionAccepted).toBe("submission-accepted");
    expect(RuntimeRealtimeOrchestrationEventKinds.queueEnqueued).toBe("queue-enqueued");
    expect(RuntimeRealtimeOrchestrationEventKinds.schedulingPriorityPlacementSelected).toBe("scheduling-priority-placement-selected");
    expect(RuntimeRealtimeOrchestrationEventKinds.schedulingAssignmentMaterializationConflict).toBe("scheduling-assignment-materialization-conflict");
    expect(RuntimeRealtimeOrchestrationEventKinds.schedulingRequeued).toBe("scheduling-requeued");
    expect(RuntimeRealtimeOrchestrationEventKinds.progressUpdated).toBe("progress-updated");
  });
});
