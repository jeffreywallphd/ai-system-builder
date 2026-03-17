import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { DefaultNodeExecutionContextResolver } from "../DefaultNodeExecutionContextResolver";
import { DefaultNodeOutputStore } from "../DefaultNodeOutputStore";
import { InterpretedWorkflowExecutionStrategy } from "../InterpretedWorkflowExecutionStrategy";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

describe("Infrastructure InterpretedWorkflowExecutionStrategy", () => {
  it("runs interpreted execution and completes", async () => {
    const workflow = new Workflow({
      id: "wf",
      metadata: new WorkflowMetadata({ name: "wf" }),
      nodes: [makeNode({ id: "n1" })],
      connections: [],
    });

    const strategy = new InterpretedWorkflowExecutionStrategy({
      nodeExecutor: new LangChainNodeExecutor(),
      contextResolver: new DefaultNodeExecutionContextResolver(),
      outputStoreFactory: () => new DefaultNodeOutputStore(),
    });

    const result = await strategy.execute({ workflow });
    expect(result.status).toBe("completed");
  });
});
