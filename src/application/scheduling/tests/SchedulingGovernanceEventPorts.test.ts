import { describe, expect, it } from "bun:test";
import {
  publishSchedulingGovernanceEventBestEffort,
  type ISchedulingGovernanceEventSink,
  type SchedulingGovernanceEvent,
} from "@application/scheduling/ports/SchedulingGovernanceEventPorts";

class CapturingSchedulingGovernanceEventSink implements ISchedulingGovernanceEventSink {
  public event: SchedulingGovernanceEvent | undefined;

  public async recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void> {
    this.event = event;
  }
}

describe("SchedulingGovernanceEventPorts", () => {
  it("publishes sanitized scheduling governance events with best-effort redaction", async () => {
    const sink = new CapturingSchedulingGovernanceEventSink();

    await publishSchedulingGovernanceEventBestEffort(sink, Object.freeze({
      channel: "audit",
      type: "scheduling-priority-placement-selected",
      occurredAt: " 2026-04-07T22:00:00.000Z ",
      outcome: "succeeded",
      reservationOwner: " scheduler:alpha ",
      runId: " run:123 ",
      nodeId: " node:alpha ",
      details: Object.freeze({
        reasonCodes: Object.freeze(["role-priority-preempted"]),
        claimToken: "claim:secret",
        prompt: "sensitive",
        rawPath: "C:\\unsafe\\path",
        backendDetails: Object.freeze({
          backendResponse: "sensitive-payload",
        }),
        metadata: Object.freeze({
          nestedToken: "nested-secret",
          priorityBand: "high",
        }),
      }),
    }));

    expect(sink.event).toBeDefined();
    expect(sink.event?.occurredAt).toBe("2026-04-07T22:00:00.000Z");
    expect(sink.event?.reservationOwner).toBe("scheduler:alpha");
    expect(sink.event?.runId).toBe("run:123");
    expect(sink.event?.nodeId).toBe("node:alpha");
    const details = sink.event?.details as Record<string, unknown> | undefined;
    expect(details?.claimToken).toBeUndefined();
    expect(details?.prompt).toBeUndefined();
    expect(details?.rawPath).toBeUndefined();
    expect(details?.backendDetails).toBeUndefined();
    expect((details?.metadata as Record<string, unknown> | undefined)?.nestedToken).toBeUndefined();
    expect((details?.metadata as Record<string, unknown> | undefined)?.priorityBand).toBe("high");
  });

  it("swallows sink errors for best-effort scheduling governance publication", async () => {
    const throwingSink: ISchedulingGovernanceEventSink = {
      async recordSchedulingGovernanceEvent(): Promise<void> {
        throw new Error("unavailable");
      },
    };

    await publishSchedulingGovernanceEventBestEffort(throwingSink, Object.freeze({
      channel: "operational",
      type: "scheduling-deferred-no-placement",
      occurredAt: "2026-04-07T22:05:00.000Z",
      outcome: "deferred",
    }));
  });
});
