import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createPythonDatasetPreparationPort } from "../createPythonDatasetPreparationPort";

describe("createPythonDatasetPreparationPort", () => {
  it("starts dataset preparation via runtime startTask", async () => {
    const startTask = testDouble.fn(async (request) => ({ requestId: request.requestId, taskType: request.taskType, accepted: true, status: "queued" }));
    const ensureModelDownloaded = testDouble.fn(async () => ({ provider: "transformers" as const, modelId: "m", downloaded: false, fromCache: true }));
    const adapter = createPythonDatasetPreparationPort({
      executeTask: async () => ({ requestId: "x", taskType: "prepare-training-dataset", success: true, data: {} }),
      startTask,
      readTaskStatus: async () => ({ requestId: "x", status: "running" }),
      cancelTask: async () => ({ requestId: "x", status: "running", cancelled: false }),
      getHealthStatus: async () => ({ healthy: true, status: { runtimeId: "py", status: "ready" } }),
      getCapabilities: async () => ({ runtimeId: "py", capabilities: ["prepare-training-dataset"] }),
      ensureModelDownloaded,
      getModelStatus: async () => ({ loadedModels: [], activeTaskCount: 0 }),
      unloadModels: async () => ({ unloadedModels: [], activeTaskCount: 0 }),
    }, { taskTimeoutMs: 25_000, inactivityTimeoutMs: 90_000 });

    const started = await adapter.startPrepareTrainingDataset({ sourceInputs: [], recipe: { normalization: { targetFormat: "markdown" }, chunking: { strategy: "character", chunkSize: 1, chunkOverlap: 0 }, generation: { mode: "qa", model: { provider: "transformers", modelId: "m" } } }, split: { trainRatio: 0.8, testRatio: 0.2 }, output: { format: "jsonl" } }, { requestId: "req-1" });
    expect(started.requestId).toBe("req-1");
    expect(ensureModelDownloaded).toHaveBeenCalledOnce();
    expect(startTask.mock.calls[0]?.[0]).toMatchObject({ requestId: "req-1", timeoutMs: 25_000, metadata: { datasetPreparationInactivityTimeoutMs: 90_000 } });
  });

  it("maps succeeded task status payload into dataset preparation result", async () => {
    const adapter = createPythonDatasetPreparationPort({
      executeTask: async () => ({ requestId: "x", taskType: "prepare-training-dataset", success: true, data: {} }),
      startTask: async () => ({ requestId: "x", accepted: true, status: "queued" }),
      readTaskStatus: async () => ({
        requestId: "x",
        status: "succeeded",
        data: {
          outputs: [{ name: "dataset", role: "dataset", tempPath: "/tmp/dataset.jsonl", mediaType: "application/x-ndjson" }],
          summary: { sourceDocumentCount: 1, normalizedDocumentCount: 1, skippedDocumentCount: 0, chunkCount: 1, generatedExampleCount: 1, datasetRowCount: 1, trainRowCount: 1, testRowCount: 0 },
        },
      }),
      cancelTask: async () => ({ requestId: "x", status: "running", cancelled: false }),
      getHealthStatus: async () => ({ healthy: true, status: { runtimeId: "py", status: "ready" } }),
      getCapabilities: async () => ({ runtimeId: "py", capabilities: ["prepare-training-dataset"] }),
      ensureModelDownloaded: async () => ({ provider: "transformers", modelId: "m", downloaded: false, fromCache: true }),
      getModelStatus: async () => ({ loadedModels: [], activeTaskCount: 0 }),
      unloadModels: async () => ({ unloadedModels: [], activeTaskCount: 0 }),
    });

    const status = await adapter.readPrepareTrainingDatasetStatus("x");
    expect(status.status).toBe("succeeded");
  });
});
