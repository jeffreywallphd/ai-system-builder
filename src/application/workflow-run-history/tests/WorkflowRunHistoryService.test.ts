import { describe, expect, it } from "bun:test";
import { WorkflowRunHistoryService } from "../WorkflowRunHistoryService";
import { InMemoryWorkflowRunSummaryRepository } from "@infrastructure/workflows/InMemoryWorkflowRunSummaryRepository";
import { WorkflowRunHistoryNotFoundError } from "../WorkflowRunHistoryErrors";
import { WorkflowRunStatuses } from "@domain/workflow-studio/WorkflowRunHistoryDomain";

describe("WorkflowRunHistoryService", () => {
  it("records running start state and terminal completion state with output metadata", async () => {
    const repository = new InMemoryWorkflowRunSummaryRepository();
    const timestamps = [
      new Date("2026-03-30T16:00:00.000Z"),
      new Date("2026-03-30T16:01:00.000Z"),
    ];
    const service = new WorkflowRunHistoryService(repository, () => timestamps.shift() ?? new Date("2026-03-30T16:05:00.000Z"));

    const started = await service.recordRunStarted({
      runId: "run:workflow-1",
      executionFlowId: "flow:workflow-1",
      input: {
        workflow: {
          id: "workflow:1",
          metadata: { name: "Workflow One" },
        },
        parameters: {
          triggerSource: "manual",
          workflowDefinitionVersionId: "version:workflow:1:v2",
        },
      } as never,
    });

    const completed = await service.recordRunCompleted({
      runId: "run:workflow-1",
      result: {
        executionId: "workflow-exec:1",
        status: "completed",
        outputAssets: [{ id: "asset:out-1" }, { id: "asset:out-2" }] as never,
      },
    });

    expect(started.status).toBe(WorkflowRunStatuses.running);
    expect(started.timestamps.startedAt).toBe("2026-03-30T16:00:00.000Z");
    expect(completed.status).toBe(WorkflowRunStatuses.completed);
    expect(completed.timestamps.endedAt).toBe("2026-03-30T16:01:00.000Z");
    expect(completed.output?.outputCount).toBe(2);
    expect(completed.correlation.workflowExecutionId).toBe("workflow-exec:1");
    expect(completed.stepRunStats?.totalCount).toBe(0);
    expect(completed.diagnostics).toBeUndefined();

    const detail = await service.getRunDetail("run:workflow-1");
    expect(detail?.executionContext?.executionInput).toEqual(expect.objectContaining({
      parameters: expect.objectContaining({
        triggerSource: "manual",
      }),
    }));
    expect(detail?.outputs?.outputCount).toBe(2);
    expect(detail?.outputs?.resultMessages).toBeUndefined();

    const listed = await service.listRunSummaries({ workflowId: "workflow:1" });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.runId).toBe("run:workflow-1");
  });

  it("records failed terminal states when execution throws before a workflow result", async () => {
    const repository = new InMemoryWorkflowRunSummaryRepository();
    const timestamps = [
      new Date("2026-03-30T17:00:00.000Z"),
      new Date("2026-03-30T17:00:10.000Z"),
    ];
    const service = new WorkflowRunHistoryService(repository, () => timestamps.shift() ?? new Date("2026-03-30T17:00:20.000Z"));

    await service.recordRunStarted({
      runId: "run:workflow-2",
      input: {
        workflow: {
          id: "workflow:2",
          metadata: { name: "Workflow Two" },
        },
      } as never,
    });

    const failed = await service.recordRunFailed({
      runId: "run:workflow-2",
      errorMessage: "Runtime dependency unavailable.",
    });

    expect(failed.status).toBe(WorkflowRunStatuses.failed);
    expect(failed.errorMessage).toBe("Runtime dependency unavailable.");
    expect(failed.timestamps.endedAt).toBe("2026-03-30T17:00:10.000Z");
    expect(failed.diagnostics?.[0]?.scope).toBe("workflow");
    expect(failed.diagnostics?.[0]?.severity).toBe("error");
  });

  it("records step-level lifecycle updates tied to the parent workflow run detail", async () => {
    const repository = new InMemoryWorkflowRunSummaryRepository();
    const timestamps = [
      new Date("2026-03-30T18:00:00.000Z"),
      new Date("2026-03-30T18:00:01.000Z"),
      new Date("2026-03-30T18:00:02.000Z"),
      new Date("2026-03-30T18:00:05.000Z"),
    ];
    const service = new WorkflowRunHistoryService(repository, () => timestamps.shift() ?? new Date("2026-03-30T18:00:10.000Z"));
    const workflow = {
      id: "workflow:steps",
      metadata: { name: "Workflow Steps" },
      nodes: [
        { id: "node-a", title: "First", definition: { title: "Prompt", type: "prompt", executionKind: "generator" } },
        { id: "node-b", title: "Second", definition: { title: "Store", type: "store", executionKind: "sink" } },
      ],
      toGraph: () => ({
        topologicalSort: () => [{ id: "node-a" }, { id: "node-b" }],
      }),
    } as never;

    await service.recordRunStarted({
      runId: "run:steps",
      input: {
        workflow,
      } as never,
    });

    await service.recordStepEvent({
      runId: "run:steps",
      workflow,
      event: {
        kind: "node-started",
        nodeId: "node-a",
      },
    });
    await service.recordStepEvent({
      runId: "run:steps",
      workflow,
      event: {
        kind: "node-completed",
        nodeId: "node-a",
        message: "ok",
      },
    });

    const completed = await service.recordRunCompleted({
      runId: "run:steps",
      result: {
        executionId: "workflow-exec:steps",
        status: "completed",
        outputAssets: [] as never,
      },
    });

    expect(completed.stepRunStats?.totalCount).toBe(1);
    expect(completed.stepRunStats?.completedCount).toBe(1);

    const detail = await service.getRunDetail("run:steps");
    expect(detail?.stepRuns).toHaveLength(1);
    expect(detail?.stepRuns[0]?.stepId).toBe("node-a");
    expect(detail?.stepRuns[0]?.stepIndex).toBe(0);
    expect(detail?.stepRuns[0]?.status).toBe("completed");
    expect(detail?.summary.diagnostics).toBeUndefined();
    expect(detail?.summary.runId).toBe("run:steps");
  });

  it("records structured step diagnostics when step events fail and exposes failure location", async () => {
    const repository = new InMemoryWorkflowRunSummaryRepository();
    const timestamps = [
      new Date("2026-03-30T20:00:00.000Z"),
      new Date("2026-03-30T20:00:01.000Z"),
      new Date("2026-03-30T20:00:02.000Z"),
    ];
    const service = new WorkflowRunHistoryService(repository, () => timestamps.shift() ?? new Date("2026-03-30T20:00:03.000Z"));
    const workflow = {
      id: "workflow:failed-step",
      metadata: { name: "Workflow Failed Step" },
      nodes: [
        { id: "node-a", title: "Step A", definition: { title: "Prompt", type: "prompt", executionKind: "generator" } },
      ],
      toGraph: () => ({
        topologicalSort: () => [{ id: "node-a" }],
      }),
    } as never;

    await service.recordRunStarted({
      runId: "run:failed-step",
      input: {
        workflow,
      } as never,
    });

    await service.recordStepEvent({
      runId: "run:failed-step",
      workflow,
      event: {
        kind: "node-failed",
        nodeId: "node-a",
        message: "Runtime call failed",
        payload: {
          code: "runtime-error",
          detail: "Connection reset",
        },
      },
    });

    const detail = await service.getRunDetail("run:failed-step");
    expect(detail?.stepRuns[0]?.diagnostics?.[0]?.scope).toBe("step");
    expect(detail?.stepRuns[0]?.diagnostics?.[0]?.category).toBe("runtime");
    expect(detail?.summary.diagnostics?.[0]?.scope).toBe("step");
    expect(detail?.summary.diagnostics?.[0]?.location?.stepId).toBe("node-a");
  });

  it("returns deterministic not-found errors when terminal updates are attempted before start", async () => {
    const service = new WorkflowRunHistoryService(new InMemoryWorkflowRunSummaryRepository());

    await expect(service.recordRunCompleted({
      runId: "missing-run",
      result: {
        executionId: "workflow-exec:missing",
        status: "failed",
        outputAssets: [] as never,
        errorMessage: "missing",
      },
    })).rejects.toBeInstanceOf(WorkflowRunHistoryNotFoundError);
  });

  it("captures rerun lineage mode and reason from execution input parameters", async () => {
    const repository = new InMemoryWorkflowRunSummaryRepository();
    const service = new WorkflowRunHistoryService(repository, () => new Date("2026-03-31T00:00:00.000Z"));

    const started = await service.recordRunStarted({
      runId: "run:rerun-lineage",
      input: {
        workflow: {
          id: "workflow:rerun",
          metadata: { name: "Workflow Rerun" },
        },
        parameters: {
          parentRunId: "run:source-1",
          rerunMode: "edited",
          rerunReason: "Updated input constraints",
        },
      } as never,
    });

    expect(started.correlation.parentRunId).toBe("run:source-1");
    expect(started.correlation.rerunMode).toBe("edited");
    expect(started.correlation.rerunReason).toBe("Updated input constraints");
  });
});

