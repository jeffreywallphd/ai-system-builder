import { beforeEach, describe, expect, it } from "bun:test";
import type { IExecutionRunRecord } from "../../../../domain/execution/ExecutionRun";
import { ExecutionStatuses, ExecutionUnitKinds } from "../../../../domain/execution/ExecutionPlan";
import { LocalStorageExecutionRunRepository } from "../LocalStorageExecutionRunRepository";

function makeRun(overrides: Partial<IExecutionRunRecord> = {}): IExecutionRunRecord {
  return Object.freeze({
    runId: "run-1",
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
        updatedAt: "2026-01-01T00:00:01.000Z",
      }),
    }),
    transitions: Object.freeze([
      Object.freeze({
        unitId: "workflow:wf-1",
        toStatus: ExecutionStatuses.completed,
        occurredAt: "2026-01-01T00:00:01.000Z",
      }),
    ]),
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:01.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    cancellationSupported: true,
    metadata: Object.freeze({ executionKind: "workflow" }),
    ...overrides,
  });
}

describe("LocalStorageExecutionRunRepository", () => {
  const storage = new Map<string, string>();
  const storageLike = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };

  beforeEach(() => {
    storage.clear();
  });

  it("persists and reloads durable execution runs", async () => {
    const repository = new LocalStorageExecutionRunRepository("runs", storageLike);
    await repository.saveRun(makeRun());

    const loaded = await repository.getRunById("run-1");
    expect(loaded?.planId).toBe("plan-1");
    expect(loaded?.units["workflow:wf-1"]?.status).toBe(ExecutionStatuses.completed);
  });

  it("lists runs by newest first and filters by plan id", async () => {
    const repository = new LocalStorageExecutionRunRepository("runs", storageLike);
    await repository.saveRun(makeRun());
    await repository.saveRun(makeRun({
      runId: "run-2",
      planId: "plan-2",
      startedAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:01.000Z",
    }));

    const filtered = await repository.listRuns({ planId: "plan-1" });
    const listed = await repository.listRuns();

    expect(filtered.map((run) => run.runId)).toEqual(["run-1"]);
    expect(listed.map((run) => run.runId)).toEqual(["run-2", "run-1"]);
  });
});
