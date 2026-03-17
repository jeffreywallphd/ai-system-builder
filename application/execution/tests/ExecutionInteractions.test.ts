import { describe, expect, it } from "bun:test";
import { WorkflowRuntimeSelector } from "../WorkflowRuntimeSelector";

describe("application execution interactions", () => {
  it("selects hybrid strategy when requested", () => {
    const selector = new WorkflowRuntimeSelector();
    const hybrid = {
      getDescriptor: () => ({ id: "h", runtime: "langchain", mode: "hybrid" as const, supportsPartialDelegation: true }),
      canHandle: () => true,
      execute: async () => ({ executionId: "h", status: "completed" as const, outputAssets: [] }),
    };
    const delegated = {
      getDescriptor: () => ({ id: "d", runtime: "langchain", mode: "delegated" as const, supportsPartialDelegation: false }),
      canHandle: () => true,
      execute: async () => ({ executionId: "d", status: "completed" as const, outputAssets: [] }),
    };

    const selected = selector.selectStrategy(
      { workflow: { id: "wf" } as never, parameters: { executionMode: "hybrid" } },
      [delegated, hybrid]
    );

    expect(selected.strategy.getDescriptor().mode).toBe("hybrid");
  });
});
