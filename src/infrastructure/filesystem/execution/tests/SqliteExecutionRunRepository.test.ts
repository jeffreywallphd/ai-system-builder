import { describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
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
        metadata: Object.freeze({ executionKind: "model-preparation", baseModelId: "base-1", datasetVersionId: "v2", executionFlowId: "flow-2" }),
        units: Object.freeze({
          "unit-1": Object.freeze({
            unitId: "unit-1",
            kind: ExecutionUnitKinds.modelPreparation,
            label: "Prepare bundle",
            dependsOn: Object.freeze([]),
            status: ExecutionStatuses.failed,
            provenance: Object.freeze({
              classification: "delegated",
              executorId: "model-runtime",
            }),
            updatedAt: "2026-03-23T00:00:05.000Z",
          }),
        }),
      }));

      const loaded = await repository.getRunById("run-1");
      const filtered = await repository.listRuns({
        executionKind: "model-preparation",
        status: ExecutionStatuses.failed,
        unitKind: ExecutionUnitKinds.modelPreparation,
        provenanceClassification: "delegated",
        flowId: "flow-2",
        startedAfter: "2026-03-22T00:00:00.000Z",
        updatedBefore: "2026-03-23T00:00:10.000Z",
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

  it("migrates a legacy execution-run database forward and survives repeated startup", async () => {
    const databasePath = path.join(tmpdir(), `loom-execution-runs-legacy-${Date.now()}.sqlite`);
    let legacyDb: Database.Database;
    try {
      legacyDb = new Database(databasePath);
    } catch (error) {
      if (isSqliteRuntimeUnavailable(error)) {
        expect(String(error)).toContain("module");
        return;
      }
      throw error;
    }
    legacyDb.exec(`
      CREATE TABLE execution_runs (
        run_id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL,
        execution_kind TEXT,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        cancellation_supported INTEGER NOT NULL,
        final_error_message TEXT,
        primary_classification TEXT,
        primary_executor_id TEXT,
        primary_runtime TEXT,
        primary_source_kind TEXT,
        metadata_json TEXT NOT NULL,
        units_json TEXT NOT NULL,
        transitions_json TEXT NOT NULL,
        terminal_summary_json TEXT,
        diagnostics_summary_json TEXT,
        run_json TEXT NOT NULL
      );
      CREATE TABLE execution_run_metadata (
        run_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value_text TEXT,
        value_number REAL,
        value_boolean INTEGER,
        PRIMARY KEY (run_id, key)
      );
    `);
    legacyDb.close();

    const repository = new SqliteExecutionRunRepository(databasePath);
    const secondRepository = new SqliteExecutionRunRepository(databasePath);

    try {
      try {
        await repository.saveRun(makeRun("run-legacy"));
      } catch (error) {
        if (isSqliteRuntimeUnavailable(error)) {
          expect(String(error)).toContain("module");
          return;
        }
        throw error;
      }

      const loaded = await secondRepository.getRunById("run-legacy");
      expect(loaded?.runId).toBe("run-legacy");

      const db = new Database(databasePath, { readonly: true });
      const version = db.pragma("user_version", { simple: true });
      const columns = db.prepare("PRAGMA table_info(execution_runs)").all() as ReadonlyArray<{ readonly name: string }>;
      db.close();

      expect(version).toBeGreaterThanOrEqual(3);
      expect(columns.map((column) => column.name)).toContain("terminal_headline");
      expect(columns.map((column) => column.name)).toContain("diagnostics_headline");
      expect(columns.map((column) => column.name)).toContain("primary_unit_kind");
      expect(columns.map((column) => column.name)).toContain("execution_flow_id");
    } finally {
      repository.dispose();
      secondRepository.dispose();
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
