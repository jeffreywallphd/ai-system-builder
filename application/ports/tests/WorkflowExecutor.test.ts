import { describe, expect, it } from "bun:test";
import {
  WorkflowExecutionEvent,
  WorkflowExecutionHandle,
  WorkflowExecutionProgress,
  WorkflowExecutionResult,
  WorkflowExecutor,
} from "../WorkflowExecutor";
import type { IWorkflowExecutionInput, IWorkflowExecutionResult, IWorkflowExecutor } from "../interfaces/IWorkflowExecutor";
import { makeAsset, makeWorkflow } from "./testUtils";

const input: IWorkflowExecutionInput = { workflow: makeWorkflow() };

describe("WorkflowExecutor value objects", () => {
  it("normalizes and validates progress/event/result", () => {
    const progress = new WorkflowExecutionProgress({ executionId: " e1 ", status: "running", percent: 120, currentNodeId: " n1 ", message: " hi " });
    const event = new WorkflowExecutionEvent({ executionId: " e1 ", kind: "workflow-progress", status: "running", progress, payload: { a: 1 } });
    const result = new WorkflowExecutionResult({ executionId: " e1 ", status: "completed", outputAssets: [makeAsset()], messages: ["ok"] });

    expect(progress.percent).toBe(100);
    expect(event.executionId).toBe("e1");
    expect(result.outputAssets).toHaveLength(1);
    expect(() => new WorkflowExecutionProgress({ executionId: " ", status: "queued" })).toThrow();
  });

  it("handle updates progress from updates/subscriptions/completion", async () => {
    let cancelled = false;
    const completionPromise = new Promise<WorkflowExecutionResult>((resolve) => {
      setTimeout(() => resolve(new WorkflowExecutionResult({ executionId: "exec-1", status: "completed", outputAssets: [] })), 5);
    });

    const handle = new WorkflowExecutionHandle({
      executionId: "exec-1",
      input,
      completionPromise,
      cancel: () => {
        cancelled = true;
      },
      subscribe: (listener) => {
        listener(new WorkflowExecutionEvent({ executionId: "exec-1", kind: "workflow-progress", status: "running", progress: new WorkflowExecutionProgress({ executionId: "exec-1", status: "running", percent: 30 }) }));
        return () => undefined;
      },
    });

    handle.updateProgress(new WorkflowExecutionProgress({ executionId: "exec-1", status: "running", percent: 10 }));
    expect((await handle.getProgress()).percent).toBe(10);
    await handle.subscribe?.(() => undefined);
    expect((await handle.getProgress()).percent).toBe(30);
    await handle.waitForCompletion();
    expect((await handle.getProgress()).percent).toBe(100);
    await handle.cancel();
    expect(cancelled).toBeTrue();
  });
});

describe("WorkflowExecutor", () => {
  it("delegates execute/startExecution without callback", async () => {
    const provider: IWorkflowExecutor = {
      canExecute: () => true,
      startExecution: async () =>
        new WorkflowExecutionHandle({
          executionId: "p1",
          input,
          completionPromise: Promise.resolve(new WorkflowExecutionResult({ executionId: "p1", status: "completed", outputAssets: [] })),
        }),
      execute: async () => new WorkflowExecutionResult({ executionId: "direct", status: "completed", outputAssets: [] }),
    };

    const executor = new WorkflowExecutor([provider]);
    expect((await executor.startExecution(input)).executionId).toBe("p1");
    expect((await executor.execute(input)).executionId).toBe("direct");
    expect(executor.canExecute(input)).toBeTrue();
  });

  it("emits callback events including completion + asset-produced", async () => {
    const result: IWorkflowExecutionResult = new WorkflowExecutionResult({ executionId: "exec-2", status: "completed", outputAssets: [makeAsset()], messages: ["done"] });
    const provider: IWorkflowExecutor = {
      canExecute: () => true,
      execute: async () => result,
      startExecution: async () =>
        new WorkflowExecutionHandle({
          executionId: "exec-2",
          input,
          initialProgress: new WorkflowExecutionProgress({ executionId: "exec-2", status: "running", percent: 50 }),
          completionPromise: Promise.resolve(result),
          subscribe: (listener) => {
            listener(new WorkflowExecutionEvent({ executionId: "exec-2", kind: "workflow-progress", status: "running", progress: new WorkflowExecutionProgress({ executionId: "exec-2", status: "running", percent: 80 }) }));
            return () => undefined;
          },
        }),
    };

    const events: string[] = [];
    const executor = new WorkflowExecutor([provider]);
    await executor.execute(input, (event) => events.push(event.kind));

    expect(events).toContain("workflow-progress");
    expect(events).toContain("workflow-completed");
    expect(events).toContain("asset-produced");
  });

  it("throws when no executor can execute", async () => {
    const executor = new WorkflowExecutor([]);
    expect(executor.execute(input)).rejects.toThrow("No workflow executor is available");
  });
});
