import { TaskType } from "../../../contracts/runtime";
import { describe, expect, it, testDouble } from "../../../testing/node-test";
import { createPythonRuntimeTaskRegistryAdapter } from "../createPythonRuntimeTaskRegistryAdapter";

describe("createPythonRuntimeTaskRegistryAdapter", () => {
  it("maps DATASET_PREPARATION startTask to python runtime task type", async () => {
    const runtimePort: any = { startTask: testDouble.fn(async (request) => ({ requestId: request.requestId })), readTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    await adapter.startTask({ requestId: "req-1", taskType: TaskType.DATASET_PREPARATION, payload: { a: 1 } });
    expect(runtimePort.startTask).toHaveBeenCalledWith({ requestId: "req-1", taskType: "prepare-training-dataset", payload: { a: 1 }, metadata: undefined });
  });

  it("maps MODEL_TRAINING startTask to train-model", async () => {
    const runtimePort: any = { startTask: testDouble.fn(async (request) => ({ requestId: request.requestId })), readTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    await adapter.startTask({ requestId: "req-2", taskType: TaskType.MODEL_TRAINING, payload: {} });
    expect(runtimePort.startTask).toHaveBeenCalledWith({ requestId: "req-2", taskType: "train-model", payload: {}, metadata: undefined });
  });

  it("throws clear error for unknown python task type in status", async () => {
    const runtimePort: any = { startTask: testDouble.fn(), readTaskStatus: testDouble.fn(async () => ({ requestId: "req-1", taskType: "mystery-task", status: "running" })), cancelTask: testDouble.fn(), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    await expect(adapter.getTaskStatus("req-1")).rejects.toThrow("Unknown python runtime task type");
  });

  it("maps cancel status and preserves message", async () => {
    const runtimePort: any = { startTask: testDouble.fn(), readTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(async () => ({ requestId: "req-1", cancelled: false, status: "running", message: "Task is already running." })), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    const result = await adapter.cancelTask("req-1");
    expect(result).toEqual({ requestId: "req-1", cancelled: false, status: "running", message: "Task is already running." });
  });

  it("maps unknown cancel status to unknown", async () => {
    const runtimePort: any = { startTask: testDouble.fn(), readTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(async () => ({ requestId: "req-404", cancelled: false, status: "not-found" })), executeTask: testDouble.fn(), getHealthStatus: testDouble.fn(), getCapabilities: testDouble.fn(), ensureModelDownloaded: testDouble.fn(), getModelStatus: testDouble.fn(), unloadModels: testDouble.fn() };
    const adapter = createPythonRuntimeTaskRegistryAdapter(runtimePort);
    const result = await adapter.cancelTask("req-404");
    expect(result.status).toBe("unknown");
  });
});
