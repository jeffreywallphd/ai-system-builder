import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";

describe("ComfyWorkflowExecutor", () => {
  it("checks runtime compatibility", () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const executor = new ComfyWorkflowExecutor({
      workflowAdapter: { adaptWorkflowEnvelope: () => ({ prompt: {}, client_id: "wf" }) } as never,
      apiClient: {} as never,
      queueClient: {} as never,
    });

    expect(executor.canExecute({ workflow, target: { runtime: "comfyui" } })).toBe(true);
    expect(executor.canExecute({ workflow, target: { runtime: "other" } })).toBe(false);
  });
});
