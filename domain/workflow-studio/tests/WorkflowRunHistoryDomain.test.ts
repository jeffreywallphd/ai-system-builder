import { describe, expect, it } from "bun:test";
import {
  createWorkflowRunDetailRecord,
  createWorkflowStepRunStats,
  createWorkflowRunSummaryRecord,
  normalizeWorkflowRunDetailRecord,
  normalizeWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
  WorkflowStepRunStatuses,
} from "../WorkflowRunHistoryDomain";

describe("WorkflowRunHistoryDomain", () => {
  it("creates canonical workflow run summary records with correlation, output, and step stats", () => {
    const record = createWorkflowRunSummaryRecord({
      runId: " workflow-run:1 ",
      status: WorkflowRunStatuses.completed,
      triggerSource: WorkflowRunTriggerSources.manual,
      workflow: {
        workflowId: " workflow:billing-sync ",
        workflowName: " Billing Sync ",
        definitionAssetId: " asset:workflow-billing-sync ",
        definitionVersionId: "version:workflow-billing-sync:v3",
      },
      correlation: {
        executionRunId: " execution-run:1 ",
        workflowExecutionId: " workflow-execution:runtime-1 ",
        executionFlowId: " flow:billing-sync ",
      },
      timestamps: {
        startedAt: "2026-03-30T13:00:00.000Z",
        endedAt: "2026-03-30T13:02:00.000Z",
        updatedAt: "2026-03-30T13:02:00.000Z",
      },
      output: {
        outputAssetIds: ["asset:out-1", "asset:out-1", "asset:out-2"],
      },
      stepRunStats: createWorkflowStepRunStats([{
        stepRunId: " step-run:1 ",
        stepId: " step:fetch ",
        stepIndex: 0,
        attempt: 1,
        stepName: " Fetch source records ",
        stepType: "action",
        status: WorkflowStepRunStatuses.completed,
        timestamps: {
          startedAt: "2026-03-30T13:00:10.000Z",
          endedAt: "2026-03-30T13:00:40.000Z",
          updatedAt: "2026-03-30T13:00:40.000Z",
        },
      }]),
    });

    expect(record.runId).toBe("workflow-run:1");
    expect(record.workflow.workflowId).toBe("workflow:billing-sync");
    expect(record.workflow.workflowName).toBe("Billing Sync");
    expect(record.status).toBe(WorkflowRunStatuses.completed);
    expect(record.triggerSource).toBe(WorkflowRunTriggerSources.manual);
    expect(record.correlation.executionRunId).toBe("execution-run:1");
    expect(record.output?.outputAssetIds).toEqual(["asset:out-1", "asset:out-2"]);
    expect(record.output?.outputCount).toBe(2);
    expect(record.stepRunStats?.completedCount).toBe(1);
  });

  it("normalizes workflow run detail records with structured execution context and outputs", () => {
    const detail = normalizeWorkflowRunDetailRecord(createWorkflowRunDetailRecord({
      runId: "run:detail-1",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:detail-1",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: {
          workflowId: "workflow:detail",
          workflowName: "Workflow Detail",
        },
        correlation: {
          executionRunId: "execution-run:detail",
        },
        timestamps: {
          startedAt: "2026-03-30T13:00:00.000Z",
          endedAt: "2026-03-30T13:01:00.000Z",
          updatedAt: "2026-03-30T13:01:00.000Z",
        },
      }),
      stepRuns: [{
        stepRunId: "run:detail-1:step-1:1",
        stepId: "step-1",
        stepIndex: 0,
        attempt: 1,
        status: WorkflowStepRunStatuses.completed,
        timestamps: {
          startedAt: "2026-03-30T13:00:10.000Z",
          endedAt: "2026-03-30T13:00:20.000Z",
          updatedAt: "2026-03-30T13:00:20.000Z",
        },
      }],
      executionContext: {
        executionInput: { input: "x" },
        resolvedTriggerContext: { triggerSource: "manual" },
      },
      outputs: {
        outputAssetIds: ["asset:out"],
        outputCount: 1,
        outputValues: { status: "completed" },
      },
    }));

    expect(detail.summary.stepRunStats?.completedCount).toBe(1);
    expect(detail.executionContext?.executionInput).toEqual({ input: "x" });
    expect(detail.outputs?.outputAssetIds).toEqual(["asset:out"]);
    expect(detail.stepRuns[0]?.durationMs).toBe(10000);
  });

  it("normalizes records and defaults unknown trigger sources for forward-compatible ingestion", () => {
    const normalized = normalizeWorkflowRunSummaryRecord({
      runId: "workflow-run:2",
      status: WorkflowRunStatuses.running,
      triggerSource: "external-hook" as never,
      workflow: {
        workflowId: "workflow:2",
        workflowName: "Workflow 2",
      },
      correlation: {
        executionRunId: "execution-run:2",
      },
      timestamps: {
        startedAt: "2026-03-30T14:00:00.000Z",
        updatedAt: "2026-03-30T14:00:30.000Z",
      },
    });

    expect(normalized.triggerSource).toBe(WorkflowRunTriggerSources.unknown);
    expect(normalized.status).toBe(WorkflowRunStatuses.running);
  });

  it("enforces status/timestamp coherence for terminal and non-terminal run states", () => {
    expect(() => createWorkflowRunSummaryRecord({
      runId: "workflow-run:invalid-running",
      status: WorkflowRunStatuses.running,
      workflow: {
        workflowId: "workflow:3",
        workflowName: "Workflow 3",
      },
      correlation: {
        executionRunId: "execution-run:3",
      },
      timestamps: {
        startedAt: "2026-03-30T15:00:00.000Z",
        endedAt: "2026-03-30T15:00:10.000Z",
      },
    })).toThrow("cannot include endedAt");

    expect(() => createWorkflowRunSummaryRecord({
      runId: "workflow-run:invalid-terminal",
      status: WorkflowRunStatuses.failed,
      workflow: {
        workflowId: "workflow:4",
        workflowName: "Workflow 4",
      },
      correlation: {
        executionRunId: "execution-run:4",
      },
      timestamps: {
        startedAt: "2026-03-30T15:30:00.000Z",
      },
    })).toThrow("requires endedAt");
  });
});
