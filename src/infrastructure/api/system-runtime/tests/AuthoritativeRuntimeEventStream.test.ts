import { describe, expect, it } from "bun:test";
import { RuntimeRealtimeSubscriptionModes, RuntimeRealtimeTopics } from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import { AuthoritativeRuntimeEventStream } from "../AuthoritativeRuntimeEventStream";

describe("AuthoritativeRuntimeEventStream", () => {
  it("delivers run-status events with workspace and execution scope filtering", () => {
    const stream = new AuthoritativeRuntimeEventStream();
    const events: string[] = [];

    stream.subscribe({
      request: {
        actor: {
          actorUserIdentityId: "user-a",
          accessChannel: "desktop",
          workspaceId: "workspace-a",
        },
        topics: [
          {
            topic: RuntimeRealtimeTopics.runStatus,
            workspaceId: "workspace-a",
            executionId: "exec-1",
          },
        ],
      },
      listener: (event) => {
        events.push(event.eventId);
      },
    });

    stream.publishRunStatusEvent({
      workspaceId: "workspace-a",
      payload: {
        executionId: "exec-1",
        status: "running",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    });
    stream.publishRunStatusEvent({
      workspaceId: "workspace-b",
      payload: {
        executionId: "exec-1",
        status: "running",
        changedAt: "2026-04-07T12:00:01.000Z",
      },
    });

    expect(events.length).toBe(1);
  });

  it("replays retained events from reconnect cursor", () => {
    const stream = new AuthoritativeRuntimeEventStream();
    const first = stream.publishQueueMovementEvent({
      workspaceId: "workspace-a",
      payload: {
        queueItemId: "queue-1",
        executionId: "exec-1",
        status: "queued",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    });
    stream.publishQueueMovementEvent({
      workspaceId: "workspace-a",
      payload: {
        queueItemId: "queue-1",
        executionId: "exec-1",
        status: "running",
        changedAt: "2026-04-07T12:00:01.000Z",
      },
    });

    const replayed: string[] = [];
    stream.subscribe({
      request: {
        actor: {
          actorUserIdentityId: "user-a",
          accessChannel: "thin-client",
          workspaceId: "workspace-a",
        },
        topics: [{ topic: RuntimeRealtimeTopics.queue, workspaceId: "workspace-a" }],
        mode: RuntimeRealtimeSubscriptionModes.resumeFromCursor,
        reconnect: {
          afterCursor: first.cursor,
        },
      },
      listener: (event) => {
        replayed.push(event.cursor);
      },
    });

    expect(replayed).toEqual(["runtime-realtime:2"]);
  });

  it("rejects topic scope mismatch against actor workspace", () => {
    const stream = new AuthoritativeRuntimeEventStream();

    expect(() => stream.subscribe({
      request: {
        actor: {
          actorUserIdentityId: "user-a",
          accessChannel: "desktop",
          workspaceId: "workspace-a",
        },
        topics: [{ topic: RuntimeRealtimeTopics.admin, workspaceId: "workspace-b" }],
      },
      listener: () => {},
    })).toThrow("invalid-request:Topic workspace scope must match actor workspace scope.");
  });

  it("delivers audit-governance envelopes through shared runtime stream topics", () => {
    const stream = new AuthoritativeRuntimeEventStream();
    const captured: string[] = [];

    stream.subscribe({
      request: {
        actor: {
          actorUserIdentityId: "user-admin",
          accessChannel: "desktop",
          workspaceId: "workspace-a",
        },
        topics: [{ topic: RuntimeRealtimeTopics.auditGovernance, workspaceId: "workspace-a" }],
      },
      listener: (event) => {
        captured.push(event.topic);
      },
    });

    const published = stream.publishAuditGovernanceEvent({
      workspaceId: "workspace-a",
      actorUserIdentityId: "user-admin",
      payload: {
        eventId: "audit:event:1",
        eventType: "workspace-member-added",
        auditCategory: "administrative",
        eventKind: "administrative-action-recorded",
        action: "workspace.member.added",
        outcome: "succeeded",
        occurredAt: "2026-04-07T12:00:00.000Z",
        recordedAt: "2026-04-07T12:00:00.000Z",
        actorId: "user:admin",
        actorKind: "user",
        hasProtectedData: false,
        redactionReasons: [],
      },
    });

    expect(published.topic).toBe(RuntimeRealtimeTopics.auditGovernance);
    expect(captured).toEqual([RuntimeRealtimeTopics.auditGovernance]);
  });
});
