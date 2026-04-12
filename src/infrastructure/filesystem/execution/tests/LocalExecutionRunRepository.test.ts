import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExecutionStatuses, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";
import { LocalFileStorage } from "../../LocalFileStorage";
import { LocalExecutionRunRepository } from "../LocalExecutionRunRepository";

function makeRun(runId: string, flowId?: string): IExecutionRunRecord {
  return Object.freeze({
    runId,
    planId: "plan-1",
    status: ExecutionStatuses.completed,
    unitIds: Object.freeze(["workflow:wf-1"]),
    units: Object.freeze({
      "workflow:wf-1": Object.freeze({
        unitId: "workflow:wf-1",
        kind: ExecutionUnitKinds.workflow,
        label: "Workflow",
        dependsOn: Object.freeze([]),
        status: ExecutionStatuses.completed,
        updatedAt: `2026-01-0${runId === "run-1" ? "1" : "2"}T00:00:01.000Z`,
      }),
    }),
    transitions: Object.freeze([
      Object.freeze({
        unitId: "workflow:wf-1",
        toStatus: ExecutionStatuses.completed,
        occurredAt: `2026-01-0${runId === "run-1" ? "1" : "2"}T00:00:01.000Z`,
      }),
    ]),
    startedAt: `2026-01-0${runId === "run-1" ? "1" : "2"}T00:00:00.000Z`,
    updatedAt: `2026-01-0${runId === "run-1" ? "1" : "2"}T00:00:01.000Z`,
    completedAt: `2026-01-0${runId === "run-1" ? "1" : "2"}T00:00:01.000Z`,
    cancellationSupported: true,
    metadata: Object.freeze({
      executionKind: runId === "run-1" ? "workflow" : "model-training",
      ...(flowId ? { executionFlowId: flowId } : {}),
      supportsMultiUnitComposition: runId !== "run-1",
    }),
  });
}

describe("LocalExecutionRunRepository", () => {
  it("saves, loads, and lists persisted execution runs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-execution-runs-"));
    try {
      const repository = new LocalExecutionRunRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
      });

      await repository.saveRun(makeRun("run-1", "flow-1"));
      await repository.saveRun(makeRun("run-2", "flow-2"));

      expect((await repository.getRunById("run-1"))?.planId).toBe("plan-1");
      expect((await repository.listRuns()).map((run) => run.runId)).toEqual(["run-2", "run-1"]);
      const filtered = await repository.listRuns({
        executionKind: "model-training",
        flowId: "flow-2",
        unitKind: ExecutionUnitKinds.workflow,
      });
      expect(filtered.map((run) => run.runId)).toEqual(["run-2"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

