import { describe, expect, it } from "bun:test";
import { WorkflowRuntimeSelector } from "../../../../application/execution/WorkflowRuntimeSelector";
import { InterpretedWorkflowExecutionStrategy } from "../InterpretedWorkflowExecutionStrategy";
import { DefaultNodeExecutionContextResolver } from "../DefaultNodeExecutionContextResolver";
import { DefaultNodeOutputStore } from "../DefaultNodeOutputStore";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

describe("Runtime selector interpreted interactions", () => {
  it("selects interpreted strategy for langchain workflows", () => {
    const selector = new WorkflowRuntimeSelector();
    const interpreted = new InterpretedWorkflowExecutionStrategy({
      nodeExecutor: new LangChainNodeExecutor(),
      contextResolver: new DefaultNodeExecutionContextResolver(),
      outputStoreFactory: () => new DefaultNodeOutputStore(),
    });

    const selected = selector.selectStrategy(
      { workflow: { id: "wf", runtimeProfile: { preferredRuntime: "langchain" } } as never },
      [interpreted]
    );

    expect(selected.strategy.getDescriptor().runtime).toBe("langchain");
  });
});
