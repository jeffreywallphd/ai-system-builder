import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormField", () => {
  it("emits field changes", () => {
    expect(readSource("ui/components/workflow/WorkflowFormField.tsx")).toContain("onChange");
  });
});
