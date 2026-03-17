import { describe, expect, it } from "bun:test";
import { DelegatedWorkflowExecutionStrategy } from "../DelegatedWorkflowExecutionStrategy";

describe("DelegatedWorkflowExecutionStrategy", () => {
  it("delegates execution through adapter", async () => {
    const strategy = new DelegatedWorkflowExecutionStrategy({
      delegate: async () => ({ promptId: "p1" }),
    });

    const result = await strategy.execute({ workflow: { id: "wf-1" } as never });
    expect(result.status).toBe("completed");
    expect(result.messages?.[0]).toContain("Delegated workflow execution");
  });
});
