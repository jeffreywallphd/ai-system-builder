import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { createPythonDatasetPreparationPort } from "../createPythonDatasetPreparationPort";

describe("createPythonDatasetPreparationPort", () => {
  it("maps task-specific request/result through PythonRuntimePort", async () => {
    const executeTask = testDouble.fn(async (request) => ({
      requestId: request.requestId,
      taskType: request.taskType,
      success: true,
      data: {
        outputs: [
          { name: "dataset-train", role: "train", tempPath: "/tmp/train.jsonl", mediaType: "application/x-ndjson" },
          { name: "dataset-test", role: "test", tempPath: "/tmp/test.jsonl", mediaType: "application/x-ndjson" },
        ],
        trainRowCount: 8,
        testRowCount: 2,
      },
    }));

    const adapter = createPythonDatasetPreparationPort({
      executeTask,
      getHealthStatus: async () => ({ healthy: true, status: { runtimeId: "py", status: "ready" } }),
      getCapabilities: async () => ({ runtimeId: "py", capabilities: ["prepare-templated-dataset"] }),
    });

    const result = await adapter.prepareTemplatedDataset({
      sourceInputs: [{ artifactId: "a1", localPath: "/tmp/a1.jsonl", mediaType: "application/x-ndjson" }],
      template: "Prompt: {{text}}",
      split: { trainRatio: 0.8, testRatio: 0.2 },
      outputFormat: "jsonl",
    });

    expect(executeTask).toHaveBeenCalledOnce();
    expect(executeTask.mock.calls[0]?.[0]).toMatchObject({
      taskType: "prepare-templated-dataset",
      requestId: expect.stringMatching(/^prepare-templated-dataset-\d{14}-\d{6}$/),
    });
    expect(result.trainRowCount).toBe(8);
    expect(result.outputs.map((output) => output.role)).toEqual(["train", "test"]);
  });

  it("fails clearly for invalid runtime output role values", async () => {
    const adapter = createPythonDatasetPreparationPort({
      executeTask: async () => ({
        requestId: "req-1",
        taskType: "prepare-templated-dataset",
        success: true,
        data: {
          outputs: [{ name: "bad", role: "invalid-role", tempPath: "/tmp/out", mediaType: "application/json" }],
          trainRowCount: 1,
          testRowCount: 0,
        },
      }),
      getHealthStatus: async () => ({ healthy: true, status: { runtimeId: "py", status: "ready" } }),
      getCapabilities: async () => ({ runtimeId: "py", capabilities: ["prepare-templated-dataset"] }),
    });

    await expect(adapter.prepareTemplatedDataset({
      sourceInputs: [{ artifactId: "a1", localPath: "/tmp/a1.jsonl", mediaType: "application/x-ndjson" }],
      template: "Prompt: {{text}}",
      split: { trainRatio: 0.8, testRatio: 0.2 },
      outputFormat: "jsonl",
    })).rejects.toThrow("must be a known runtime output role");
  });
});
