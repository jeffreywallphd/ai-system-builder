import { describe, expect, it } from "bun:test";
import { ExecutionStatuses, ExecutionUnitKinds } from "../../../src/domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../../src/domain/execution/ExecutionRun";
import { ListExecutionRunsUseCase } from "../../../application/execution/ListExecutionRunsUseCase";
import { ExecutionRunProjectionService } from "../../../application/execution/ExecutionRunProjectionService";
import { ListRelatedExecutionRunsUseCase } from "../../../application/execution/ListRelatedExecutionRunsUseCase";
import { ExecutionHistoryService } from "../ExecutionHistoryService";

function makeRun(runId: string, flowId: string): IExecutionRunRecord {
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
    startedAt: runId === "run-1" ? "2026-03-24T00:00:00.000Z" : "2026-03-24T00:00:02.000Z",
    updatedAt: runId === "run-1" ? "2026-03-24T00:00:01.000Z" : "2026-03-24T00:00:03.000Z",
    completedAt: runId === "run-1" ? "2026-03-24T00:00:01.000Z" : "2026-03-24T00:00:03.000Z",
    cancellationSupported: true,
    metadata: Object.freeze({
      executionKind: "workflow",
      executionFlowId: flowId,
    }),
  });
}

describe("ExecutionHistoryService", () => {
  it("builds related-run clusters with an anchor run and newest-first ordering", async () => {
    const runs = [makeRun("run-1", "flow-1"), makeRun("run-2", "flow-1")];
    const repository = {
      saveRun: async (run: IExecutionRunRecord) => run,
      getRunById: async (runId: string) => runs.find((run) => run.runId === runId),
      listRuns: async (criteria?: { flowId?: string }) => criteria?.flowId === "flow-1" ? runs : [],
    };
    const service = new ExecutionHistoryService(
      new ListExecutionRunsUseCase(repository),
      new ExecutionRunProjectionService(),
      new ListRelatedExecutionRunsUseCase(repository),
    );

    const cluster = await service.getRelatedRunCluster("run-1");

    expect(cluster?.groupLabel).toContain("flow-1");
    expect(cluster?.runs[0]?.run.runId).toBe("run-2");
    expect(cluster?.runs.some((entry) => entry.isAnchor && entry.run.runId === "run-1")).toBe(true);
  });
});
