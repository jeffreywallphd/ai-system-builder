import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import { WorkflowExecutionUnitHandler } from "../WorkflowExecutionUnitHandler";

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
});
