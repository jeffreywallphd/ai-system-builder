import { describe, expect, it } from "bun:test";
import { ComfyExecutionService } from "../ComfyExecutionService";
import { Workflow } from "@domain/workflows/Workflow";
import { WorkflowMetadata } from "@domain/workflows/WorkflowMetadata";
import { makeNode } from "@domain/workflows/tests/testUtils";

describe("ComfyExecutionService", () => {
  it("runs trigger -> adapter -> normalized result path", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });

    let mapperCalled = false;
    const service = new ComfyExecutionService(
      {
        capabilities: {
          runtimeId: "comfyui",
          supportsCancellation: true,
          supportsProgressPolling: true,
          supportsAssetReferences: true,
        },
        async start(_request, onLifecycleEvent) {
          onLifecycleEvent?.({ executionId: "p1", status: "running", percent: 50, message: "running" });
          return {
            executionId: "p1",
            cancel: async () => undefined,
            waitForCompletion: async () => ({
              executionId: "p1",
              status: "completed",
              lifecycle: [],
              messages: ["ok"],
              outputs: [{ nodeId: "n1", kind: "text", reference: "p1:n1:text:0", metadata: { text: "hello" } }],
            }),
          };
        },
      },
      {
        toAdapterRequest: (input) => {
          mapperCalled = true;
          return { workflow: input.workflow };
        },
        toWorkflowAssets: () => [],
      },
    );

    const handle = await service.startExecution({ workflow });
    const result = await handle.waitForCompletion();
    expect(result.status).toBe("completed");
    expect(mapperCalled).toBe(true);
    expect(result.inspection?.summary.runtime).toBe("comfyui");
    expect(result.inspection?.summary.outputCount).toBe(1);
    expect(result.inspection?.outputs?.[0]?.reference).toBe("p1:n1:text:0");
  });

  it("maps normalized adapter failures into workflow result inspection diagnostics", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const service = new ComfyExecutionService(
      {
        capabilities: {
          runtimeId: "comfyui",
          supportsCancellation: true,
          supportsProgressPolling: true,
          supportsAssetReferences: true,
        },
        async start() {
          return {
            executionId: "p2",
            cancel: async () => undefined,
            waitForCompletion: async () => ({
              executionId: "p2",
              status: "failed",
              lifecycle: [{ executionId: "p2", status: "failed", message: "Execution failed." }],
              outputs: [],
              error: {
                code: "execution-failed",
                category: "execution",
                severity: "error",
                message: "ComfyUI execution failed.",
                retriable: false,
                retryable: false,
              },
              messages: ["ComfyUI execution failed."],
            }),
          };
        },
      },
      {
        toAdapterRequest: (input) => ({ workflow: input.workflow }),
        toWorkflowAssets: () => [],
      },
    );

    const result = await service.execute({ workflow });
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("ComfyUI execution failed.");
    expect(result.inspection?.summary.hasError).toBe(true);
    expect(result.inspection?.diagnostics?.errorCode).toBe("execution-failed");
  });
});

