import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("execution ui references workflow toolbar", () => {
  it("keeps workflow canvas toolbar actions available", () => {
    const source = readSource("ui/components/workflow/WorkflowCanvasToolbar.tsx");
    expect(source).toContain("Validate");
    expect(source).toContain("Clear Selection");
  });
});
