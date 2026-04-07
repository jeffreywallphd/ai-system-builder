import { describe, expect, it, mock } from "bun:test";
import { DefaultModelTrainingApplicationService } from "../DefaultModelTrainingApplicationService";
import { Model, ModelArtifact, ModelSource } from "@domain/models/Model";
import { ExampleLineage, QuestionAnsweringExample, TuningDataset, TuningDatasetVersion } from "@domain/tuning-datasets/TuningDatasetEntities";
import { AppRuntimeModes } from "@domain/runtime/AppRuntimeMode";
import { createUnifiedExecutionInfrastructure } from "@infrastructure/execution/createExecutionInfrastructure";
import type { ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";

function makeModel(params: { id?: string; accessMethod?: "local-file" | "remote-download" } = {}) {
  return new Model({
    id: params.id ?? "base-1",
    name: "Base One",
    kind: "completion-model",
    status: "installed",
    source: new ModelSource({ type: "local" }),
    artifact: new ModelArtifact({
      name: "weights.gguf",
      accessMethod: params.accessMethod ?? "local-file",
      location: params.accessMethod === "remote-download" ? undefined : "/tmp/weights.gguf",
      format: "gguf",
    }),
  });
}

function makeDataset(taskType: "question_answering" | "classification" = "question_answering") {
  return new TuningDataset({ id: "dataset-1", name: "Support QA", taskType, createdBy: "tester" });
}

function makeVersion(datasetId: string) {
  return new TuningDatasetVersion({
    id: "version-1",
    datasetId,
    versionNumber: 1,
    status: "draft",
    kind: "initial_draft",
    createdBy: "tester",
    schema: { taskType: "question_answering", schemaVersion: "1.0", canonicalExampleType: "qa", requiredFields: ["question", "answer", "context"] },
  });
}

function makeExample(datasetId: string, versionId: string) {
  return new QuestionAnsweringExample({
    id: "qa-1",
    datasetId,
    versionId,
    question: "What is AI Loom Studio?",
    answer: "A workflow studio.",
    context: "AI Loom Studio is a workflow studio.",
    createdBy: "tester",
    lineage: new ExampleLineage({ generationMethod: "manual-authoring" }),
  });
}

function makeJob(overrides: Partial<ModelTrainingJob> = {}) {
  return Object.freeze({
    id: "training-job-1",
    name: "Support fine-tune",
    backend: "python-runtime-local" as const,
    executionKind: "local-gradient-training" as const,
    baseModelId: "base-1",
    datasetId: "dataset-1",
    datasetVersionId: "version-1",
    createdBy: "tester",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:01.000Z"),
    submittedAt: new Date("2025-01-01T00:00:00.000Z"),
    startedAt: new Date("2025-01-01T00:00:05.000Z"),
    completedAt: new Date("2025-01-01T00:05:00.000Z"),
    status: "completed" as const,
    configuration: { epochs: 2, learningRate: 0.0001, batchSize: 1 },
    diagnostics: [],
    artifacts: [
      {
        id: "artifact-1",
        kind: "trained-model" as const,
        label: "adapter.safetensors",
        location: "/tmp/adapter.safetensors",
        contentType: "application/octet-stream",
        createdAt: new Date("2025-01-01T00:05:00.000Z"),
      },
    ],
    checkpoints: [],
    outputModelName: "Support Adapter",
    summary: "completed",
    progress: { percent: 100, currentEpoch: 2, totalEpochs: 2 },
    provenance: {
      executionKind: "local-gradient-training" as const,
      backend: "python-runtime-local" as const,
      truthfulness: "real-execution" as const,
      runtime: "python-runtime" as const,
      runMode: "local-gradient-training" as const,
      supportsGradientTraining: true,
      isPreparationOnly: false,
      provider: "python-runtime-local",
      modelIdentity: "Base One",
      path: "/tmp/training-job-1",
      diagnostics: [],
    },
    ...overrides,
  });
}

describe("DefaultModelTrainingApplicationService", () => {
  it("submits a truthful local training job against an installed base model and dataset version", async () => {
    const model = makeModel();
    const dataset = makeDataset();
    const version = makeVersion(dataset.id);
    const example = makeExample(dataset.id, version.id);
    const saved: unknown[] = [];

    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async (id: string) => id === model.id ? model : undefined,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [dataset],
        load: async () => dataset,
        save: async () => dataset,
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => version,
        listVersions: async () => [version],
        listExamples: async () => [example],
      } as never,
      {
        listJobs: async () => [],
        getJobById: async () => undefined,
        saveJob: async (job) => { saved.push(job); },
      },
      {
        submitJob: async (request) => ({ ...makeJob(), id: request.id, name: request.name, executionKind: request.executionKind, configuration: request.configuration, status: "submitted", completedAt: undefined }),
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => { throw new Error("not implemented"); },
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.desktopDevelopment,
          runtimeStatus: "ready",
          desktopBridgeAvailable: true,
          canAccessLocalArtifacts: true,
          canRegisterPromotedModels: true,
        }),
      },
      undefined,
      undefined,
      () => "training-job-1",
    );

    const job = await service.submitJob({
      name: "Support fine-tune",
      baseModelId: model.id,
      datasetId: dataset.id,
      datasetVersionId: version.id,
      createdBy: "tester",
      configuration: { epochs: 2, learningRate: 0.0001, batchSize: 1 },
    });

    expect(job.id).toBe("training-job-1");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(job);
  });

  it("routes preparation-only model creation through the unified execution engine", async () => {
    const model = makeModel();
    const dataset = makeDataset();
    const version = makeVersion(dataset.id);
    const example = makeExample(dataset.id, version.id);
    const submitJob = mock(async () => ({
      ...makeJob({
        executionKind: "preparation-only" as const,
        backend: "python-runtime-manifest" as const,
        status: "exported-without-training" as const,
        summary: "Prepared bundle without training.",
        provenance: {
          executionKind: "preparation-only" as const,
          backend: "python-runtime-manifest" as const,
          truthfulness: "exported-without-training" as const,
          runtime: "python-runtime" as const,
          runMode: "preparation-only" as const,
          supportsGradientTraining: false,
          isPreparationOnly: true,
          path: "/tmp/training-job-prepare",
          diagnostics: [],
          detail: "Prepared a truthful bundle without gradient training.",
        },
      }),
    }));

    const engine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => { throw new Error("workflow path not used"); },
        startExecution: async () => { throw new Error("workflow path not used"); },
      },
      modelTrainingRuntime: {
        submitJob,
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => { throw new Error("not used"); },
      },
    });

    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [dataset],
        load: async () => dataset,
        save: async () => dataset,
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => version,
        listVersions: async () => [version],
        listExamples: async () => [example],
      } as never,
      {
        listJobs: async () => [],
        getJobById: async () => undefined,
        saveJob: async () => undefined,
      },
      {
        submitJob,
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => { throw new Error("not used"); },
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.desktopDevelopment,
          runtimeStatus: "ready",
          desktopBridgeAvailable: true,
          canAccessLocalArtifacts: true,
          canRegisterPromotedModels: true,
        }),
      },
      undefined,
      engine,
      () => "training-job-prepare",
    );

    const job = await service.submitJob({
      name: "Support export bundle",
      baseModelId: model.id,
      datasetId: dataset.id,
      datasetVersionId: version.id,
      createdBy: "tester",
      executionKind: "preparation-only",
      configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
    });

    expect(job.executionKind).toBe("preparation-only");
    expect(job.status).toBe("exported-without-training");
    expect(submitJob).toHaveBeenCalledTimes(1);
  });

  it("builds a truthful studio summary for browser fallback mode", async () => {
    const model = makeModel({ accessMethod: "remote-download" });
    const dataset = makeDataset();
    const version = makeVersion(dataset.id);
    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [dataset],
        load: async () => dataset,
        save: async () => dataset,
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => version,
        listVersions: async () => [version],
        listExamples: async () => [makeExample(dataset.id, version.id)],
      } as never,
      {
        listJobs: async () => [],
        getJobById: async () => undefined,
        saveJob: async () => undefined,
      },
      {
        submitJob: async () => makeJob(),
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => makeJob(),
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.browserDevelopment,
          runtimeStatus: "ready",
          desktopBridgeAvailable: false,
          canAccessLocalArtifacts: false,
          canRegisterPromotedModels: false,
          runtimeDetail: "Runtime is healthy.",
        }),
      },
    );

    const summary = await service.getStudioSummary({ selectedBaseModelId: model.id, selectedDatasetId: dataset.id, selectedDatasetVersionId: version.id });

    expect(summary.capability.paths.find((entry) => entry.path === "export-preparation-only")?.state).toBe("available");
    expect(summary.capability.paths.find((entry) => entry.path === "local-training")?.state).toBe("unavailable");
    expect(summary.modeWarnings.join(" ")).toContain("Browser fallback mode");
  });

  it("shows disabled runtime gating in the studio summary", async () => {
    const model = makeModel();
    const dataset = makeDataset();
    const version = makeVersion(dataset.id);
    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [dataset],
        load: async () => dataset,
        save: async () => dataset,
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => version,
        listVersions: async () => [version],
        listExamples: async () => [makeExample(dataset.id, version.id)],
      } as never,
      {
        listJobs: async () => [],
        getJobById: async () => undefined,
        saveJob: async () => undefined,
      },
      {
        submitJob: async () => makeJob(),
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => makeJob(),
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.desktopProduction,
          runtimeStatus: "disabled",
          runtimeDetail: "Python runtime is disabled in Settings.",
          desktopBridgeAvailable: true,
          canAccessLocalArtifacts: true,
          canRegisterPromotedModels: true,
        }),
      },
    );

    const summary = await service.getStudioSummary({ selectedBaseModelId: model.id, selectedDatasetId: dataset.id, selectedDatasetVersionId: version.id });

    expect(summary.capability.state).toBe("unavailable");
    expect(summary.runtimeDetail).toContain("disabled");
  });

  it("surfaces runtime remediation hints in readiness and warning diagnostics", async () => {
    const model = makeModel();
    const dataset = makeDataset();
    const version = makeVersion(dataset.id);
    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [dataset],
        load: async () => dataset,
        save: async () => dataset,
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => version,
        listVersions: async () => [version],
        listExamples: async () => [makeExample(dataset.id, version.id)],
      } as never,
      {
        listJobs: async () => [],
        getJobById: async () => undefined,
        saveJob: async () => undefined,
      },
      {
        submitJob: async () => makeJob(),
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => makeJob(),
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.desktopDevelopment,
          runtimeStatus: "degraded",
          runtimeDetail: "Model training runtime is starting.",
          runtimeRemediationHints: ["Wait for the runtime to finish starting."],
          desktopBridgeAvailable: true,
          canAccessLocalArtifacts: true,
          canRegisterPromotedModels: true,
        }),
      },
    );

    const summary = await service.getStudioSummary({ selectedBaseModelId: model.id, selectedDatasetId: dataset.id, selectedDatasetVersionId: version.id });

    expect(summary.readinessChecks.find((entry) => entry.id === "runtime")?.detail).toContain("Wait for the runtime to finish starting.");
    expect(summary.modeWarnings).toContain("Wait for the runtime to finish starting.");
  });

  it("registers a completed training output when promotion is supported", async () => {
    const model = makeModel();
    const job = makeJob();
    const saveInstalled = mock(async () => undefined);
    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [],
        load: async () => undefined,
        save: async () => { throw new Error("not used"); },
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => undefined,
        listVersions: async () => [],
        listExamples: async () => [],
      } as never,
      {
        listJobs: async () => [job],
        getJobById: async () => job,
        saveJob: async () => undefined,
      },
      {
        submitJob: async () => job,
        getJob: async () => job,
        refreshJob: async () => job,
        reconcileJob: async () => job,
        listJobs: async () => [job],
        cancelJob: async () => job,
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.desktopDevelopment,
          runtimeStatus: "ready",
          desktopBridgeAvailable: true,
          canAccessLocalArtifacts: true,
          canRegisterPromotedModels: true,
        }),
      },
      {
        exists: async () => true,
      } as never,
    );

    const result = await service.promoteJob({ jobId: job.id });

    expect(result.status).toBe("registered");
    expect(result.modelName).toBe("Support Adapter");
    expect(saveInstalled).toHaveBeenCalled();
  });

  it("keeps promotion unavailable in unsupported modes", async () => {
    const model = makeModel();
    const job = makeJob();
    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [],
        load: async () => undefined,
        save: async () => { throw new Error("not used"); },
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => undefined,
        listVersions: async () => [],
        listExamples: async () => [],
      } as never,
      {
        listJobs: async () => [job],
        getJobById: async () => job,
        saveJob: async () => undefined,
      },
      {
        submitJob: async () => job,
        getJob: async () => job,
        refreshJob: async () => job,
        reconcileJob: async () => job,
        listJobs: async () => [job],
        cancelJob: async () => job,
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.browserDevelopment,
          runtimeStatus: "ready",
          desktopBridgeAvailable: false,
          canAccessLocalArtifacts: false,
          canRegisterPromotedModels: false,
        }),
      },
    );

    await expect(service.promoteJob({ jobId: job.id })).rejects.toThrow("cannot register completed training outputs");
  });

  it("starts truthful local training through the unified execution engine and saves background job updates", async () => {
    const model = makeModel();
    const dataset = makeDataset();
    const version = makeVersion(dataset.id);
    const example = makeExample(dataset.id, version.id);
    const saved: ModelTrainingJob[] = [];
    let refreshCount = 0;
    const submittedJob = makeJob({
      id: "training-job-engine",
      status: "submitted",
      completedAt: undefined,
      progress: { percent: 0, currentEpoch: 0, totalEpochs: 2, currentStep: 0, totalSteps: 2, statusDetail: "Submitted." },
      summary: "Submitted a real local training job.",
    });
    const completedJob = makeJob({
      id: "training-job-engine",
      summary: "Completed a real local training run.",
    });

    const engineSubmitRequests: string[] = [];
    const engine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => { throw new Error("workflow path not used"); },
        startExecution: async () => { throw new Error("workflow path not used"); },
      },
      modelTrainingRuntime: {
        submitJob: async (request) => {
          engineSubmitRequests.push(`${request.id}:${request.executionKind}`);
          return request.executionKind === "preparation-only"
            ? makeJob({
              id: request.id,
              executionKind: "preparation-only",
              status: "exported-without-training",
              summary: "Prepared bundle without training.",
              provenance: {
                executionKind: "preparation-only",
                backend: "python-runtime-manifest",
                truthfulness: "exported-without-training",
                runtime: "python-runtime",
                runMode: "preparation-only",
                supportsGradientTraining: false,
                isPreparationOnly: true,
                path: `/tmp/${request.id}`,
                diagnostics: [],
              },
            })
            : submittedJob;
        },
        getJob: async (jobId) => jobId === submittedJob.id ? submittedJob : undefined,
        refreshJob: async () => {
          refreshCount += 1;
          return refreshCount >= 1 ? completedJob : submittedJob;
        },
        reconcileJob: async () => completedJob,
        listJobs: async () => [],
        cancelJob: async () => ({ ...submittedJob, status: "cancelled" }),
      },
    });

    const service = new DefaultModelTrainingApplicationService(
      {
        listInstalled: async () => [model],
        getInstalledById: async () => model,
        saveInstalled: async () => undefined,
        removeInstalled: async () => true,
        isInstalled: async () => true,
      },
      {
        list: async () => [dataset],
        load: async () => dataset,
        save: async () => dataset,
        delete: async () => undefined,
      } as never,
      {
        loadVersion: async () => version,
        listVersions: async () => [version],
        listExamples: async () => [example],
      } as never,
      {
        listJobs: async () => saved,
        getJobById: async (id) => saved.find((job) => job.id === id),
        saveJob: async (job) => {
          const existingIndex = saved.findIndex((entry) => entry.id === job.id);
          if (existingIndex >= 0) {
            saved[existingIndex] = job;
          } else {
            saved.push(job);
          }
        },
      },
      {
        submitJob: async () => submittedJob,
        getJob: async (jobId) => jobId === submittedJob.id ? submittedJob : undefined,
        refreshJob: async () => completedJob,
        reconcileJob: async () => completedJob,
        listJobs: async () => [],
        cancelJob: async () => ({ ...submittedJob, status: "cancelled" }),
      },
      {
        getEnvironment: async () => ({
          runtimeMode: AppRuntimeModes.desktopDevelopment,
          runtimeStatus: "ready",
          desktopBridgeAvailable: true,
          canAccessLocalArtifacts: true,
          canRegisterPromotedModels: true,
        }),
      },
      undefined,
      engine,
      () => "training-job-engine",
    );

    const job = await service.submitJob({
      name: "Support local training",
      baseModelId: model.id,
      datasetId: dataset.id,
      datasetVersionId: version.id,
      createdBy: "tester",
      configuration: { epochs: 2, learningRate: 0.0001, batchSize: 1 },
    });

    expect(job.status).toBe("submitted");

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(engineSubmitRequests).toEqual([
      "training-job-engine:preflight:preparation-only",
      "training-job-engine:local-gradient-training",
    ]);
    expect(saved.some((entry) => entry.status === "completed")).toBe(true);
  });
});

