import { describe, expect, it } from "bun:test";
import type { IWorkflowExecutionStrategy } from "../../ports/interfaces/IWorkflowExecutionStrategy";
import type { IWorkflowRuntimeSelector } from "../../ports/interfaces/IWorkflowRuntimeSelector";
import { WorkflowRuntimeSelector } from "../WorkflowRuntimeSelector";
import { InterpretedWorkflowExecutionStrategy } from "../InterpretedWorkflowExecutionStrategy";

describe("application execution contracts", () => {
  it("conforms to strategy and selector interfaces", () => {
    const strategy: IWorkflowExecutionStrategy = new InterpretedWorkflowExecutionStrategy({
      nodeExecutor: { canExecuteNode: () => true, executeNode: async () => ({ nodeId: "n", status: "completed", outputs: {} }) },
      contextResolver: { resolve: () => ({ workflow: {} as never, node: {} as never, inputAssets: [], workflowInputs: {}, upstreamOutputs: {}, resolvedInputs: {} }) },
    });

    const selector: IWorkflowRuntimeSelector = new WorkflowRuntimeSelector();
    expect(strategy.getDescriptor().mode).toBe("interpreted");
    expect(typeof selector.selectStrategy).toBe("function");
  });
});
