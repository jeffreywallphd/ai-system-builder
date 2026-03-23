import { describe, expect, it, mock } from "bun:test";
import { ModelTrainingStore } from "../ModelTrainingStore";

const baseJob: any = Object.freeze({
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

function makeSummary(job = baseJob) {
  return Object.freeze({
    runtimeMode: "desktop-development",
    runtimeStatus: "ready",
    runtimeHeadline: "Ready.",
    runtimeDetail: "The runtime is healthy.",
    capability: {
      state: "available",
      headline: "Ready.",
      summary: "Ready.",
      paths: [
        { path: "export-preparation-only", state: "available", title: "Export", summary: "Export", blockers: [], warnings: [] },
        { path: "local-training", state: "available", title: "Train", summary: "Train", blockers: [], warnings: [] },
      ],
      blockers: [],
      warnings: [],
      recommendedNextSteps: [],
    },
    availablePaths: ["export-preparation-only", "local-training"],
    selectedBaseModelId: "base",
    selectedDatasetId: "dataset",
    selectedDatasetVersionId: "version",
    baseModels: [{ id: "base", name: "Base", accessMethod: "local-file", isAvailable: true, supportsExportPreparation: true, supportsLocalTraining: true }],
    datasetVersions: [{ datasetId: "dataset", datasetName: "Dataset", versionId: "version", versionNumber: 1, versionLabel: "v1", taskType: "question_answering", supportsExportPreparation: true, supportsLocalTraining: true }],
    readinessChecks: [],
    availableActions: [],
    modeWarnings: [],
    recommendedNextSteps: [],
    jobs: [{
      job,
      userFacingStatus: "Running.",
      technicalSummary: "summary",
      promotion: { state: "unavailable", label: "N/A", detail: "Not ready." },
    }],
  });
}

describe("ModelTrainingStore", () => {
  it("refreshes the studio summary and submits jobs through the service layer", async () => {
    const calls: string[] = [];
    const store = new ModelTrainingStore({
      getStudioSummary: async () => {
        calls.push("summary");
        return makeSummary();
      },
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
      promoteJob: async () => ({ status: "registered", modelId: "trained-output:job-1:artifact-1", modelName: "Output", detail: "done" }),
    } as never, 1, 5);

    await store.refresh();
    await store.submitJob({
      name: "Job",
      baseModelId: "base",
      datasetId: "dataset",
      datasetVersionId: "version",
      createdBy: "tester",
      configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
    });

    expect(calls).toEqual(["summary", "submit", "summary"]);
    expect(store.getState().jobs[0]?.id).toBe("job-1");
    expect(store.getState().summary?.selectedBaseModelId).toBe("base");
  });

  it("refreshes, reconciles, cancels, and promotes specific jobs truthfully", async () => {
    const refreshJob = mock(async () => ({ ...baseJob, status: "running", progress: { percent: 50 } }));
    const reconcileJob = mock(async () => ({ ...baseJob, status: "reconciliation-needed", diagnostics: [{ code: "runtime_reconciliation_needed", level: "warning", message: "Need reconcile" }] }));
    const cancelJob = mock(async () => ({ ...baseJob, status: "cancelled" }));
    const promoteJob = mock(async () => ({ status: "registered", modelId: "trained-output:job-1:artifact-1", modelName: "Output", detail: "done" }));
    const store = new ModelTrainingStore({
      getStudioSummary: async () => makeSummary({ ...baseJob, status: "cancelled" }),
      listJobs: async () => [baseJob],
      submitJob: async () => baseJob,
      refreshJob,
      reconcileJob,
      cancelJob,
      promoteJob,
    } as never, 1, 5);

    await store.refresh();
    await store.refreshJob("job-1");
    await store.reconcileJob("job-1");
    await store.cancelJob("job-1");
    await store.promoteJob("job-1");

    expect(refreshJob).toHaveBeenCalledWith("job-1");
    expect(reconcileJob).toHaveBeenCalledWith("job-1");
    expect(cancelJob).toHaveBeenCalledWith("job-1");
    expect(promoteJob).toHaveBeenCalledWith({ jobId: "job-1" });
  });

  it("automatically polls active jobs until they become terminal or the poll budget is exhausted", async () => {
    const timers: Array<() => void> = [];
    const refreshJob = mock(async () => ({ ...baseJob, status: "completed", completedAt: new Date("2025-01-01T00:02:00.000Z") }));
    const store = new ModelTrainingStore({
      getStudioSummary: async () => makeSummary({ ...baseJob, status: refreshJob.mock.calls.length > 0 ? "completed" : "running" }),
      listJobs: async () => [baseJob],
      submitJob: async () => baseJob,
      refreshJob,
      reconcileJob: async () => undefined,
      cancelJob: async () => baseJob,
      promoteJob: async () => ({ status: "registered", modelId: "trained-output:job-1:artifact-1", modelName: "Output", detail: "done" }),
    } as never, 1, 2, {
      setTimeout(handler) {
        timers.push(handler);
        return timers.length as never;
      },
      clearTimeout() {},
    });

    const unsubscribe = store.subscribe(() => undefined);
    await store.refresh();
    expect(store.getState().pollingActive).toBeTrue();

    timers.shift()?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(refreshJob).toHaveBeenCalledWith("job-1");
    unsubscribe();
  });
});
