import { describe, expect, it } from "bun:test";
import { RuntimeDependencyIds, RuntimeDependencyOperationalStates, RuntimeDependencyUnavailableError } from "../../../../application/runtime/RuntimeDependencyOrchestrator";
import { OrchestratedDatasetGenerationService } from "../OrchestratedDatasetGenerationService";

describe("OrchestratedDatasetGenerationService", () => {
  it("passes generation through when the dataset runtime gate is available", async () => {
    const delegateResult = Object.freeze({
      batchId: "batch-1",
      datasetId: "dataset-1",
      versionId: "version-1",
      taskType: "question_answering" as const,
      generatedAt: new Date("2026-03-23T00:00:00.000Z"),
      examples: Object.freeze([]),
      provenance: Object.freeze({
        provider: "python-runtime",
        generatorId: "generator",
        generatorVersion: "1.0.0",
        batchId: "batch-1",
        mode: "python-runtime-local" as const,
        executionKind: "python-runtime-local" as const,
        status: "completed" as const,
        path: "runtime",
        isFallback: false,
        isDegraded: false,
        parameters: Object.freeze({}),
        startedAt: new Date("2026-03-23T00:00:00.000Z"),
        executedAt: new Date("2026-03-23T00:00:01.000Z"),
        diagnostics: Object.freeze([]),
      }),
      generatedCount: 0,
      skippedCount: 0,
      status: "completed" as const,
    });

    const service = new OrchestratedDatasetGenerationService(
      {
        generate: async () => delegateResult,
      },
      {
        ensureAvailable: async () => ({
          requestedDependencyId: RuntimeDependencyIds.datasetGenerationRuntime,
          resolvedDependencyId: RuntimeDependencyIds.datasetGenerationRuntime,
          providerId: "dataset-generation-gate",
          state: RuntimeDependencyOperationalStates.healthy,
          health: "healthy",
          availability: "available",
          available: true,
          degraded: false,
          checkedAt: new Date().toISOString(),
          dependencyChain: [RuntimeDependencyIds.pythonRuntime, RuntimeDependencyIds.datasetGenerationRuntime],
          fallbackDependencyIds: [],
          usedFallback: false,
          remediationHints: [],
        }),
      } as never,
    );

    await expect(service.generate({
      datasetId: "dataset-1",
      versionId: "version-1",
      taskType: "question_answering",
      createdBy: "tester",
      sourceDocuments: [],
      existingExamples: [],
    })).resolves.toBe(delegateResult);
  });

  it("throws a runtime dependency error when the dataset runtime gate is unavailable", async () => {
    const service = new OrchestratedDatasetGenerationService(
      {
        generate: async () => {
          throw new Error("should not be called");
        },
      },
      {
        ensureAvailable: async () => ({
          requestedDependencyId: RuntimeDependencyIds.datasetGenerationRuntime,
          resolvedDependencyId: RuntimeDependencyIds.datasetGenerationRuntime,
          providerId: "dataset-generation-gate",
          state: RuntimeDependencyOperationalStates.starting,
          health: "degraded",
          availability: "degraded",
          available: false,
          degraded: false,
          checkedAt: new Date().toISOString(),
          dependencyChain: [RuntimeDependencyIds.pythonRuntime, RuntimeDependencyIds.datasetGenerationRuntime],
          fallbackDependencyIds: [],
          usedFallback: false,
          detail: "Dataset generation runtime is still starting.",
          remediationHints: ["Wait for the runtime to finish starting."],
        }),
      } as never,
    );

    await expect(service.generate({
      datasetId: "dataset-1",
      versionId: "version-1",
      taskType: "question_answering",
      createdBy: "tester",
      sourceDocuments: [],
      existingExamples: [],
    })).rejects.toBeInstanceOf(RuntimeDependencyUnavailableError);
  });
});
