import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormField", () => {
  it("reuses the node property field renderer for form mode fields", () => {
    const source = readSource("ui/components/workflow/WorkflowFormField.tsx");
    expect(source).toContain('import NodePropertyField');
    expect(source).toContain("<NodePropertyField");
    expect(source).toContain("type: field.type");
  });
});
