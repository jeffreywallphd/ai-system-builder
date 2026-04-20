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
        summary: {
          sourceDocumentCount: 1,
          normalizedDocumentCount: 1,
          skippedDocumentCount: 0,
          chunkCount: 2,
          generatedExampleCount: 10,
          trainRowCount: 8,
          testRowCount: 2,
        },
      },
    }));

    const adapter = createPythonDatasetPreparationPort({
      executeTask,
      getHealthStatus: async () => ({ healthy: true, status: { runtimeId: "py", status: "ready" } }),
      getCapabilities: async () => ({ runtimeId: "py", capabilities: ["prepare-training-dataset"] }),
    });

    const result = await adapter.prepareTrainingDataset({
      sourceInputs: [{ artifactId: "a1", localPath: "/tmp/a1.jsonl", mediaType: "application/x-ndjson" }],
      recipe: {
        normalization: { targetFormat: "markdown" },
        chunking: { strategy: "character", chunkSize: 1000, chunkOverlap: 100 },
        generation: {
          mode: "qa",
          model: { provider: "transformers", modelId: "test-model" },
        },
      },
      split: { trainRatio: 0.8, testRatio: 0.2, shuffle: true },
      output: {
        format: "jsonl",
        destinations: {
          local: { enabled: true },
          huggingFace: { enabled: true, repository: "org/repo", pathPrefix: "datasets" },
        },
      },
    });

    expect(executeTask).toHaveBeenCalledOnce();
    expect(executeTask.mock.calls[0]?.[0]).toMatchObject({
      taskType: "prepare-training-dataset",
      requestId: expect.stringMatching(/^prepare-training-dataset-\d{14}-\d{6}$/),
      payload: {
        output: {
          destinations: {
            huggingFace: { repository: "org/repo", pathPrefix: "datasets" },
          },
        },
      },
    });
    expect(result.summary.trainRowCount).toBe(8);
    expect(result.outputs.map((output) => output.role)).toEqual(["train", "test"]);
    expect(result.warnings).toBeUndefined();
  });

  it("fails clearly for invalid runtime output role values", async () => {
    const adapter = createPythonDatasetPreparationPort({
      executeTask: async () => ({
        requestId: "req-1",
        taskType: "prepare-training-dataset",
        success: true,
        data: {
          outputs: [{ name: "bad", role: "invalid-role", tempPath: "/tmp/out", mediaType: "application/json" }],
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 1,
            generatedExampleCount: 1,
            trainRowCount: 1,
            testRowCount: 0,
          },
        },
      }),
      getHealthStatus: async () => ({ healthy: true, status: { runtimeId: "py", status: "ready" } }),
      getCapabilities: async () => ({ runtimeId: "py", capabilities: ["prepare-training-dataset"] }),
    });

    await expect(adapter.prepareTrainingDataset({
      sourceInputs: [{ artifactId: "a1", localPath: "/tmp/a1.jsonl", mediaType: "application/x-ndjson" }],
      recipe: {
        normalization: { targetFormat: "markdown" },
        chunking: { strategy: "character", chunkSize: 1000, chunkOverlap: 100 },
        generation: {
          mode: "qa",
          model: { provider: "transformers", modelId: "test-model" },
        },
      },
      split: { trainRatio: 0.8, testRatio: 0.2 },
      output: { format: "jsonl" },
    })).rejects.toThrow("must be a known runtime output role");
  });
});
