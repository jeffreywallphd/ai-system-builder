import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("BuildPage", () => {
  it("surfaces persisted workflow reuse entry points in Build flow", () => {
    const source = readSource("ui/pages/BuildPage.tsx");

    expect(source).toContain("PersistedWorkflowEntryService");
    expect(source).toContain("Reuse a Saved Workflow");
    expect(source).toContain("buildWorkflowStudioOpenPath");
    expect(source).toContain("buildWorkflowRunHistoryPath");
    expect(source).toContain("View run history");
    expect(source).toContain('data-testid="build-persisted-workflow-list"');
    expect(source).toContain("Reference Image Manipulation System");
    expect(source).toContain("buildTemplateId");
    expect(source).toContain("Open in System Studio");
  });
});
