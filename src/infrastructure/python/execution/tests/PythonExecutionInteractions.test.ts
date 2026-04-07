import { describe, expect, it } from "bun:test";
import { PythonBackedNodeExecutor } from "../PythonBackedNodeExecutor";
import { makeNode } from "../../../../src/domain/workflows/tests/testUtils";

describe("python execution interactions", () => {
  it("skips unsupported nodes", async () => {
    const executor = new PythonBackedNodeExecutor({
      health: async () => ({ status: "ok", runtime: "python" }),
      executeWorkflow: async () => ({ executionId: "wf", workflowId: "wf", status: "completed", nodeResults: {} }),
      executeNode: async () => ({ executionId: "e1", nodeId: "n1", status: "completed", outputs: {} }),
    }, ["langchain.prompt_template"]);

    const node = makeNode({ id: "n1" });
    expect(executor.canExecuteNode(node)).toBe(false);
  });
});
