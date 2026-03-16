import { describe, expect, it } from "bun:test";
import type { IWorkflowExecutor } from "../../../../application/ports/interfaces/IWorkflowExecutor";
import { ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";

describe("execution contracts", () => {
  it("ComfyWorkflowExecutor conforms to workflow executor interface", () => {
    const executor: IWorkflowExecutor = new ComfyWorkflowExecutor({
      workflowAdapter: { adaptWorkflowEnvelope: () => ({ prompt: {}, client_id: "wf" }) } as never,
      apiClient: {} as never,
      queueClient: {} as never,
    });

    expect(typeof executor.startExecution).toBe("function");
    expect(typeof executor.execute).toBe("function");
  });
});
