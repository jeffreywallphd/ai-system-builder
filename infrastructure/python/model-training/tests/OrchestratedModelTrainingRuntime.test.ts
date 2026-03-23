import { describe, expect, it, mock } from "bun:test";
import { RuntimeDependencyIds, RuntimeDependencyOperationalStates, RuntimeDependencyUnavailableError } from "../../../../application/runtime/RuntimeDependencyOrchestrator";
import { OrchestratedModelTrainingRuntime } from "../OrchestratedModelTrainingRuntime";

describe("OrchestratedModelTrainingRuntime", () => {
  it("blocks model training submission when the runtime dependency is unavailable", async () => {
    const delegate = {
      submitJob: mock(async () => { throw new Error("unused"); }),
      getJob: async () => undefined,
      refreshJob: async () => undefined,
      reconcileJob: async () => undefined,
      listJobs: async () => [],
      cancelJob: async () => { throw new Error("unused"); },
    };
    const runtime = new OrchestratedModelTrainingRuntime(delegate, {
      ensureAvailable: async (dependencyId) => ({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: "model-training-test",
        state: RuntimeDependencyOperationalStates.failed,
        health: "unavailable",
        availability: "unavailable",
        available: false,
        degraded: false,
        checkedAt: new Date().toISOString(),
        dependencyChain: [RuntimeDependencyIds.pythonRuntime, RuntimeDependencyIds.modelTrainingRuntime],
        fallbackDependencyIds: [],
        usedFallback: false,
        detail: "Model training runtime failed to start.",
        remediationHints: ["Restart the Python runtime."],
      }),
      refresh: async () => { throw new Error("unused"); },
      invalidate: () => undefined,
      invalidateAll: () => undefined,
      listRegistrations: () => [],
    });

    await expect(runtime.submitJob({
      id: "job-1",
      name: "Test job",
      executionKind: "local-training",
      baseModelId: "base-model",
      baseModelName: "Base model",
      datasetId: "dataset-1",
      datasetName: "Dataset",
      datasetVersionId: "version-1",
      datasetVersionNumber: 1,
      datasetTaskType: "chat_completion",
      createdBy: "tester",
      configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
      examples: [],
    })).rejects.toBeInstanceOf(RuntimeDependencyUnavailableError);
    expect(delegate.submitJob).not.toHaveBeenCalled();
  });
});
