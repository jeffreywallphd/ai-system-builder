import { describe, expect, it } from "bun:test";
import { mapComfyError, mapComfyProgressToLifecycleEvent } from "../ComfyExecutionLifecycle";

describe("ComfyExecutionLifecycle", () => {
  it("maps progress into normalized lifecycle events", () => {
    const event = mapComfyProgressToLifecycleEvent({
      promptId: "p1",
      status: "queued",
      queuePosition: 2,
      message: "queued",
    });

    expect(event.executionId).toBe("p1");
    expect(event.status).toBe("queued");
    expect(event.percent).toBe(5);
    expect(event.queuePosition).toBe(2);
  });

  it("normalizes execution errors", () => {
    expect(mapComfyError(new Error("Timed out waiting"))).toMatchObject({
      code: "queue-timeout",
      retriable: true,
    });
    expect(mapComfyError(new Error("Prompt was cancelled"))).toMatchObject({
      code: "execution-cancelled",
      retriable: false,
    });
  });
});
