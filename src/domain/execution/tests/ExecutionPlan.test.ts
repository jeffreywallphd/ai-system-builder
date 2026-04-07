import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../ExecutionPlan";

describe("ExecutionPlan", () => {
  it("returns only dependency-ready units", () => {
    const plan = new ExecutionPlan({
      id: "plan-1",
      units: [
        { id: "prepare", kind: ExecutionUnitKinds.workflow },
        { id: "run", kind: ExecutionUnitKinds.workflow, dependsOn: ["prepare"] },
        { id: "publish", kind: ExecutionUnitKinds.workflow, dependsOn: ["run"] },
      ],
    });

    expect(plan.getReadyUnits({})).toEqual([plan.getUnit("prepare")]);
    expect(plan.getReadyUnits({ prepare: ExecutionStatuses.completed })).toEqual([
      plan.getUnit("run"),
    ]);
    expect(
      plan.getReadyUnits({
        prepare: ExecutionStatuses.completed,
        run: ExecutionStatuses.completed,
      })
    ).toEqual([plan.getUnit("publish")]);
  });

  it("rejects dependency cycles", () => {
    expect(
      () =>
        new ExecutionPlan({
          id: "plan-cycle",
          units: [
            { id: "a", kind: ExecutionUnitKinds.workflow, dependsOn: ["b"] },
            { id: "b", kind: ExecutionUnitKinds.workflow, dependsOn: ["a"] },
          ],
        })
    ).toThrow("contains a dependency cycle");
  });
});
