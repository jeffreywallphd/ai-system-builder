import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import { createExecutionRunRepository, createUnifiedExecutionInfrastructure } from "../createExecutionInfrastructure";
import { DesktopBridgeExecutionRunRepository } from "../../browser/execution/DesktopBridgeExecutionRunRepository";
import { SqliteExecutionRunRepository } from "../../filesystem/execution/SqliteExecutionRunRepository";

describe("execution infrastructure composition", () => {
  it("prefers the desktop execution-run bridge when available and otherwise uses SQLite/file fallbacks", () => {
    const bridgeRepository = createExecutionRunRepository({
      desktopExecutionRunBridge: {
        saveExecutionRun: async () => undefined,
        loadExecutionRun: async () => null,
        listExecutionRuns: async () => [],
      },
    });
    const sqlitePath = path.join(tmpdir(), `loom-execution-composition-${Date.now()}.sqlite`);
    const sqliteRepository = createExecutionRunRepository({ sqliteDatabasePath: sqlitePath });

    expect(bridgeRepository).toBeInstanceOf(DesktopBridgeExecutionRunRepository);
    expect(sqliteRepository).toBeInstanceOf(SqliteExecutionRunRepository);
    (sqliteRepository as SqliteExecutionRunRepository).dispose();
    rmSync(sqlitePath, { force: true });
    rmSync(`${sqlitePath}-wal`, { force: true });
    rmSync(`${sqlitePath}-shm`, { force: true });
  });

  it("builds a unified execution engine with model-preparation handlers when that runtime is enabled", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-execution-composition-"));
    const savedRuns: unknown[] = [];
    const repository = {
      saveRun: async (run: unknown) => { savedRuns.push(run); return run; },
      getRunById: async () => undefined,
      listRuns: async () => [],
    };
    const engine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => { throw new Error("workflow path not used"); },
        startExecution: async () => { throw new Error("workflow path not used"); },
      },
      executionRunRepository: repository,
      modelTrainingRuntime: {
        submitJob: async (request) => Object.freeze({
          id: request.id,
          name: request.name,
          backend: "python-runtime-manifest" as const,
          executionKind: "preparation-only" as const,
          baseModelId: request.baseModelId,
          datasetId: request.datasetId,
          datasetVersionId: request.datasetVersionId,
          createdBy: request.createdBy,
          createdAt: new Date("2026-03-23T00:00:00.000Z"),
          updatedAt: new Date("2026-03-23T00:00:01.000Z"),
          completedAt: new Date("2026-03-23T00:00:01.000Z"),
          status: "exported-without-training" as const,
          configuration: request.configuration,
          diagnostics: [],
          artifacts: [],
          checkpoints: [],
          summary: "Prepared a truthful bundle.",
          provenance: {
            executionKind: "preparation-only" as const,
            backend: "python-runtime-manifest" as const,
            truthfulness: "exported-without-training" as const,
            runtime: "python-runtime" as const,
            runMode: "preparation-only" as const,
            supportsGradientTraining: false,
            isPreparationOnly: true,
            path: root,
            diagnostics: [],
            detail: "Prepared a bundle without gradient training.",
          },
        }),
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => { throw new Error("not used"); },
      },
    });

    try {
      const result = await engine.execute({
        plan: new ExecutionPlan({
          id: "model-preparation:job-1",
          units: [{ id: "model-preparation:job-1", kind: ExecutionUnitKinds.modelPreparation, label: "Prepare bundle" }],
        }),
        unitInputs: {
          "model-preparation:job-1": {
            id: "job-1",
            name: "Prepare bundle",
            executionKind: "preparation-only",
            baseModelId: "base-1",
            baseModelName: "Base One",
            datasetId: "dataset-1",
            datasetName: "Support QA",
            datasetVersionId: "version-1",
            datasetVersionNumber: 1,
            datasetTaskType: "question_answering",
            createdBy: "tester",
            configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
            examples: [],
          },
        },
        metadata: { executionKind: "model-preparation", baseModelId: "base-1" },
      });

      expect(result.status).toBe(ExecutionStatuses.completed);
      expect(result.run.metadata?.executionKind).toBe("model-preparation");
      expect(result.run.units["model-preparation:job-1"]?.outputSummary?.headline).toContain("Prepared");
      expect(savedRuns.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
