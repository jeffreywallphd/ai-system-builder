import { describe, expect, it } from "bun:test";
import { CreateWorkflowUseCase } from "../../../application/workflows/CreateWorkflowUseCase";
import { PreviewWorkflowExecutor } from "../execution/PreviewWorkflowExecutor";

describe("PreviewWorkflowExecutor", () => {
  it("completes execution and emits progress events", async () => {
    const workflow = new CreateWorkflowUseCase().execute({
      metadata: { name: "Preview" },
    }).workflow;
    const executor = new PreviewWorkflowExecutor({
      startDelayMs: 0,
      progressDelayMs: 0,
    });

    const events: string[] = [];
    const result = await executor.execute({ workflow }, (event) => {
      events.push(event.kind);
    });

    expect(result.status).toBe("completed");
    expect(events).toContain("workflow-progress");
    expect(events).toContain("workflow-completed");
  });
});
