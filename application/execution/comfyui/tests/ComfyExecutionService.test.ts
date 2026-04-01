import { describe, expect, it } from "bun:test";
import { ComfyExecutionService } from "../ComfyExecutionService";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";

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
  });
});
