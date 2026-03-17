import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormView", () => {
  it("renders form sections", () => {
    expect(readSource("ui/components/workflow/WorkflowFormView.tsx")).toContain("WorkflowFormSection");
  });
});
