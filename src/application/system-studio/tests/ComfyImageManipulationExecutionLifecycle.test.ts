import { describe, expect, it } from "bun:test";
import {
  ComfyImageManipulationExecutionLifecycleTracker,
} from "../ComfyImageManipulationExecutionLifecycle";

describe("ComfyImageManipulationExecutionLifecycleTracker", () => {
  it("normalizes queued/running/completed into queued/running/succeeded", () => {
    const tracker = new ComfyImageManipulationExecutionLifecycleTracker("exec-1");

    tracker.pushProgress({ executionId: "exec-1", status: "queued", percent: 2, updatedAt: "2026-01-01T00:00:00.000Z" });
    tracker.pushProgress({ executionId: "exec-1", status: "running", percent: 55, updatedAt: "2026-01-01T00:00:01.000Z" });
    const final = tracker.complete({
      status: "completed",
      executionId: "exec-1",
      outputs: [],
      materializationHooks: [],
    });

    expect(tracker.getSnapshots().map((entry) => entry.status)).toEqual(["queued", "running", "succeeded"]);
    expect(final.progressPercent).toBe(100);
  });

  it("normalizes cancelled/failure with stable error shape", () => {
    const tracker = new ComfyImageManipulationExecutionLifecycleTracker("exec-2");
    const final = tracker.complete({
      status: "failed",
      executionId: "exec-2",
      error: {
        code: "execution-failed",
        category: "execution",
        message: "Generation failed.",
        retryable: true,
      },
    });

    expect(final.status).toBe("failed");
    expect(final.error?.code).toBe("execution-failed");
    expect(final.terminal).toBeTrue();
  });
});
