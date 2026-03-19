import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormView", () => {
  it("renders form sections", () => {
    expect(readSource("ui/components/workflow/WorkflowFormView.tsx")).toContain("WorkflowFormSection");
  });

  it("keeps projected context editors available through the shared field editor", () => {
    const source = readSource("ui/components/projection/ProjectedFieldEditor.tsx");
    expect(source).toContain("ContextPackageReferenceFieldEditor");
    expect(source).toContain('field.presentation === "context-package-references"');
  });
});
