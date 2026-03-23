import { describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExecutionStatuses, ExecutionUnitKinds } from "../../../../domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../../../domain/execution/ExecutionRun";
import { SqliteExecutionRunRepository } from "../SqliteExecutionRunRepository";

function makeRun(runId: string, overrides: Partial<IExecutionRunRecord> = {}): IExecutionRunRecord {
  return Object.freeze({
    runId,
    planId: `plan-${runId}`,
    status: ExecutionStatuses.completed,
    unitIds: Object.freeze(["unit-1"]),
    units: Object.freeze({
      "unit-1": Object.freeze({
        unitId: "unit-1",
        kind: ExecutionUnitKinds.modelPreparation,
        label: "Prepare bundle",
        dependsOn: Object.freeze([]),
        status: ExecutionStatuses.completed,
        updatedAt: `2026-03-2${runId === "run-1" ? "2" : "3"}T00:00:05.000Z`,
        outputSummary: Object.freeze({ headline: "Prepared bundle", detail: "Artifacts written." }),
      }),
    }),
    transitions: Object.freeze([]),
    startedAt: `2026-03-2${runId === "run-1" ? "2" : "3"}T00:00:00.000Z`,
    updatedAt: `2026-03-2${runId === "run-1" ? "2" : "3"}T00:00:05.000Z`,
    completedAt: `2026-03-2${runId === "run-1" ? "2" : "3"}T00:00:05.000Z`,
    cancellationSupported: true,
    metadata: Object.freeze({ executionKind: "model-preparation", baseModelId: "base-1", datasetVersionId: runId === "run-1" ? "v1" : "v2" }),
    terminalSummary: Object.freeze({ headline: "Prepared bundle", detail: "Artifacts written." }),
    ...overrides,
  });
}

describe("SqliteExecutionRunRepository", () => {
  it("persists queryable execution runs in SQLite for desktop-backed modes", async () => {
    const databasePath = path.join(tmpdir(), `loom-execution-runs-${Date.now()}.sqlite`);
    const repository = new SqliteExecutionRunRepository(databasePath);

    try {
      try {
        await repository.saveRun(makeRun("run-1"));
      } catch (error) {
        if (isSqliteRuntimeUnavailable(error)) {
          expect(String(error)).toContain("module");
          return;
        }
        throw error;
      }
      await repository.saveRun(makeRun("run-2", {
        status: ExecutionStatuses.failed,
        finalErrorMessage: "bundle failed",
        metadata: Object.freeze({ executionKind: "model-preparation", baseModelId: "base-1", datasetVersionId: "v2" }),
      }));

      const loaded = await repository.getRunById("run-1");
      const filtered = await repository.listRuns({
        executionKind: "model-preparation",
        status: ExecutionStatuses.failed,
        metadata: { datasetVersionId: "v2" },
      });

      expect(loaded?.terminalSummary?.headline).toBe("Prepared bundle");
      expect(filtered.map((run) => run.runId)).toEqual(["run-2"]);
      expect(filtered[0]?.finalErrorMessage).toBe("bundle failed");
    } finally {
      repository.dispose();
      rmSync(databasePath, { force: true });
      rmSync(`${databasePath}-wal`, { force: true });
      rmSync(`${databasePath}-shm`, { force: true });
    }
  });
});

function isSqliteRuntimeUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("NODE_MODULE_VERSION") || message.includes("napi_register_module_v1") || message.includes("native module");
}
