import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/services contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/services/NodeService.ts"))).toEqual([]);
    expect(Object.keys(await importModule("ui/services/ModelService.ts"))).toEqual([]);
    expect(Object.keys(await importModule("ui/services/WorkflowService.ts"))).toEqual([]);
  });
});
