import { describe, expect, it } from "bun:test";
import type { IWorkflowExecutor } from "@application/ports/interfaces/IWorkflowExecutor";
import { ComfyQueueExecutionAdapter, ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";

describe("execution contracts", () => {
  it("ComfyWorkflowExecutor conforms to workflow executor interface", () => {
    const executor: IWorkflowExecutor = new ComfyWorkflowExecutor({
      adapter: new ComfyQueueExecutionAdapter({
        requestMapper: {
          map: () => ({ payload: { prompt: {}, client_id: "wf" }, executionContext: {} }),
        } as never,
        queueClient: { buildViewUrl: () => "http://example/file.png" } as never,
      }),
      buildViewUrl: () => "http://example/file.png",
    });

    expect(typeof executor.startExecution).toBe("function");
    expect(typeof executor.execute).toBe("function");
  });
});

