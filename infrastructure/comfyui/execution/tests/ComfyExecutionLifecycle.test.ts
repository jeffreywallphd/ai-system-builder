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
      category: "timeout",
      retriable: true,
      diagnostics: expect.objectContaining({ failureClass: "environment-configuration" }),
    });
    expect(mapComfyError(new Error("Prompt was cancelled"))).toMatchObject({
      code: "execution-cancelled",
      category: "cancellation",
      retriable: false,
    });
    expect(mapComfyError(new Error("Missing model checkpoint SDXL"))).toMatchObject({
      diagnostics: expect.objectContaining({ failureClass: "user-correctable" }),
    });
  });

  it("normalizes mapping failures with structured diagnostics", () => {
    const normalized = mapComfyError(new Error("unknown property id"), {
      stage: "request-mapping",
      context: {
        identifiers: { workflowId: "wf-1", executionId: "exec-1" },
        datasets: { datasetAssetRefs: [], datasetInstanceRefs: [] },
        inputs: { selectedAssetRefs: [] },
        runtime: { parameters: {}, options: {} },
      },
    });

    expect(normalized.code).toBe("request-mapping-failed");
    expect(normalized.executionRef).toEqual({ executionId: "exec-1", workflowId: "wf-1" });
    expect(normalized.diagnostics).toMatchObject({ stage: "request-mapping" });
  });
});
