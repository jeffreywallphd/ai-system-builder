import { describe, expect, it, testDouble } from "../../../testing/node-test";

import type { PowerSuspensionBlockerPort } from "../../ports/desktop";
import type { ModelRegistryPort, ModelTrainingPort } from "../../ports/model";
import { TrainModelUseCase } from "../model/train-model.use-case";

function createPowerSuspensionMock(): PowerSuspensionBlockerPort {
  const active = new Map<string, { reason: string; requestId?: string; taskType?: string }>();
  let seq = 0;
  return {
    startBlocker: testDouble.fn(async (reason, context) => {
      seq += 1;
      const blockerId = `b-${seq}`;
      active.set(blockerId, { reason, requestId: context?.requestId, taskType: context?.taskType });
      return { blockerId, active: true };
    }),
    stopBlocker: testDouble.fn(async (blockerId) => {
      active.delete(blockerId);
      return { blockerId, active: false };
    }),
    listBlockers: testDouble.fn(async () => [...active.entries()].map(([blockerId, value]) => ({ blockerId, active: true, ...value }))),
  };
}

describe("TrainModelUseCase", () => {
  const baseRequest = { baseModel: { modelRecordId: "base-1" }, datasets: [{ artifactId: "dataset-1", splitRole: "train" as const }], method: "lora" as const, commonParameters: {}, output: { outputModelName: "demo-adapter", destination: { local: { enabled: true } }, registration: { displayName: "Demo Adapter", artifactForm: "adapter" as const } } };
  const baseRegistry = {
    listModels: async () => ({ models: [] }), getModelRecord: async () => ({ modelRecordId: "base-1", displayName: "Base", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", provider: "huggingface", modelId: "org/base", createdAt: "2026-04-27T00:00:00.000Z" }), saveModelReference: async () => { throw new Error("not used"); }, registerDownloadedModel: async () => { throw new Error("not used"); }, updateModelRecord: async () => { throw new Error("not used"); }, deleteModelRecord: async () => { throw new Error("not used"); },
  };

  it("starts and stops blocker for terminal states", async () => {
    const powerSuspension = createPowerSuspensionMock();
    const useCase = new TrainModelUseCase({ modelTraining: { trainModel: testDouble.fn<ModelTrainingPort["trainModel"]>().mockResolvedValue({ runId: "run-1", status: "failed", error: { code: "failed", message: "boom" } }) }, modelRegistry: { ...baseRegistry, registerGeneratedModel: testDouble.fn<ModelRegistryPort["registerGeneratedModel"]>() }, powerSuspension });
    await useCase.execute(baseRequest);
    expect(powerSuspension.startBlocker).toHaveBeenCalledWith("model-training", { requestId: "run-1", taskType: "model-training" });
    expect(powerSuspension.stopBlocker).toHaveBeenCalledTimes(1);
    expect((await powerSuspension.listBlockers()).find((entry) => entry.requestId === "run-1")).toBeUndefined();
  });
});
