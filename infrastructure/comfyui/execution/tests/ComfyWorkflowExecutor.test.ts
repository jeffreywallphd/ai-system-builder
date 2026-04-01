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

  it("normalizes adapter mapping failures without leaking raw errors", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const adapter = new ComfyQueueExecutionAdapter({
      requestMapper: {
        map: () => {
          throw new Error("unknown property override");
        },
      } as never,
      queueClient: { buildViewUrl: () => "http://example/file.png" } as never,
    });

    const started = await adapter.start({
      workflow,
      context: {
        identifiers: { workflowId: "wf", executionId: "exec-1" },
        datasets: { datasetAssetRefs: [], datasetInstanceRefs: [] },
        inputs: { selectedAssetRefs: [] },
        runtime: { parameters: {}, options: {} },
      },
    });
    const result = await started.waitForCompletion();

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      code: "request-mapping-failed",
      category: "mapping",
    });
  });
});
