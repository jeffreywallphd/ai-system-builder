import { describe, expect, it } from "bun:test";
import { ModelDownloadHandle, ModelDownloadProgress, ModelDownloadResult, ModelDownloader } from "../ModelDownloader";
import { ModelInstaller } from "../ModelInstaller";
import { WorkflowExecutionEvent, WorkflowExecutionHandle, WorkflowExecutionProgress, WorkflowExecutionResult, WorkflowExecutor } from "../WorkflowExecutor";
import { makeAsset, makeModel, makeWorkflow } from "./testUtils";

describe("Application ports interactions", () => {
  it("wires ModelInstaller with ModelDownloader end-to-end", async () => {
    const model = makeModel();
    const downloader = new ModelDownloader([
      {
        canDownload: () => true,
        download: async () => new ModelDownloadResult({ modelId: model.id, destination: "/models/model-1", status: "completed" }),
        startDownload: async () =>
          new ModelDownloadHandle({
            operationId: "dl-1",
            request: { model, destination: "/models/model-1" },
            initialProgress: new ModelDownloadProgress({ modelId: model.id, status: "downloading", percent: 60 }),
            completionPromise: Promise.resolve(new ModelDownloadResult({ modelId: model.id, destination: "/models/model-1", status: "completed", sizeBytes: 512 })),
          }),
      },
    ]);

    const installer = new ModelInstaller({ downloader });
    const statuses: string[] = [];
    const result = await installer.install({ model, destination: "/models/model-1" }, (p) => statuses.push(p.status));

    expect(result.status).toBe("completed");
    expect(statuses).toContain("preparing");
    expect(statuses).toContain("preparing");
    expect(statuses.length).toBeGreaterThan(0);
  });

  it("wires WorkflowExecutor events from execution handle to completion payload", async () => {
    const workflow = makeWorkflow();
    const result = new WorkflowExecutionResult({ executionId: "exec-x", status: "completed", outputAssets: [makeAsset()], messages: ["done"] });

    const nested = new WorkflowExecutor([
      {
        canExecute: () => true,
        execute: async () => result,
        startExecution: async () =>
          new WorkflowExecutionHandle({
            executionId: "exec-x",
            input: { workflow },
            initialProgress: new WorkflowExecutionProgress({ executionId: "exec-x", status: "running", percent: 10 }),
            completionPromise: Promise.resolve(result),
            subscribe: (listener) => {
              listener(new WorkflowExecutionEvent({ executionId: "exec-x", kind: "node-progress", status: "running", nodeId: "node-1", message: "running" }));
              return () => undefined;
            },
          }),
      },
    ]);

    const eventKinds: string[] = [];
    const final = await nested.execute({ workflow }, (e) => eventKinds.push(e.kind));

    expect(final.status).toBe("completed");
    expect(eventKinds).toEqual(["node-progress", "workflow-completed", "asset-produced"]);
  });
});
