import { describe, expect, it } from "bun:test";
import { WorkflowExecutionResult } from "@application/ports/WorkflowExecutor";
import type { IWorkflowExecutionInput } from "@application/ports/interfaces/IWorkflowExecutor";
import { TruthfulWorkflowExecutor } from "../TruthfulWorkflowExecutor";

describe("TruthfulWorkflowExecutor", () => {
  const input: IWorkflowExecutionInput = {
    workflow: { id: "wf-1", runtimeProfile: { preferredRuntime: "python" } } as never,
  };

  it("preserves delegated provenance from the selected strategy", async () => {
    const executor = new TruthfulWorkflowExecutor({
      strategies: [
        {
          getDescriptor: () => ({
            id: "delegated-python",
            runtime: "python",
            mode: "delegated",
            supportsPartialDelegation: false,
            defaultProvenance: "delegated" as const,
          }),
          canHandle: () => true,
          execute: async () => new WorkflowExecutionResult({
            executionId: "exec-1",
            status: "completed",
            outputAssets: [],
            provenance: {
              classification: "delegated",
              runtime: "python",
              strategyId: "delegated-python",
              detail: "Delegated to runtime.",
            },
          }),
        },
      ],
    });

    const result = await executor.execute(input);
    expect(result.provenance?.classification).toBe("delegated");
    expect(result.provenance?.strategyId).toBe("delegated-python");
  });

  it("derives scaffold provenance when a strategy does not return explicit metadata", async () => {
    const executor = new TruthfulWorkflowExecutor({
      strategies: [
        {
          getDescriptor: () => ({
            id: "scaffold-langchain",
            runtime: "langchain",
            mode: "hybrid",
            supportsPartialDelegation: true,
            defaultProvenance: "scaffolded" as const,
          }),
          canHandle: () => true,
          execute: async () => new WorkflowExecutionResult({
            executionId: "exec-2",
            status: "completed",
            outputAssets: [],
          }),
        },
      ],
    });

    const result = await executor.execute({ workflow: { id: "wf-2" } as never });
    expect(result.provenance?.classification).toBe("scaffolded");
    expect(result.provenance?.detail).toContain("execution via scaffold-langchain");
  });
});

