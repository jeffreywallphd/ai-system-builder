import { describe, expect, it } from "bun:test";
import type { IWorkflowRuntimeSelector } from "../interfaces/IWorkflowRuntimeSelector";

describe("IWorkflowRuntimeSelector contract", () => {
  it("selects from provided strategies", () => {
    const selector: IWorkflowRuntimeSelector = {
      selectStrategy: (_input, strategies) => ({ strategy: strategies[0], reason: "first" }),
    };

    const selected = selector.selectStrategy(
      { workflow: {} as never },
      [{
        getDescriptor: () => ({ id: "1", runtime: "x", mode: "delegated", supportsPartialDelegation: false, defaultProvenance: "delegated" as const }),
        canHandle: () => true,
        execute: async () => ({ executionId: "e", status: "completed", outputAssets: [] }),
      }]
    );

    expect(selected.reason).toBe("first");
  });
});
