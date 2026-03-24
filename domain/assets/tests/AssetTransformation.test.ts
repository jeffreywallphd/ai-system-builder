import { describe, expect, it } from "bun:test";
import { AssetTransformation } from "../AssetTransformation";

describe("AssetTransformation", () => {
  it("captures execution-linked transformation details", () => {
    const transformation = new AssetTransformation({
      transformationId: "tx-1",
      kind: "workflow-node-run",
      status: "completed",
      inputVersionIds: ["v-in"],
      outputVersionIds: ["v-out"],
      executionId: "exec-1",
      runtime: "python",
    });

    expect(transformation.executionId).toBe("exec-1");
    expect(transformation.inputVersionIds).toEqual(["v-in"]);
    expect(transformation.outputVersionIds).toEqual(["v-out"]);
  });

  it("enforces invariants", () => {
    expect(
      () =>
        new AssetTransformation({
          transformationId: "tx-2",
          kind: "workflow-node-run",
          status: "completed",
        }),
    ).toThrow("at least one input or output");

    expect(
      () =>
        new AssetTransformation({
          transformationId: "tx-3",
          kind: "workflow-node-run",
          status: "completed",
          inputVersionIds: ["v-in"],
          startedAt: new Date("2026-01-02T00:00:00.000Z"),
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
    ).toThrow("earlier");
  });
});
