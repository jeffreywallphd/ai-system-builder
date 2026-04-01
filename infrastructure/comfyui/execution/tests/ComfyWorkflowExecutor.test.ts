import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { ComfyQueueExecutionAdapter, ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";

describe("ComfyWorkflowExecutor", () => {
  it("checks runtime compatibility", () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const executor = new ComfyWorkflowExecutor({
      adapter: new ComfyQueueExecutionAdapter({
        requestMapper: {
          map: () => ({ payload: { prompt: {}, client_id: "wf" }, executionContext: {} }),
        } as never,
        queueClient: { buildViewUrl: () => "http://example/file.png" } as never,
      }),
      buildViewUrl: () => "http://example/file.png",
    });

    expect(executor.canExecute({ workflow, target: { runtime: "comfyui" } })).toBe(true);
    expect(executor.canExecute({ workflow, target: { runtime: "other" } })).toBe(false);
  });
});
