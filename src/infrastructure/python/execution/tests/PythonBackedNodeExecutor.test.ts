import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { PythonBackedNodeExecutor } from "../PythonBackedNodeExecutor";

describe("PythonBackedNodeExecutor", () => {
  it("delegates supported node to python runtime", async () => {
    const node = makeNode({ id: "n1" }).withExecutionProfile({ runtime: "python" as never });
    const executor = new PythonBackedNodeExecutor({
      health: async () => ({ status: "ok", runtime: "python" }),
      executeWorkflow: async () => ({ executionId: "wf", workflowId: "wf", status: "completed", nodeResults: {} }),
      executeNode: async () => ({ executionId: "e1", nodeId: "n1", status: "completed", outputs: { ok: true } }),
    }, ["test"]);

    const result = await executor.executeNode({
      workflow: new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [node] }),
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { text: "hi" },
    });

    expect(result.status).toBe("completed");
  });
});
