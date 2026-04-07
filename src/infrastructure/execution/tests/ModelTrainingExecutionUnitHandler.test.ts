import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../src/domain/execution/ExecutionPlan";
import { ModelTrainingExecutionUnitHandler } from "../ModelTrainingExecutionUnitHandler";

describe("ModelTrainingExecutionUnitHandler", () => {
  it("records model-training artifacts through the asset lineage recorder", async () => {
    const recorderCalls: unknown[] = [];
    let refreshCount = 0;
    const handler = new ModelTrainingExecutionUnitHandler({
      submitJob: async (request) => ({
        id: request.id,
        name: request.name,
        backend: "python-runtime-local",
        executionKind: "local-gradient-training",
        baseModelId: request.baseModelId,
        datasetId: request.datasetId,
        datasetVersionId: request.datasetVersionId,
        createdBy: request.createdBy,
        createdAt: new Date("2026-03-24T00:00:00.000Z"),
        updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        status: "submitted",
        configuration: request.configuration,
        diagnostics: [],
        artifacts: [{
          id: "artifact-1",
          kind: "trained-model",
          label: "Adapter",
          location: "/tmp/model.gguf",
          createdAt: new Date("2026-03-24T00:00:00.000Z"),
        }],
        checkpoints: [],
        provenance: {
          executionKind: "local-gradient-training",
          backend: "python-runtime-local",
          truthfulness: "real-execution",
          runtime: "python-runtime",
          runMode: "local-gradient-training",
          supportsGradientTraining: true,
          isPreparationOnly: false,
          path: "/tmp/job-1",
          diagnostics: [],
        },
      }),
      getJob: async () => undefined,
      refreshJob: async (jobId) => {
        refreshCount += 1;
        return {
          id: jobId,
          name: "Train adapter",
          backend: "python-runtime-local",
          executionKind: "local-gradient-training",
          baseModelId: "base-1",
          datasetId: "dataset-1",
          datasetVersionId: "version-1",
          createdBy: "tester",
          createdAt: new Date("2026-03-24T00:00:00.000Z"),
          updatedAt: new Date("2026-03-24T00:00:01.000Z"),
          completedAt: new Date("2026-03-24T00:00:01.000Z"),
          status: "completed",
          configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
          diagnostics: [],
          artifacts: [{
            id: "artifact-1",
            kind: "trained-model",
            label: "Adapter",
            location: "/tmp/model.gguf",
            createdAt: new Date("2026-03-24T00:00:01.000Z"),
          }],
          checkpoints: [],
          provenance: {
            executionKind: "local-gradient-training",
            backend: "python-runtime-local",
            truthfulness: "real-execution",
            runtime: "python-runtime",
            runMode: "local-gradient-training",
            supportsGradientTraining: true,
            isPreparationOnly: false,
            path: "/tmp/job-1",
            diagnostics: [],
          },
        };
      },
      reconcileJob: async () => undefined,
      listJobs: async () => [],
      cancelJob: async () => {
        throw new Error("not used");
      },
    } as any, {
      recordModelTraining: async (payload: unknown) => {
        recorderCalls.push(payload);
      },
    } as any, 1);

    const result = await handler.execute({
      plan: new ExecutionPlan({
        id: "model-training:job-1",
        units: [{ id: "model-training:job-1", kind: ExecutionUnitKinds.modelTraining }],
      }),
      runId: "run-1",
      unit: { id: "model-training:job-1", kind: ExecutionUnitKinds.modelTraining, dependsOn: [] },
      unitInputs: {
        "model-training:job-1": {
          id: "job-1",
          name: "Train adapter",
          executionKind: "local-gradient-training",
          baseModelId: "base-1",
          baseModelName: "Base One",
          datasetId: "dataset-1",
          datasetName: "Dataset One",
          datasetVersionId: "version-1",
          datasetVersionNumber: 1,
          datasetTaskType: "question_answering",
          createdBy: "tester",
          configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
          examples: [],
        },
      },
    });

    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(refreshCount).toBeGreaterThan(0);
    expect(recorderCalls).toHaveLength(1);
  });
});
