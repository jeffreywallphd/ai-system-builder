import { describe, expect, it } from "bun:test";
import { importModule } from "../../../tests/testUtils";

describe("ui/components/workflow contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/components/workflow/WorkflowCanvas.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/components/workflow/WorkflowInspector.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/components/workflow/WorkflowToolbar.tsx"))).toEqual([]);
  });
});
