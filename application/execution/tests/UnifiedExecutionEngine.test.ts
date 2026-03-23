import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
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
});
