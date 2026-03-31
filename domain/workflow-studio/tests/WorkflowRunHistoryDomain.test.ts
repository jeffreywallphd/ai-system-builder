import { describe, expect, it } from "bun:test";
import {
  createWorkflowRunSummaryRecord,
  normalizeWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
  WorkflowStepRunStatuses,
} from "../WorkflowRunHistoryDomain";

describe("WorkflowRunHistoryDomain", () => {
  it("creates canonical workflow run summary records with correlation, output, and step placeholders", () => {
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
      stepRuns: [{
        stepRunId: " step-run:1 ",
        stepId: " step:fetch ",
        stepName: " Fetch source records ",
        stepType: "action",
        status: WorkflowStepRunStatuses.completed,
        startedAt: "2026-03-30T13:00:10.000Z",
        endedAt: "2026-03-30T13:00:40.000Z",
      }],
    });

    expect(record.runId).toBe("workflow-run:1");
    expect(record.workflow.workflowId).toBe("workflow:billing-sync");
    expect(record.workflow.workflowName).toBe("Billing Sync");
    expect(record.status).toBe(WorkflowRunStatuses.completed);
    expect(record.triggerSource).toBe(WorkflowRunTriggerSources.manual);
    expect(record.correlation.executionRunId).toBe("execution-run:1");
    expect(record.output?.outputAssetIds).toEqual(["asset:out-1", "asset:out-2"]);
    expect(record.output?.outputCount).toBe(2);
    expect(record.stepRuns?.[0]?.stepRunId).toBe("step-run:1");
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
