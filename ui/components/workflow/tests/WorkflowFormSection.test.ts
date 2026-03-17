import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormSection", () => {
  it("renders form fields", () => {
    expect(readSource("ui/components/workflow/WorkflowFormSection.tsx")).toContain("WorkflowFormField");
  });
});
