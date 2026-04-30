import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { TaskType, type RuntimeTaskRegistryPort } from "../../../contracts/runtime";
import type { TaskPowerLifecyclePort } from "../../services/runtime";
import type { ModelRegistryPort } from "../../ports/model";
import type { ArtifactStorageBindingPort } from "../../ports/storage";
import { TrainModelUseCase } from "../model/train-model.use-case";

describe("TrainModelUseCase", () => {
  const baseRequest = { baseModel: { modelRecordId: "base-1" }, datasets: [{ artifactId: "dataset-1", splitRole: "train" as const }], method: "lora" as const, commonParameters: {}, output: { outputModelName: "demo-adapter", destination: { local: { enabled: true } }, registration: { displayName: "Demo Adapter", artifactForm: "adapter" as const } } };
  const baseRegistry = {
    listModels: async () => ({ models: [] }), getModelRecord: async () => ({ modelRecordId: "base-1", displayName: "Base", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", provider: "huggingface", modelId: "org/base", createdAt: "2026-04-27T00:00:00.000Z" }), saveModelReference: async () => { throw new Error("not used"); }, registerDownloadedModel: async () => { throw new Error("not used"); }, updateModelRecord: async () => { throw new Error("not used"); }, deleteModelRecord: async () => { throw new Error("not used"); },
  };

  const createLifecycleFake = (): TaskPowerLifecyclePort => ({
    startTask: testDouble.fn(async () => undefined),
    completeTask: testDouble.fn(async () => undefined),
  });

  const createRuntimeTaskRegistryFake = (): RuntimeTaskRegistryPort => ({
    startTask: testDouble.fn(async () => ({ requestId: "train-req-1", accepted: true, status: "queued" })),
    getTaskStatus: testDouble.fn(async () => ({ requestId: "train-req-1", taskType: TaskType.MODEL_TRAINING, status: "running", concurrencyClass: "unknown" })),
    cancelTask: testDouble.fn(async () => ({ requestId: "train-req-1", cancelled: false, status: "running" })),
    listTasks: testDouble.fn(async () => ({ tasks: [] })),
  });
  const createStorageBindingsFake = (): Pick<ArtifactStorageBindingPort, "readArtifactStorageBindings"> => ({
    readArtifactStorageBindings: testDouble.fn(async () => ({
      ok: true,
      value: {
        bindings: [{
          artifactId: "dataset-1",
          role: "primary",
          backing: { kind: "artifact-object", provider: "local-filesystem", locator: "/tmp/dataset-1.parquet" },
        }],
      },
    })),
  });
  const createStorageFake = () => ({
    retrieveArtifact: testDouble.fn(async () => ({
      ok: true,
      value: {
        descriptor: { key: "generated/dataset-1.parquet", mediaType: "application/x-parquet" },
        content: new TextEncoder().encode("dataset-bytes"),
      },
    })),
  });

  it("starts training with runtime task registry", async () => {
    const lifecycle = createLifecycleFake();
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new TrainModelUseCase({ runtimeTaskRegistry, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, storageBindings: createStorageBindingsFake(), storage: createStorageFake(), taskPowerLifecycle: lifecycle });

    const result = await useCase.execute(baseRequest);

    expect(runtimeTaskRegistry.startTask).toHaveBeenCalledTimes(1);
    expect(runtimeTaskRegistry.startTask).toHaveBeenCalledWith({
      taskType: TaskType.MODEL_TRAINING,
      payload: expect.objectContaining({ datasets: [expect.objectContaining({ artifactId: "dataset-1", path: "/tmp/dataset-1.parquet" })] }),
    });
    expect(lifecycle.startTask).toHaveBeenCalledWith("train-req-1", TaskType.MODEL_TRAINING);
    expect(result).toEqual({ runId: "train-req-1", status: "queued" });
  });

  it("reads running status from runtime task registry", async () => {
    const lifecycle = createLifecycleFake();
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new TrainModelUseCase({ runtimeTaskRegistry, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, storageBindings: createStorageBindingsFake(), storage: createStorageFake(), taskPowerLifecycle: lifecycle });

    const result = await useCase.read("train-req-1");

    expect(runtimeTaskRegistry.getTaskStatus).toHaveBeenCalledWith("train-req-1");
    expect(result).toEqual({ runId: "train-req-1", status: "running" });
  });

  it("registers generated model on succeeded status only once", async () => {
    const lifecycle = createLifecycleFake();
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    (runtimeTaskRegistry.getTaskStatus as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      requestId: "train-req-1",
      taskType: TaskType.MODEL_TRAINING,
      status: "succeeded",
      concurrencyClass: "unknown",
      data: {
        runId: "train-req-1",
        status: "succeeded",
        generatedModelCandidate: { displayName: "Demo Adapter", provider: "huggingface", modelId: "org/demo-adapter" },
      },
    });
    const registerGeneratedModel = testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>().mockResolvedValue({
      model: {
        modelRecordId: "generated-1",
        displayName: "Demo Adapter",
        source: "generated",
        lifecycleStatus: "saved-reference",
        artifactForm: "adapter",
        provider: "huggingface",
        modelId: "org/demo-adapter",
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    });
    const useCase = new TrainModelUseCase({ runtimeTaskRegistry, modelRegistry: { ...baseRegistry, registerGeneratedModel }, storageBindings: createStorageBindingsFake(), storage: createStorageFake(), taskPowerLifecycle: lifecycle });

    const first = await useCase.read("train-req-1");
    const second = await useCase.read("train-req-1");

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect(registerGeneratedModel).toHaveBeenCalledTimes(1);
    expect(lifecycle.completeTask).toHaveBeenCalledWith("train-req-1", "succeeded");
  });

  it.each(["failed", "cancelled"] as const)("completes lifecycle for terminal status %s", async (status) => {
    const lifecycle = createLifecycleFake();
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    (runtimeTaskRegistry.getTaskStatus as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      requestId: "train-req-1",
      taskType: TaskType.MODEL_TRAINING,
      status,
      concurrencyClass: "unknown",
      error: status === "failed" ? { code: "failed", message: "boom" } : undefined,
    });
    const useCase = new TrainModelUseCase({ runtimeTaskRegistry, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, storageBindings: createStorageBindingsFake(), storage: createStorageFake(), taskPowerLifecycle: lifecycle });

    const result = await useCase.read("train-req-1");
    expect(result.status).toBe(status);
    expect(lifecycle.completeTask).toHaveBeenCalledWith("train-req-1", status);
  });


  it("falls back to local artifact-object binding when file binding is unavailable", async () => {
    const lifecycle = createLifecycleFake();
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const storageBindings: Pick<ArtifactStorageBindingPort, "readArtifactStorageBindings"> = {
      readArtifactStorageBindings: testDouble.fn(async () => ({
        ok: true,
        value: {
          bindings: [{
            artifactId: "dataset-1",
            role: "primary",
            backing: { kind: "artifact-object", provider: "local", locator: "generated/dataset-1.parquet" },
          }],
        },
      })),
    };
    const useCase = new TrainModelUseCase({ runtimeTaskRegistry, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, storageBindings, storage: createStorageFake(), taskPowerLifecycle: lifecycle });

    await useCase.execute(baseRequest);

    expect(runtimeTaskRegistry.startTask).toHaveBeenCalledWith({
      taskType: TaskType.MODEL_TRAINING,
      payload: expect.objectContaining({ datasets: [expect.objectContaining({ artifactId: "dataset-1", path: expect.stringContaining("dataset-1.parquet") })] }),
    });
  });

  it("stages a generated local artifact-object storage key when no binding row exists", async () => {
    const lifecycle = createLifecycleFake();
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const storageBindings: Pick<ArtifactStorageBindingPort, "readArtifactStorageBindings"> = {
      readArtifactStorageBindings: testDouble.fn(async () => ({ ok: true, value: { bindings: [] } })),
    };
    const storage = createStorageFake();
    const generatedDatasetRequest = {
      ...baseRequest,
      datasets: [{ artifactId: "generated/20260429160945623-2e7fe0660f46449f9ce819d011eb13f9-training-dataset.parquet", splitRole: "train" as const }],
    };
    const useCase = new TrainModelUseCase({ runtimeTaskRegistry, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, storageBindings, storage, taskPowerLifecycle: lifecycle });

    await useCase.execute(generatedDatasetRequest);

    expect(storage.retrieveArtifact).toHaveBeenCalledWith({
      key: "generated/20260429160945623-2e7fe0660f46449f9ce819d011eb13f9-training-dataset.parquet",
      requestId: undefined,
      correlationId: undefined,
    });
    expect(runtimeTaskRegistry.startTask).toHaveBeenCalledWith({
      taskType: TaskType.MODEL_TRAINING,
      payload: expect.objectContaining({
        datasets: [expect.objectContaining({
          artifactId: "generated/20260429160945623-2e7fe0660f46449f9ce819d011eb13f9-training-dataset.parquet",
          path: expect.stringContaining("training-dataset.parquet"),
          format: "parquet",
        })],
      }),
    });
  });

});
