import { describe, expect, it } from "bun:test";
import { ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import { GetExecutionRunUseCase } from "../GetExecutionRunUseCase";
import { ListExecutionRunsUseCase } from "../ListExecutionRunsUseCase";

function makeRun(overrides: Partial<IExecutionRunRecord> = {}): IExecutionRunRecord {
  return Object.freeze({
    runId: "run-1",
    planId: "workflow-run:wf-1",
    status: ExecutionStatuses.completed,
    unitIds: Object.freeze(["workflow:wf-1"]),
    units: Object.freeze({
      "workflow:wf-1": Object.freeze({
        unitId: "workflow:wf-1",
        kind: ExecutionUnitKinds.workflow,
        dependsOn: Object.freeze([]),
        status: ExecutionStatuses.completed,
        updatedAt: "2026-03-23T00:00:01.000Z",
      }),
    }),
    transitions: Object.freeze([]),
    startedAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:01.000Z",
    completedAt: "2026-03-23T00:00:01.000Z",
    cancellationSupported: true,
    metadata: Object.freeze({ executionKind: "workflow", workflowId: "wf-1" }),
    ...overrides,
  });
}

describe("Execution run query use cases", () => {
  it("loads a single execution run by id", async () => {
    const runs = new Map([["run-1", makeRun()]]);
    const useCase = new GetExecutionRunUseCase({
      saveRun: async (run) => run,
      getRunById: async (runId) => runs.get(runId),
      listRuns: async () => [...runs.values()],
    });

    const result = await useCase.execute("run-1");

    expect(result?.metadata?.workflowId).toBe("wf-1");
  });

  it("lists and filters execution runs by status, execution kind, and metadata", async () => {
    const runs = Object.freeze([
      makeRun(),
      makeRun({
        runId: "run-2",
        planId: "dataset-generation:dataset-1:v2",
        status: ExecutionStatuses.failed,
        metadata: Object.freeze({ executionKind: "dataset-generation", datasetId: "dataset-1", versionId: "v2" }),
      }),
    ]);
    const useCase = new ListExecutionRunsUseCase({
      saveRun: async (run) => run,
      getRunById: async () => undefined,
      listRuns: async () => runs,
    });

    const result = await useCase.execute({
      executionKind: "dataset-generation",
      status: ExecutionStatuses.failed,
      metadata: { datasetId: "dataset-1" },
    });

    expect(result.map((run) => run.runId)).toEqual(["run-2"]);
  });
});
