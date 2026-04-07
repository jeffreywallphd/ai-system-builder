import { describe, expect, it } from "bun:test";
import { Workflow } from "@domain/workflows/Workflow";
import { WorkflowMetadata } from "@domain/workflows/WorkflowMetadata";
import { makeNode } from "@domain/workflows/tests/testUtils";
import { PythonDelegatedWorkflowExecutionStrategy } from "../PythonDelegatedWorkflowExecutionStrategy";

describe("PythonDelegatedWorkflowExecutionStrategy", () => {
  it("delegates workflow execution", async () => {
    const strategy = new PythonDelegatedWorkflowExecutionStrategy({
      health: async () => ({ status: "ok", runtime: "python" }),
      executeNode: async () => ({ executionId: "e", nodeId: "n1", status: "completed", outputs: {} }),
      executeWorkflow: async () => ({ executionId: "e1", workflowId: "wf", status: "completed", nodeResults: {} }),
    });

    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const result = await strategy.execute({ workflow, parameters: {} });
    expect(result.status).toBe("completed");
  });
});

