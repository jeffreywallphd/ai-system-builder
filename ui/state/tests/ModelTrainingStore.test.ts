import { describe, expect, it, mock } from "bun:test";
import { ModelTrainingStore } from "../ModelTrainingStore";

const baseJob = Object.freeze({
  id: "job-1",
  name: "Job",
  backend: "python-runtime-local",
  executionKind: "local-gradient-training",
  baseModelId: "base",
  datasetId: "dataset",
  datasetVersionId: "version",
  createdBy: "tester",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  submittedAt: new Date("2025-01-01T00:00:00.000Z"),
  status: "submitted",
  configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
  diagnostics: [],
  artifacts: [],
  checkpoints: [],
  provenance: {
    executionKind: "local-gradient-training",
    backend: "python-runtime-local",
    truthfulness: "real-execution",
    runtime: "python-runtime",
    runMode: "local-gradient-training",
    supportsGradientTraining: true,
    isPreparationOnly: false,
    provider: "python-runtime-local",
    modelIdentity: "Base",
    path: "/tmp/job-1",
    diagnostics: [],
  },
});

describe("ModelTrainingStore", () => {
  it("refreshes and submits jobs through the service layer", async () => {
    const calls: string[] = [];
    const store = new ModelTrainingStore({
      listJobs: async () => {
        calls.push("list");
        return [];
      },
      submitJob: async () => {
        calls.push("submit");
        return baseJob as never;
      },
      refreshJob: async () => undefined,
      reconcileJob: async () => undefined,
      cancelJob: async () => baseJob as never,
    } as never);

    await store.refresh();
    await store.submitJob({
      name: "Job",
      baseModelId: "base",
      datasetId: "dataset",
      datasetVersionId: "version",
      createdBy: "tester",
      configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
    });

    expect(calls).toEqual(["list", "submit"]);
    expect(store.getState().jobs[0]?.id).toBe("job-1");
  });

  it("refreshes, reconciles, and cancels specific jobs truthfully", async () => {
    const refreshJob = mock(async () => ({ ...baseJob, status: "running", progress: { percent: 50 } }));
    const reconcileJob = mock(async () => ({ ...baseJob, status: "reconciliation-needed", diagnostics: [{ code: "runtime_reconciliation_needed", level: "warning", message: "Need reconcile" }] }));
    const cancelJob = mock(async () => ({ ...baseJob, status: "cancelled" }));
    const store = new ModelTrainingStore({
      listJobs: async () => [baseJob],
      submitJob: async () => baseJob,
      refreshJob,
      reconcileJob,
      cancelJob,
    } as never);

    await store.refresh();
    await store.refreshJob("job-1");
    expect(store.getState().jobs[0]?.status).toBe("running");

    await store.reconcileJob("job-1");
    expect(store.getState().jobs[0]?.status).toBe("reconciliation-needed");

    await store.cancelJob("job-1");
    expect(store.getState().jobs[0]?.status).toBe("cancelled");
    expect(refreshJob).toHaveBeenCalledWith("job-1");
    expect(reconcileJob).toHaveBeenCalledWith("job-1");
    expect(cancelJob).toHaveBeenCalledWith("job-1");
  });
});
