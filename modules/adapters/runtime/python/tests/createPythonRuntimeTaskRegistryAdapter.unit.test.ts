import { describe, expect, it, testDouble } from "../../../testing/node-test";
import { createPythonRuntimeTaskRegistryAdapter } from "../createPythonRuntimeTaskRegistryAdapter";

describe("createPythonRuntimeTaskRegistryAdapter", () => {
  it("maps startTask payload to python runtime", async () => {
    const runtimePort: any = { startTask: testDouble.fn(async (request) => ({ requestId: request.requestId, taskType: "prepare-training-dataset", accepted: true, status: "queued" })), readTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    const result = await adapter.startTask({ requestId: "req-1", taskType: "dataset-preparation", payload: { a: 1 } });
    expect(result.requestId).toBe("req-1");
    expect(runtimePort.startTask).toHaveBeenCalledWith({ requestId: "req-1", taskType: "dataset-preparation", payload: { a: 1 }, metadata: undefined });
  });

  it("maps getTaskStatus to RuntimeTaskRecord", async () => {
    const runtimePort: any = { startTask: testDouble.fn(), readTaskStatus: testDouble.fn(async () => ({ requestId: "req-1", taskType: "prepare-training-dataset", status: "running", progress: { completed: 1, total: 2 } })), cancelTask: testDouble.fn(), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    const result = await adapter.getTaskStatus("req-1");
    expect(result.taskType).toBe("dataset-preparation");
    expect(result.status).toBe("running");
    expect(result.concurrencyClass).toBe("unknown");
  });
});
