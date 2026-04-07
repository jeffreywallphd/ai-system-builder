import { describe, expect, it } from "bun:test";
import { ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import { ListRelatedExecutionRunsUseCase } from "../ListRelatedExecutionRunsUseCase";

function makeRun(runId: string, flowId?: string): IExecutionRunRecord {
  return Object.freeze({
    runId,
    planId: "plan-1",
    status: ExecutionStatuses.completed,
    unitIds: Object.freeze(["unit-1"]),
    units: Object.freeze({
      "unit-1": Object.freeze({
        unitId: "unit-1",
        kind: ExecutionUnitKinds.workflow,
        dependsOn: Object.freeze([]),
        status: ExecutionStatuses.completed,
        updatedAt: "2026-03-24T00:00:01.000Z",
      }),
    }),
    transitions: Object.freeze([]),
    startedAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:01.000Z",
    completedAt: "2026-03-24T00:00:01.000Z",
    cancellationSupported: true,
    metadata: Object.freeze({
      executionKind: "workflow",
      ...(flowId ? { executionFlowId: flowId } : {}),
    }),
  });
}

describe("ListRelatedExecutionRunsUseCase", () => {
  it("prefers flow-based related-run lookup when a flow id exists", async () => {
    const useCase = new ListRelatedExecutionRunsUseCase({
      saveRun: async (run) => run,
      getRunById: async () => makeRun("run-1", "flow-1"),
      listRuns: async (criteria) => criteria?.flowId === "flow-1" ? [makeRun("run-1", "flow-1"), makeRun("run-2", "flow-1")] : [],
    });

    const related = await useCase.execute({ runId: "run-1" });
    expect(related.map((run) => run.runId)).toEqual(["run-1", "run-2"]);
  });

  it("falls back to plan-based related-run lookup when no flow id is present", async () => {
    const useCase = new ListRelatedExecutionRunsUseCase({
      saveRun: async (run) => run,
      getRunById: async () => makeRun("run-1"),
      listRuns: async (criteria) => criteria?.planId === "plan-1" ? [makeRun("run-1"), makeRun("run-3")] : [],
    });

    const related = await useCase.execute({ runId: "run-1" });
    expect(related.map((run) => run.runId)).toEqual(["run-1", "run-3"]);
  });
});
