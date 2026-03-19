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
    expect(source).toContain("availableContextPackages");
  });

  it("supports author package binding controls for selection and ordering", () => {
    const source = readSource("ui/components/projection/ContextPackageReferenceFieldEditor.tsx");
    expect(source).toContain("Move up");
    expect(source).toContain("Move down");
    expect(source).toContain("Attach context package");
  });
});
