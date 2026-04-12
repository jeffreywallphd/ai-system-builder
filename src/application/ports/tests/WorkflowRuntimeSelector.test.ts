import { describe, expect, it } from "bun:test";
import type { IWorkflowRuntimeSelector } from "../interfaces/IWorkflowRuntimeSelector";

describe("IWorkflowRuntimeSelector contract", () => {
  it("selects from provided strategies", async () => {
    const selector: IWorkflowRuntimeSelector = {
      selectStrategy: async (_input, strategies) => ({ strategy: strategies[0], reason: "first" }),
    };

    const selected = await selector.selectStrategy(
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
