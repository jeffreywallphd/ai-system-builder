import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";

describe("execution interactions", () => {
  it("executes with queue + adapter interaction", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });

    const executor = new ComfyWorkflowExecutor({
      workflowAdapter: { adaptWorkflowEnvelope: () => ({ prompt: {}, client_id: "wf" }) } as never,
      apiClient: { buildViewUrl: () => "http://example/file.png", downloadFile: async () => new Uint8Array([1]) } as never,
      queueClient: {
        enqueuePrompt: async () => ({ prompt_id: "p1" }),
        waitForCompletion: async () => ({ status: { completed: true, messages: ["ok"] }, outputs: {} }),
        cancelPrompt: async () => undefined,
      } as never,
    });

    const result = await executor.execute({ workflow });
    expect(result.status).toBe("completed");
    expect(result.executionId).toBe("p1");
  });
});
