import { describe, expect, it } from "bun:test";
import type { IWorkflowExecutionStrategy } from "../interfaces/IWorkflowExecutionStrategy";

describe("IWorkflowExecutionStrategy contract", () => {
  it("exposes descriptor, canHandle, execute", async () => {
    const strategy: IWorkflowExecutionStrategy = {
      getDescriptor: () => ({ id: "s1", runtime: "x", mode: "delegated", supportsPartialDelegation: false }),
      canHandle: () => true,
      execute: async () => ({ executionId: "e1", status: "completed", outputAssets: [] }),
    };

    expect(strategy.getDescriptor().runtime).toBe("x");
    expect(strategy.canHandle({ workflow: { id: "wf" } as never })).toBeTrue();
    expect((await strategy.execute({ workflow: {} as never })).status).toBe("completed");
  });
});
