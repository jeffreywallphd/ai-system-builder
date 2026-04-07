import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowViewModeToggle", () => {
  it("renders canvas and form controls", () => {
    const source = readSource("ui/components/workflow/WorkflowViewModeToggle.tsx");
    expect(source).toContain("Canvas");
    expect(source).toContain("Form");
  });
});
