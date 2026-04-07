import { describe, expect, it } from "bun:test";
import type {
  IPlatformAuditEventRepository,
  PlatformAuditEventListQuery,
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { PlatformSchedulingGovernanceEventSink } from "../PlatformSchedulingGovernanceEventSink";

class InMemoryPlatformAuditRepository implements IPlatformAuditEventRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendAuditEvent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.push(event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }

  public async listAuditEvents(_query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    return Object.freeze([...this.events]);
  }
}

describe("PlatformSchedulingGovernanceEventSink", () => {
  it("maps audit priority-placement events to platform run audit records", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const sink = new PlatformSchedulingGovernanceEventSink(repository);

    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "audit",
      type: "scheduling-priority-placement-selected",
      occurredAt: "2026-04-07T23:00:00.000Z",
      outcome: "succeeded",
      actorServiceId: "scheduler:alpha",
      workspaceId: "workspace-alpha",
      runId: "run:123",
      details: Object.freeze({
        rolePriorityScore: 4,
      }),
    }));

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.eventKind).toBe("runs");
    expect(repository.events[0]?.action).toBe("run.scheduling.priority-placement.selected");
    expect(repository.events[0]?.actorId).toBe("scheduler:alpha");
    expect(repository.events[0]?.workspaceId).toBe("workspace-alpha");
    expect(repository.events[0]?.targetRef).toBe("run:123");
    expect(repository.events[0]?.outcome).toBe("succeeded");
  });

  it("skips non-audit channels and maps deferred/conflict outcomes", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const sink = new PlatformSchedulingGovernanceEventSink(repository);

    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "operational",
      type: "scheduling-deferred-no-placement",
      occurredAt: "2026-04-07T23:00:00.000Z",
      outcome: "deferred",
      runId: "run:deferred",
    }));
    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "audit",
      type: "scheduling-reservation-conflict",
      occurredAt: "2026-04-07T23:05:00.000Z",
      outcome: "conflict",
      nodeId: "node:1",
    }));

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.action).toBe("run.scheduling.reservation.conflict");
    expect(repository.events[0]?.targetRef).toBe("node:1");
    expect(repository.events[0]?.outcome).toBe("failed");
  });
});
