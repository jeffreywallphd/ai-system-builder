import { describe, expect, it } from "bun:test";
import { ExecutionUpdateEventKinds, ExecutionUpdateStream } from "../ExecutionUpdateStream";

describe("ExecutionUpdateStream", () => {
  it("enforces bounded execution-scoped subscriptions", () => {
    const stream = new ExecutionUpdateStream({
      maxSubscriptionsTotal: 10,
      maxSubscriptionsPerExecution: 1,
      maxSubscriptionsPerSession: 10,
      maxListenersPerEvent: 10,
    });
    const listener = () => {};
    stream.subscribe({ executionId: "exec-1", listener });
    expect(() => stream.subscribe({ executionId: "exec-1", listener })).toThrow(
      "invalid-request:Execution update subscriptions exceeded bounded execution limit (1).",
    );
  });

  it("caps listener fan-out per emitted event", () => {
    const stream = new ExecutionUpdateStream({
      maxSubscriptionsTotal: 10,
      maxSubscriptionsPerExecution: 10,
      maxSubscriptionsPerSession: 10,
      maxListenersPerEvent: 2,
    });
    const received: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      stream.subscribe({
        executionId: "exec-2",
        eventKinds: [ExecutionUpdateEventKinds.executionStatus],
        listener: (event) => {
          received.push(event.eventId);
        },
      });
    }

    stream.emit({
      executionId: "exec-2",
      kind: ExecutionUpdateEventKinds.executionStatus,
      status: "running",
    });

    expect(received.length).toBe(2);
  });
});
