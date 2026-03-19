import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("WorkflowEditorPage", () => {
  it("keeps canvas and form views mounted so switching modes stays state-safe", () => {
    const source = readSource("ui/pages/WorkflowEditorPage.tsx");
    expect(source).toContain('viewMode === "canvas" ? "ui-canvas-shell__view--active" : "ui-canvas-shell__view--inactive"');
    expect(source).toContain('viewMode === "form" ? "ui-canvas-shell__view--active" : "ui-canvas-shell__view--inactive"');
    expect(source).toContain("<WorkflowCanvas");
    expect(source).toContain("<WorkflowFormView");
    expect(source).toContain("contextInspection={selectedContextInspection}");
  });
});
