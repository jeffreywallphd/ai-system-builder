import { describe, expect, it } from "bun:test";
import type {
  IPlatformAuditEventRepository,
  PlatformAuditEventListQuery,
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { RunOrchestrationRealtimePublisher } from "../RunOrchestrationRealtimePublisher";
import { PlatformSchedulingGovernanceEventSink } from "../PlatformSchedulingGovernanceEventSink";
import {
  RunOrchestrationObservability,
  type RunOrchestrationMetricsEvent,
  type RunOrchestrationObservabilityLogEvent,
  type RunOrchestrationObservabilityLogger,
} from "../RunOrchestrationObservability";

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

class CapturingRunOrchestrationLogger implements RunOrchestrationObservabilityLogger {
  public readonly infoEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly warnEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly errorEvents: RunOrchestrationObservabilityLogEvent[] = [];

  public info(event: RunOrchestrationObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: RunOrchestrationObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: RunOrchestrationObservabilityLogEvent): void {
    this.errorEvents.push(event);
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

  it("publishes operational scheduling governance events to runtime realtime queue/run topics", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const published: Array<{ readonly stream: "run" | "queue"; readonly payload: Record<string, unknown> }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        published.push({ stream: "run", payload: input.payload as Record<string, unknown> });
      },
      publishQueueMovement: (input) => {
        published.push({ stream: "queue", payload: input.payload as Record<string, unknown> });
      },
    });
    const sink = new PlatformSchedulingGovernanceEventSink(repository, realtimePublisher);

    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "operational",
      type: "scheduling-assignment-materialized",
      occurredAt: "2026-04-07T23:06:00.000Z",
      outcome: "succeeded",
      runId: "run:42",
      queueId: "queue:default",
      workspaceId: "workspace-a",
    }));

    expect(repository.events).toHaveLength(0);
    expect(published).toHaveLength(2);
    expect(published.map((entry) => entry.stream).sort()).toEqual(["queue", "run"]);
    expect(published.find((entry) => entry.stream === "queue")?.payload).toMatchObject({
      executionId: "run:42",
      queueItemId: "runtime-queue:run:42",
      eventKind: "scheduling-assignment-materialized",
      status: "running",
    });
    expect(published.find((entry) => entry.stream === "run")?.payload).toMatchObject({
      executionId: "run:42",
      runId: "run:42",
      eventKind: "scheduling-assignment-materialized",
      status: "assignment-pending",
    });
  });

  it("emits scheduler governance observability with counters, markers, and redaction", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const logger = new CapturingRunOrchestrationLogger();
    const metrics: RunOrchestrationMetricsEvent[] = [];
    const observability = new RunOrchestrationObservability({
      logger,
      metricsSink: {
        emit: async (event) => {
          metrics.push(event);
        },
      },
    });
    const sink = new PlatformSchedulingGovernanceEventSink(repository, undefined, observability);

    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "operational",
      type: "scheduling-deferred-no-placement",
      occurredAt: "2026-04-07T23:09:00.000Z",
      outcome: "deferred",
      decisionId: "decision:123",
      workspaceId: "workspace-z",
      runId: "run:deferred",
      nodeId: "node:beta",
      details: Object.freeze({
        reasonCodes: Object.freeze(["role-priority-preempted", "remote-scheduling-unsupported"]),
        exclusionReasonCodes: Object.freeze(["node-missing-capability"]),
        rawPath: "C:\\runtime\\unsafe\\path",
        backendDetails: Object.freeze({
          prompt: "do not leak",
        }),
      }),
    }));

    expect(repository.events).toHaveLength(0);
    expect(logger.warnEvents).toHaveLength(1);
    const event = logger.warnEvents[0];
    expect(event.operation).toBe("scheduling.governance-event");
    expect(event.runId).toBe("run:deferred");
    expect(event.workspaceId).toBe("workspace-z");
    expect(event.nodeId).toBe("node:beta");
    expect(event.markers).toContain("defer-no-placement");
    expect(event.counters?.scheduling_governance_events_total).toBe(1);
    expect(event.counters?.scheduling_defer_no_placement_total).toBe(1);
    expect(event.counters?.scheduling_reason_role_priority_preempted_total).toBe(1);
    expect(event.counters?.scheduling_reason_node_missing_capability_total).toBe(1);
    expect(JSON.stringify(event.details)).not.toContain("C:\\\\runtime\\\\unsafe\\\\path");
    expect(JSON.stringify(event.details)).not.toContain("do not leak");
    expect(JSON.stringify(event.details)).toContain("[REDACTED]");

    expect(metrics.some((metric) => metric.name === "run_orchestration_scheduling_defer_no_placement_total")).toBeTrue();
    expect(metrics.some((metric) => metric.name === "run_orchestration_scheduling_reason_remote_scheduling_unsupported_total")).toBeTrue();
  });
});
