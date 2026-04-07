import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { ComfyQueueExecutionAdapter, ComfyWorkflowExecutor } from "../ComfyWorkflowExecutor";
import { ComfyPromptExecutionError } from "../ComfyQueueClient";

describe("ComfyWorkflowExecutor", () => {
  it("checks runtime compatibility", () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const executor = new ComfyWorkflowExecutor({
      adapter: new ComfyQueueExecutionAdapter({
        requestMapper: {
          map: () => ({ payload: { prompt: {}, client_id: "wf" }, executionContext: {} }),
        } as never,
        queueClient: { buildViewUrl: () => "http://example/file.png" } as never,
      }),
      buildViewUrl: () => "http://example/file.png",
    });

    expect(executor.canExecute({ workflow, target: { runtime: "comfyui" } })).toBe(true);
    expect(executor.canExecute({ workflow, target: { runtime: "other" } })).toBe(false);
  });

  it("normalizes adapter mapping failures without leaking raw errors", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const adapter = new ComfyQueueExecutionAdapter({
      requestMapper: {
        map: () => {
          throw new Error("unknown property override");
        },
      } as never,
      queueClient: { buildViewUrl: () => "http://example/file.png" } as never,
    });

    const started = await adapter.start({
      workflow,
      context: {
        identifiers: { workflowId: "wf", executionId: "exec-1" },
        datasets: { datasetAssetRefs: [], datasetInstanceRefs: [] },
        inputs: { selectedAssetRefs: [] },
        runtime: { parameters: {}, options: {} },
      },
    });
    const result = await started.waitForCompletion();

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      code: "request-mapping-failed",
      category: "mapping",
    });
  });

  it("emits structured adapter lifecycle logs with execution context correlation", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const events: Array<Record<string, unknown>> = [];
    const adapter = new ComfyQueueExecutionAdapter({
      requestMapper: {
        map: (request: { context: unknown }) => ({ payload: { prompt: {}, client_id: "wf" }, executionContext: request.context }),
      } as never,
      queueClient: {
        enqueuePrompt: async () => ({ prompt_id: "p1" }),
        waitForCompletion: async () => ({ promptId: "p1", messages: ["ok"], outputs: {} }),
        cancelPrompt: async () => undefined,
        buildViewUrl: () => "http://example/file.png",
      } as never,
      logger: {
        log: (event) => events.push(event as unknown as Record<string, unknown>),
      },
    });

    const started = await adapter.start({
      workflow,
      context: {
        identifiers: { workflowId: "wf", executionId: "exec-1" },
        datasets: { datasetAssetRefs: [], datasetInstanceRefs: [] },
        inputs: { selectedAssetRefs: [] },
        runtime: { parameters: {}, options: {} },
        observability: { correlationId: "corr-1", lineageId: "lineage-1" },
      },
    });
    await started.waitForCompletion();

    expect(events.map((event) => event.event)).toEqual([
      "request-accepted",
      "execution-started",
      "execution-completed",
    ]);
    expect(events[1]?.executionId).toBe("p1");
    expect(events[2]?.correlationId).toBe("corr-1");
    expect(events[2]?.lineageId).toBe("lineage-1");
  });

  it("preserves partial outputs when ComfyUI run fails after generating files", async () => {
    const workflow = new Workflow({ id: "wf", metadata: new WorkflowMetadata({ name: "wf" }), nodes: [makeNode({ id: "n1" })] });
    const adapter = new ComfyQueueExecutionAdapter({
      requestMapper: {
        map: () => ({ payload: { prompt: {}, client_id: "wf" }, executionContext: {
          identifiers: { workflowId: "wf", executionId: "exec-1" },
          datasets: { datasetAssetRefs: [], datasetInstanceRefs: [] },
          inputs: { selectedAssetRefs: [] },
          runtime: { parameters: {}, options: {} },
        } }),
      } as never,
      queueClient: {
        enqueuePrompt: async () => ({ prompt_id: "p1" }),
        waitForCompletion: async () => {
          throw new ComfyPromptExecutionError("Execution failed", {
            promptId: "p1",
            messages: ["failed after save"],
            outputs: {
              save: [{ kind: "image", filename: "out.png", type: "output" }],
            },
          });
        },
        cancelPrompt: async () => undefined,
        buildViewUrl: () => "http://example/file.png",
      } as never,
    });

    const started = await adapter.start({ workflow });
    const result = await started.waitForCompletion();

    expect(result.status).toBe("failed");
    expect(result.outputs).toHaveLength(1);
    expect(result.error?.diagnostics?.failureClass).toBe("partial-completion");
  });
});
