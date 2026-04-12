import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormView", () => {
  it("renders form sections", () => {
    expect(readSource("ui/components/workflow/WorkflowFormView.tsx")).toContain("WorkflowFormSection");
  });

  it("keeps projected context editors available through the shared field editor", () => {
    const source = readSource("ui/components/projection/ProjectedFieldEditor.tsx");
    expect(source).toContain("ContextPackageReferenceFieldEditor");
    expect(source).toContain("ContextRecipeSelectionFieldEditor");
    expect(source).toContain('field.presentation === "context-package-references"');
    expect(source).toContain('field.presentation === "context-recipe-selections"');
    expect(source).toContain("availableContextPackages");
    expect(source).toContain("availableContextRecipes");
  });

  it("supports author package binding controls for selection and ordering", () => {
    const source = readSource("ui/components/projection/ContextPackageReferenceFieldEditor.tsx");
    expect(source).toContain("Move up");
    expect(source).toContain("Move down");
    expect(source).toContain("Attach context package");
  });

  it("supports author recipe binding controls with summaries and tool visibility", () => {
    const source = readSource("ui/components/projection/ContextRecipeSelectionFieldEditor.tsx");
    expect(source).toContain("Recipe summary");
    expect(source).toContain("Show as a non-technical preset in Tools UI");
    expect(source).toContain("Add context recipe");
  });
});
