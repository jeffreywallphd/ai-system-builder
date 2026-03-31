import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("RunPage", () => {
  it("surfaces persisted workflow run/reopen actions from Run entry flow", () => {
    const source = readSource("ui/pages/RunPage.tsx");

    expect(source).toContain("PersistedWorkflowEntryService");
    expect(source).toContain("Run a saved workflow");
    expect(source).toContain("buildRunWorkflowPath");
    expect(source).toContain("buildWorkflowStudioOpenPath");
    expect(source).toContain('data-testid="run-persisted-workflow-list"');
  });
});
