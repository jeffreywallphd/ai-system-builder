import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import {
  UnifiedExecutionEngine,
  type IExecutionUnitHandler,
} from "../UnifiedExecutionEngine";

describe("UnifiedExecutionEngine", () => {
  it("runs ready units in dependency order and records transitions", async () => {
    const calls: string[] = [];
    const handler: IExecutionUnitHandler = {
      canHandle: () => true,
      execute: async ({ unit }) => {
        calls.push(unit.id);
        return {
          unitId: unit.id,
          status: ExecutionStatuses.completed,
          outputMetadata: { handledBy: unit.id },
        };
      },
    };
    const engine = new UnifiedExecutionEngine([handler]);
    const result = await engine.execute({
      plan: new ExecutionPlan({
        id: "plan-1",
        units: [
          { id: "prepare", kind: ExecutionUnitKinds.workflow },
          { id: "run", kind: ExecutionUnitKinds.workflow, dependsOn: ["prepare"] },
        ],
      }),
    });

    expect(calls).toEqual(["prepare", "run"]);
    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(result.unitStatuses).toEqual({
      prepare: ExecutionStatuses.completed,
      run: ExecutionStatuses.completed,
    });
    expect(result.transitions.map((transition) => `${transition.unitId}:${transition.toStatus}`)).toEqual([
      "prepare:running",
      "prepare:completed",
      "run:ready",
      "run:running",
      "run:completed",
    ]);
  });

  it("skips downstream units when a unit fails", async () => {
    const engine = new UnifiedExecutionEngine([
      {
        canHandle: () => true,
        execute: async ({ unit }) => ({
          unitId: unit.id,
          status: unit.id === "prepare" ? ExecutionStatuses.failed : ExecutionStatuses.completed,
          errorMessage: unit.id === "prepare" ? "boom" : undefined,
        }),
      },
    ]);

    const result = await engine.execute({
      plan: new ExecutionPlan({
        id: "plan-2",
        units: [
          { id: "prepare", kind: ExecutionUnitKinds.workflow },
          { id: "run", kind: ExecutionUnitKinds.workflow, dependsOn: ["prepare"] },
        ],
      }),
    });

    expect(result.status).toBe(ExecutionStatuses.failed);
    expect(result.unitStatuses).toEqual({
      prepare: ExecutionStatuses.failed,
      run: ExecutionStatuses.skipped,
    });
  });

  it("persists durable execution run history with truthful provenance", async () => {
    const savedRuns: any[] = [];
    const handler: IExecutionUnitHandler = {
      canHandle: () => true,
      startExecution: async ({ unit, runId }) => ({
        unitId: unit.id,
        cancel: async () => undefined,
        subscribe: (listener) => {
          listener({
            planId: "plan-3",
            runId,
            unitId: unit.id,
            status: ExecutionStatuses.running,
            provenance: {
              classification: "delegated",
              executorId: "infra-delegated-python",
              runtime: "python",
              detail: "Delegated to Python.",
              sourceKind: "workflow",
            },
          });
          return () => undefined;
        },
        waitForCompletion: async () => ({
          unitId: unit.id,
          status: ExecutionStatuses.completed,
          provenance: {
            classification: "delegated",
            executorId: "infra-delegated-python",
            runtime: "python",
            detail: "Delegated to Python.",
            sourceKind: "workflow",
          },
          outputMetadata: { executionId: "exec-1" },
        }),
      }),
      execute: async () => ({
        unitId: "workflow:wf-1",
        status: ExecutionStatuses.completed,
      }),
    };
    const engine = new UnifiedExecutionEngine([handler], {
      saveRun: async (run) => {
        savedRuns.push(run);
        return run;
      },
      getRunById: async () => undefined,
      listRuns: async () => [],
    });

    const result = await engine.execute({
      plan: new ExecutionPlan({
        id: "plan-3",
        units: [{ id: "workflow:wf-1", kind: ExecutionUnitKinds.workflow }],
      }),
      metadata: { executionKind: "workflow", workflowId: "wf-1" },
    });

    expect(result.runId).toContain("plan-3-run-");
    expect(savedRuns.length).toBeGreaterThan(1);
    expect(savedRuns.at(-1)?.status).toBe(ExecutionStatuses.completed);
    expect(savedRuns.at(-1)?.metadata).toEqual({ executionKind: "workflow", workflowId: "wf-1" });
    expect(savedRuns.at(-1)?.units["workflow:wf-1"]?.provenance?.classification).toBe("delegated");
    expect(savedRuns.at(-1)?.transitions.some((transition: any) => transition.toStatus === ExecutionStatuses.running)).toBe(true);
  });

});

