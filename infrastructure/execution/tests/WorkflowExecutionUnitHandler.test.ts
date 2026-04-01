import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import { WorkflowExecutionUnitHandler } from "../WorkflowExecutionUnitHandler";
import { WorkflowRunStatuses } from "../../../domain/workflow-studio/WorkflowRunHistoryDomain";

describe("WorkflowExecutionUnitHandler", () => {
  it("wraps the existing workflow executor and preserves provenance", async () => {
    const events: string[] = [];
    const handler = new WorkflowExecutionUnitHandler({
      canExecute: () => true,
      startExecution: async () => ({
        executionId: "unused",
        input: {} as never,
        getProgress: async () => ({ executionId: "unused", status: "queued" }),
        waitForCompletion: async () => ({ executionId: "unused", status: "completed", outputAssets: [] }),
        cancel: async () => undefined,
      }),
      execute: async (_input, onWorkflowEvent) => {
        onWorkflowEvent?.({
          executionId: "exec-1",
          kind: "workflow-started",
          status: "running",
          message: "delegating",
          provenance: {
            classification: "delegated",
            runtime: "python",
            strategyId: "infra-delegated-python",
            detail: "Workflow execution was delegated to the Python runtime.",
          },
        });

        return {
          executionId: "exec-1",
          status: "completed",
          outputAssets: [],
          provenance: {
            classification: "delegated",
            runtime: "python",
            strategyId: "infra-delegated-python",
            detail: "Workflow execution was delegated to the Python runtime.",
          },
        };
      },
      getStatus: async () => undefined,
    });

    const result = await handler.execute(
      {
        plan: new ExecutionPlan({
          id: "plan-1",
          units: [{ id: "workflow:wf-1", kind: ExecutionUnitKinds.workflow }],
        }),
        runId: "workflow-plan-run-1",
        unit: { id: "workflow:wf-1", kind: ExecutionUnitKinds.workflow, dependsOn: [] },
        unitInputs: {
          "workflow:wf-1": {
            workflow: { id: "wf-1" },
          },
        },
      },
      (event) => {
        events.push(`${event.status}:${event.provenance?.classification}`);
      }
    );

    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(result.provenance?.classification).toBe("delegated");
    expect(result.artifacts?.[0]?.kind).toBe("workflow-result");
    expect(events).toEqual(["running:delegated"]);
  });

  it("records workflow run summary start and completion states through the history service seam", async () => {
    const historyEvents: Array<{ readonly kind: string; readonly runId: string; readonly status?: string }> = [];
    const handler = new WorkflowExecutionUnitHandler(
      {
        canExecute: () => true,
        startExecution: async () => ({
          executionId: "unused",
          input: {} as never,
          getProgress: async () => ({ executionId: "unused", status: "queued" }),
          waitForCompletion: async () => ({ executionId: "unused", status: "completed", outputAssets: [] }),
          cancel: async () => undefined,
        }),
        execute: async (_input, onEvent) => {
          onEvent?.({
            executionId: "workflow-exec-2",
            kind: "node-completed",
            status: "running",
            nodeId: "node-1",
            message: "node finished",
          });
          return {
            executionId: "workflow-exec-2",
            status: "completed",
            outputAssets: [],
          };
        },
      },
      undefined,
      {
        async recordRunStarted(request) {
          historyEvents.push({ kind: "started", runId: request.runId, status: WorkflowRunStatuses.running });
          return {} as never;
        },
        async recordRunCompleted(request) {
          historyEvents.push({ kind: "completed", runId: request.runId, status: request.result.status });
          return {} as never;
        },
        async recordStepEvent(request) {
          historyEvents.push({ kind: "step-event", runId: request.runId, status: request.event.kind });
          return undefined;
        },
      } as never,
    );

    const result = await handler.execute({
      plan: new ExecutionPlan({
        id: "plan-2",
        units: [{ id: "workflow:wf-2", kind: ExecutionUnitKinds.workflow }],
      }),
      runId: "workflow-plan-run-2",
      unit: { id: "workflow:wf-2", kind: ExecutionUnitKinds.workflow, dependsOn: [] },
      unitInputs: {
        "workflow:wf-2": {
          workflow: {
            id: "wf-2",
            metadata: { name: "Workflow Two" },
          },
        },
      },
    });

    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(historyEvents).toEqual([
      { kind: "started", runId: "workflow-plan-run-2", status: WorkflowRunStatuses.running },
      { kind: "step-event", runId: "workflow-plan-run-2", status: "node-completed" },
      { kind: "completed", runId: "workflow-plan-run-2", status: "completed" },
    ]);
  });

  it("marks execution failed with structured output persistence summary when persistence fails after runtime success", async () => {
    const handler = new WorkflowExecutionUnitHandler(
      {
        canExecute: () => true,
        startExecution: async () => ({
          executionId: "unused",
          input: {} as never,
          getProgress: async () => ({ executionId: "unused", status: "queued" }),
          waitForCompletion: async () => ({ executionId: "unused", status: "completed", outputAssets: [] }),
          cancel: async () => undefined,
        }),
        execute: async () => ({
          executionId: "exec-3",
          status: "completed",
          outputAssets: [],
        }),
      },
      undefined,
      undefined,
      {
        persist: async () => ({
          status: "failed",
          persistedRecordCount: 0,
          targetCount: 1,
          results: [],
          issues: [{ code: "workflow-output-persistence-failed", message: "boom" }],
        }),
      },
    );

    const result = await handler.execute({
      plan: new ExecutionPlan({ id: "plan-3", units: [{ id: "workflow:wf-3", kind: ExecutionUnitKinds.workflow }] }),
      runId: "workflow-plan-run-3",
      unit: { id: "workflow:wf-3", kind: ExecutionUnitKinds.workflow, dependsOn: [] },
      unitInputs: {
        "workflow:wf-3": { workflow: { id: "wf-3" } },
      },
    });

    expect(result.status).toBe(ExecutionStatuses.failed);
    expect(result.errorMessage).toContain("boom");
  });

});
