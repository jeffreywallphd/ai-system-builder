import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { ComfyQueueExecutionAdapter, ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";

describe("execution interactions", () => {
  it("executes with queue + adapter interaction", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });

    const executor = new ComfyWorkflowExecutor({
      adapter: new ComfyQueueExecutionAdapter({
        requestMapper: {
          map: () => ({ payload: { prompt: {}, client_id: "wf" }, executionContext: {} }),
        } as never,
        queueClient: {
          enqueuePrompt: async () => ({ prompt_id: "p1" }),
          waitForCompletion: async () => ({ promptId: "p1", messages: ["ok"], outputs: {} }),
          cancelPrompt: async () => undefined,
          buildViewUrl: () => "http://example/file.png",
        } as never,
      }),
      buildViewUrl: () => "http://example/file.png",
    });

    const result = await executor.execute({ workflow });
    expect(result.status).toBe("completed");
    expect(result.executionId).toBe("p1");
  });
});
