import { describe, expect, it } from "bun:test";
import { Workflow } from "@domain/workflows/Workflow";
import { WorkflowMetadata } from "@domain/workflows/WorkflowMetadata";
import { makeNode } from "@domain/workflows/tests/testUtils";
import { InterpretedWorkflowExecutionStrategy } from "../InterpretedWorkflowExecutionStrategy";

describe("InterpretedWorkflowExecutionStrategy", () => {
  it("executes nodes in topological order", async () => {
    const n1 = makeNode({ id: "n1" });
    const n2 = makeNode({ id: "n2" });
    const workflow = new Workflow({
      id: "wf-int",
      metadata: new WorkflowMetadata({ name: "wf" }),
      nodes: [n1, n2],
      connections: [],
    });

    const called: string[] = [];
    const strategy = new InterpretedWorkflowExecutionStrategy({
      nodeExecutor: {
        canExecuteNode: () => true,
        executeNode: async (context) => {
          called.push(context.node.id);
          return { nodeId: context.node.id, status: "completed", outputs: { done: true } };
        },
      },
      contextResolver: {
        resolve: (input) => ({
          workflow: input.workflow,
          node: input.node,
          inputAssets: [],
          workflowInputs: {},
          upstreamOutputs: {},
          resolvedInputs: {},
        }),
      },
      executionIdFactory: () => "exec-a",
    });

    const result = await strategy.execute({ workflow });
    expect(result.status).toBe("completed");
    expect(called).toEqual(["n1", "n2"]);
  });
});

