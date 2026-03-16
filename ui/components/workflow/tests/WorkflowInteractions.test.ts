import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow interactions", () => {
  it("keeps placeholder modules consistent for WorkflowCanvas.tsx, WorkflowInspector.tsx, WorkflowToolbar.tsx", () => {
    const sources = [readSource("ui/components/workflow/WorkflowCanvas.tsx"), readSource("ui/components/workflow/WorkflowInspector.tsx"), readSource("ui/components/workflow/WorkflowToolbar.tsx")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});
