import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormField", () => {
  it("reuses the shared projected field editor for author form mode", () => {
    const source = readSource("ui/components/workflow/WorkflowFormField.tsx");
    expect(source).toContain('import ProjectedFieldEditor');
    expect(source).toContain("<ProjectedFieldEditor");
  });
});
