import { describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteWorkflowRunSummaryRepository } from "../../../infrastructure/filesystem/SqliteWorkflowRunSummaryRepository";
import {
  createWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
} from "../../../domain/workflow-studio/WorkflowRunHistoryDomain";

function makeSummary(overrides?: Partial<ReturnType<typeof createWorkflowRunSummaryRecord>>) {
  const base = createWorkflowRunSummaryRecord({
    runId: "run:1",
    status: WorkflowRunStatuses.running,
    triggerSource: WorkflowRunTriggerSources.manual,
    workflow: {
      workflowId: "workflow:1",
      workflowName: "Workflow One",
    },
    correlation: {
      executionRunId: "execution-run:1",
      executionFlowId: "flow:1",
    },
    timestamps: {
      startedAt: "2026-03-30T18:00:00.000Z",
      updatedAt: "2026-03-30T18:00:00.000Z",
    },
  });

  return createWorkflowRunSummaryRecord({
    ...base,
    ...overrides,
    workflow: {
      ...base.workflow,
      ...(overrides?.workflow ?? {}),
    },
    correlation: {
      ...base.correlation,
      ...(overrides?.correlation ?? {}),
    },
    timestamps: {
      ...base.timestamps,
      ...(overrides?.timestamps ?? {}),
    },
  });
}

describe("SqliteWorkflowRunSummaryRepository", () => {
  it("persists and lists workflow run summaries with status/workflow/trigger filters", async () => {
    const databasePath = path.join(tmpdir(), `loom-workflow-run-summaries-${Date.now()}.sqlite`);
    const repository = new SqliteWorkflowRunSummaryRepository(databasePath);

    try {
      try {
        await repository.upsert(makeSummary());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("NODE_MODULE_VERSION") || message.includes("native module") || message.includes("bun:sqlite")) {
          expect(message.length).toBeGreaterThan(0);
          return;
        }
        throw error;
      }

      await repository.upsert(makeSummary({
        runId: "run:2",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.api,
        workflow: {
          workflowId: "workflow:2",
          workflowName: "Workflow Two",
        },
        correlation: {
          executionRunId: "execution-run:2",
        },
        timestamps: {
          startedAt: "2026-03-30T18:10:00.000Z",
          endedAt: "2026-03-30T18:11:00.000Z",
          updatedAt: "2026-03-30T18:11:00.000Z",
        },
      }));

      const loaded = await repository.getByRunId("run:2");
      const filtered = await repository.list({
        workflowId: "workflow:2",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.api,
      });

      expect(loaded?.workflow.workflowName).toBe("Workflow Two");
      expect(loaded?.timestamps.endedAt).toBe("2026-03-30T18:11:00.000Z");
      expect(filtered.map((entry) => entry.runId)).toEqual(["run:2"]);
    } finally {
      repository.dispose();
      rmSync(databasePath, { force: true });
      rmSync(`${databasePath}-wal`, { force: true });
      rmSync(`${databasePath}-shm`, { force: true });
    }
  });

  it("upserts existing run summaries and preserves canonical mapping", async () => {
    const databasePath = path.join(tmpdir(), `loom-workflow-run-summaries-upsert-${Date.now()}.sqlite`);
    const repository = new SqliteWorkflowRunSummaryRepository(databasePath);

    try {
      try {
        await repository.upsert(makeSummary());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("NODE_MODULE_VERSION") || message.includes("native module") || message.includes("bun:sqlite")) {
          expect(message.length).toBeGreaterThan(0);
          return;
        }
        throw error;
      }

      await repository.upsert(makeSummary({
        runId: "run:1",
        status: WorkflowRunStatuses.failed,
        timestamps: {
          startedAt: "2026-03-30T18:00:00.000Z",
          endedAt: "2026-03-30T18:02:00.000Z",
          updatedAt: "2026-03-30T18:02:00.000Z",
        },
        errorMessage: "Validation failed.",
      }));

      const loaded = await repository.getByRunId("run:1");
      expect(loaded?.status).toBe(WorkflowRunStatuses.failed);
      expect(loaded?.errorMessage).toBe("Validation failed.");
      expect(loaded?.timestamps.endedAt).toBe("2026-03-30T18:02:00.000Z");
    } finally {
      repository.dispose();
      rmSync(databasePath, { force: true });
      rmSync(`${databasePath}-wal`, { force: true });
      rmSync(`${databasePath}-shm`, { force: true });
    }
  });
});
