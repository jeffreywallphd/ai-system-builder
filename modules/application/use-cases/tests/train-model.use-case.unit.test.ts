import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { TaskType } from "../../../contracts/runtime";
import type { TaskPowerLifecyclePort } from "../../services/runtime";
import type { ModelRegistryPort, ModelTrainingPort } from "../../ports/model";
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

  it("starts blocker before training resolves and completes with terminal status", async () => {
    let resolveTraining: ((value: Awaited<ReturnType<ModelTrainingPort["trainModel"]>>) => void) | undefined;
    const modelTraining = {
      trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>(async () => await new Promise((resolve) => {
        resolveTraining = resolve;
      })),
    };
    const lifecycle = createLifecycleFake();
    const useCase = new TrainModelUseCase({ modelTraining, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, taskPowerLifecycle: lifecycle });

    const pending = useCase.execute(baseRequest);
    await Promise.resolve();

    expect(lifecycle.startTask).toHaveBeenCalledTimes(1);
    expect(modelTraining.trainModel).toHaveBeenCalledTimes(1);

    resolveTraining?.({ runId: "run-1", status: "failed", error: { code: "failed", message: "boom" } });
    await pending;

    const startRequestId = (lifecycle.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0][0] as string;
    expect(lifecycle.completeTask).toHaveBeenCalledWith(startRequestId, "failed");
  });

  it.each(["succeeded", "failed", "cancelled"] as const)("completes blocker for %s", async (status) => {
    const lifecycle = createLifecycleFake();
    const useCase = new TrainModelUseCase({ modelTraining: { trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>().mockResolvedValue({ runId: "run-1", status, ...(status === "failed" ? { error: { code: "failed", message: "boom" } } : {}) }) }, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, taskPowerLifecycle: lifecycle });
    await useCase.execute(baseRequest);
    const startRequestId = (lifecycle.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0][0] as string;
    expect(lifecycle.completeTask).toHaveBeenCalledWith(startRequestId, status);
  });

  it("completes blocker when training throws", async () => {
    const lifecycle = createLifecycleFake();
    const useCase = new TrainModelUseCase({ modelTraining: { trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>().mockRejectedValue(new Error("boom")) }, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, taskPowerLifecycle: lifecycle });
    await expect(useCase.execute(baseRequest)).rejects.toThrow("boom");
    expect(lifecycle.completeTask).toHaveBeenCalledWith(expect.any(String), "unknown");
  });

  it("blocker start failure does not fail training", async () => {
    const lifecycle: TaskPowerLifecyclePort = {
      startTask: testDouble.fn(async () => { throw new Error("no blocker"); }),
      completeTask: testDouble.fn(async () => undefined),
    };
    const useCase = new TrainModelUseCase({ modelTraining: { trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>().mockResolvedValue({ runId: "run-1", status: "failed", error: { code: "failed", message: "boom" } }) }, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, taskPowerLifecycle: lifecycle });
    await expect(useCase.execute(baseRequest)).resolves.toBeDefined();
  });

  it("completes blocker with tentative run id when runtime run id differs", async () => {
    const lifecycle = createLifecycleFake();
    const useCase = new TrainModelUseCase({
      modelTraining: { trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>().mockResolvedValue({ runId: "runtime-run-42", status: "failed", error: { code: "failed", message: "boom" } }) },
      modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() },
      taskPowerLifecycle: lifecycle,
    });

    await useCase.execute(baseRequest);

    const startRequestId = (lifecycle.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0][0] as string;
    expect(startRequestId).toBeTruthy();
    expect(startRequestId).not.toBe("runtime-run-42");
    expect(lifecycle.completeTask).toHaveBeenCalledWith(startRequestId, "failed");
    expect(lifecycle.completeTask).not.toHaveBeenCalledWith("runtime-run-42", "failed");
  });
});
