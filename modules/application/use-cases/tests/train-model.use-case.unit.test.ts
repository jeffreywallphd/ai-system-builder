import { describe, expect, it, testDouble } from "../../../testing/node-test";

import type { ModelRegistryPort, ModelTrainingPort } from "../../ports/model";
import { TrainModelUseCase } from "../model/train-model.use-case";

describe("TrainModelUseCase", () => {
  const baseRequest = {
    baseModel: { modelRecordId: "base-1" },
    datasets: [{ artifactId: "dataset-1", splitRole: "train" as const }],
    method: "lora" as const,
    commonParameters: {},
    output: {
      outputModelName: "demo-adapter",
      destination: { local: { enabled: true } },
      registration: { displayName: "Demo Adapter", artifactForm: "adapter" as const },
    },
  };

  it("validates base model selection", async () => {
    const useCase = new TrainModelUseCase({
      modelTraining: { trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>() },
      modelRegistry: {
        listModels: async () => ({ models: [] }),
        getModelRecord: async () => undefined,
        saveModelReference: async () => { throw new Error("not used"); },
        registerDownloadedModel: async () => { throw new Error("not used"); },
        registerGeneratedModel: async () => { throw new Error("not used"); },
        updateModelRecord: async () => { throw new Error("not used"); },
        deleteModelRecord: async () => { throw new Error("not used"); },
      },
    });

    await expect(useCase.execute({ ...baseRequest, baseModel: {} })).rejects.toThrow("requires a base model selection");
  });

  it("calls training port and registers generated model on success", async () => {
    const trainModel = testDouble.fn<ModelTrainingPort["trainModel"]>().mockResolvedValue({
      runId: "run-1",
      status: "succeeded",
      generatedModelCandidate: {
        displayName: "Demo Adapter",
        localPath: "/tmp/models/demo-adapter",
        artifactForm: "adapter",
      },
    });
    const registerGeneratedModel = testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>().mockResolvedValue({
      model: {
        modelRecordId: "generated-1",
        displayName: "Demo Adapter",
        source: "generated",
        lifecycleStatus: "generated",
        artifactForm: "adapter",
        provider: "unknown",
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    });

    const useCase = new TrainModelUseCase({
      modelTraining: { trainModel },
      modelRegistry: {
        listModels: async () => ({ models: [] }),
        getModelRecord: async () => ({
          modelRecordId: "base-1",
          displayName: "Base",
          source: "huggingface",
          lifecycleStatus: "saved-reference",
          artifactForm: "full-model",
          provider: "huggingface",
          modelId: "org/base",
          createdAt: "2026-04-27T00:00:00.000Z",
        }),
        saveModelReference: async () => { throw new Error("not used"); },
        registerDownloadedModel: async () => { throw new Error("not used"); },
        registerGeneratedModel,
        updateModelRecord: async () => { throw new Error("not used"); },
        deleteModelRecord: async () => { throw new Error("not used"); },
      },
    });

    const result = await useCase.execute(baseRequest);
    expect(trainModel).toHaveBeenCalled();
    expect(registerGeneratedModel).toHaveBeenCalled();
    expect(result.outputModel?.modelRecordId).toBe("generated-1");
  });

  it("does not register generated model on training failure", async () => {
    const registerGeneratedModel = testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>();
    const useCase = new TrainModelUseCase({
      modelTraining: {
        trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>().mockResolvedValue({ runId: "run-2", status: "failed", error: { code: "failed", message: "boom" } }),
      },
      modelRegistry: {
        listModels: async () => ({ models: [] }),
        getModelRecord: async () => ({
          modelRecordId: "base-1",
          displayName: "Base",
          source: "huggingface",
          lifecycleStatus: "saved-reference",
          artifactForm: "full-model",
          provider: "huggingface",
          modelId: "org/base",
          createdAt: "2026-04-27T00:00:00.000Z",
        }),
        saveModelReference: async () => { throw new Error("not used"); },
        registerDownloadedModel: async () => { throw new Error("not used"); },
        registerGeneratedModel,
        updateModelRecord: async () => { throw new Error("not used"); },
        deleteModelRecord: async () => { throw new Error("not used"); },
      },
    });

    const result = await useCase.execute(baseRequest);
    expect(result.status).toBe("failed");
    expect(registerGeneratedModel).not.toHaveBeenCalled();
  });
});
