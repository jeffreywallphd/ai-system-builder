import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import { DatasetGenerationExecutionUnitHandler } from "../DatasetGenerationExecutionUnitHandler";

describe("DatasetGenerationExecutionUnitHandler", () => {
  it("maps dataset generation results into execution-native results and preserves provenance", async () => {
    const recorderCalls: Array<{ request: unknown; result: unknown }> = [];
    const handler = new DatasetGenerationExecutionUnitHandler({
      generate: async () => ({
        batchId: "batch-1",
        datasetId: "dataset-1",
        versionId: "version-1",
        taskType: "question_answering",
        generatedAt: new Date("2026-03-23T00:00:00.000Z"),
        examples: [],
        generatedCount: 2,
        skippedCount: 0,
        status: "completed",
        provenance: {
          provider: "python-runtime",
          generatorId: "dataset-gen-runtime",
          generatorVersion: "1.0.0",
          batchId: "batch-1",
          mode: "python-runtime-local",
          executionKind: "python-runtime-local",
          status: "completed",
          path: "runtime-local",
          isFallback: false,
          isDegraded: false,
          parameters: {},
          startedAt: new Date("2026-03-23T00:00:00.000Z"),
          executedAt: new Date("2026-03-23T00:00:01.000Z"),
          diagnostics: [],
        },
      }),
    }, {
      recordDatasetGeneration: async (payload: { request: unknown; result: unknown }) => {
        recorderCalls.push(payload);
      },
    } as any);

    const result = await handler.execute({
      plan: new ExecutionPlan({
        id: "dataset-generation:dataset-1:version-1",
        units: [{ id: "dataset-generation:dataset-1:version-1", kind: ExecutionUnitKinds.datasetGeneration }],
      }),
      runId: "run-1",
      unit: { id: "dataset-generation:dataset-1:version-1", kind: ExecutionUnitKinds.datasetGeneration, dependsOn: [] },
      unitInputs: {
        "dataset-generation:dataset-1:version-1": {
          datasetId: "dataset-1",
          versionId: "version-1",
          taskType: "question_answering",
          createdBy: "tester",
          sourceDocuments: [],
          existingExamples: [],
        },
      },
    });

    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(result.provenance?.classification).toBe("delegated");
    expect(result.outputMetadata?.batchId).toBe("batch-1");
    expect(result.artifacts?.[0]?.kind).toBe("dataset-generation-result");
    expect(recorderCalls).toHaveLength(1);
  });
});

