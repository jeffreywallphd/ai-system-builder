import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/state contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/state/NodeStore.ts"))).toEqual([]);
    expect(Object.keys(await importModule("ui/state/ModelStore.ts"))).toEqual([]);
    expect(Object.keys(await importModule("ui/state/WorkflowStore.ts"))).toEqual([]);
  });
});
