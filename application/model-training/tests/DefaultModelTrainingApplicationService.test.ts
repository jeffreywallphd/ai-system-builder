import { describe, expect, it } from "bun:test";
import { DefaultModelTrainingApplicationService } from "../DefaultModelTrainingApplicationService";
import { Model, ModelArtifact, ModelSource } from "../../../domain/models/Model";
import { TuningDataset, TuningDatasetVersion } from "../../../domain/tuning-datasets/TuningDatasetEntities";

describe("DefaultModelTrainingApplicationService", () => {
  it("submits a fine-tuning job against an installed base model and dataset version", async () => {
    const model = new Model({
      id: "base-1",
      name: "Base One",
      kind: "completion-model",
      status: "installed",
      source: new ModelSource({ type: "local" }),
      artifact: new ModelArtifact({ name: "weights.gguf", accessMethod: "local-file", location: "/tmp/weights.gguf", format: "gguf" }),
    });
    const dataset = new TuningDataset({ id: "dataset-1", name: "Support QA", taskType: "question_answering", createdBy: "tester" });
    const version = new TuningDatasetVersion({ id: "version-1", datasetId: dataset.id, versionNumber: 1, status: "draft", kind: "initial_draft", createdBy: "tester", schema: { taskType: "question_answering", schemaVersion: "1.0", canonicalExampleType: "qa", requiredFields: ["question", "answer", "context"] } });
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
      } as never,
      {
        listJobs: async () => [],
        getJobById: async () => undefined,
        saveJob: async (job) => { saved.push(job); },
      },
      {
        submitJob: async (request) => ({
          id: request.id,
          name: request.name,
          backend: "python-runtime-manifest",
          baseModelId: request.baseModelId,
          datasetId: request.datasetId,
          datasetVersionId: request.datasetVersionId,
          createdBy: request.createdBy,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          updatedAt: new Date("2025-01-01T00:00:01.000Z"),
          submittedAt: new Date("2025-01-01T00:00:00.000Z"),
          startedAt: new Date("2025-01-01T00:00:00.500Z"),
          completedAt: new Date("2025-01-01T00:00:01.000Z"),
          status: "completed",
          configuration: request.configuration,
          diagnostics: [],
          artifacts: [],
          checkpoints: [],
          outputModelName: "Tuned model",
          summary: "done",
        }),
      },
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
});
