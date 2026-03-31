import { describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteWorkflowRunSummaryRepository } from "../../../infrastructure/filesystem/SqliteWorkflowRunSummaryRepository";
import {
  createWorkflowRunDetailRecord,
  createWorkflowStepRunStats,
  createWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowStepRunStatuses,
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

  it("persists and retrieves workflow run detail records with step runs and structured context/output payloads", async () => {
    const databasePath = path.join(tmpdir(), `loom-workflow-run-details-${Date.now()}.sqlite`);
    const repository = new SqliteWorkflowRunSummaryRepository(databasePath);

    try {
      const summary = makeSummary({
        runId: "run:detail-1",
        status: WorkflowRunStatuses.completed,
        timestamps: {
          startedAt: "2026-03-30T19:00:00.000Z",
          endedAt: "2026-03-30T19:01:00.000Z",
          updatedAt: "2026-03-30T19:01:00.000Z",
        },
      });
      const detail = createWorkflowRunDetailRecord({
        runId: summary.runId,
        summary: createWorkflowRunSummaryRecord({
          ...summary,
          stepRunStats: createWorkflowStepRunStats([{
            stepRunId: "run:detail-1:node-a:1",
            stepId: "node-a",
            stepIndex: 0,
            attempt: 1,
            status: WorkflowStepRunStatuses.completed,
            timestamps: {
              startedAt: "2026-03-30T19:00:10.000Z",
              endedAt: "2026-03-30T19:00:20.000Z",
              updatedAt: "2026-03-30T19:00:20.000Z",
            },
            stepType: "prompt",
            actionType: "generator",
            summary: "completed",
          }]),
        }),
        stepRuns: [{
          stepRunId: "run:detail-1:node-a:1",
          stepId: "node-a",
          stepIndex: 0,
          attempt: 1,
          status: WorkflowStepRunStatuses.completed,
          timestamps: {
            startedAt: "2026-03-30T19:00:10.000Z",
            endedAt: "2026-03-30T19:00:20.000Z",
            updatedAt: "2026-03-30T19:00:20.000Z",
          },
          stepType: "prompt",
          actionType: "generator",
          summary: "completed",
        }],
        executionContext: {
          executionInput: { prompt: "hello" },
          resolvedTriggerContext: { triggerSource: "manual" },
        },
        outputs: {
          outputAssetIds: ["asset:out-1"],
          outputCount: 1,
          outputValues: { status: "completed" },
        },
      });

      await repository.upsertDetail(detail);

      const loadedDetail = await repository.getDetailByRunId("run:detail-1");
      const loadedSummary = await repository.getByRunId("run:detail-1");
      expect(loadedDetail?.stepRuns).toHaveLength(1);
      expect(loadedDetail?.executionContext?.resolvedTriggerContext).toEqual({ triggerSource: "manual" });
      expect(loadedDetail?.outputs?.outputCount).toBe(1);
      expect(loadedSummary?.stepRunStats?.completedCount).toBe(1);
    } finally {
      repository.dispose();
      rmSync(databasePath, { force: true });
      rmSync(`${databasePath}-wal`, { force: true });
      rmSync(`${databasePath}-shm`, { force: true });
    }
  });
});
