import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("RunPage", () => {
  it("surfaces persisted workflow run/reopen actions from Run entry flow", () => {
    const source = readSource("ui/pages/RunPage.tsx");

    expect(source).toContain("PersistedWorkflowEntryService");
    expect(source).toContain("Run a saved workflow");
    expect(source).toContain("buildRunWorkflowPath");
    expect(source).toContain("buildWorkflowStudioOpenPath");
    expect(source).toContain("buildWorkflowRunHistoryPath");
    expect(source).toContain("View run history");
    expect(source).toContain('data-testid="run-persisted-workflow-list"');
    expect(source).toContain("RuntimeOperationsService");
    expect(source).toContain("Runtime queue and run monitoring");
    expect(source).toContain('data-testid="run-runtime-operations-panel"');
    expect(source).toContain("runtimeOperationsService.listQueueItems");
    expect(source).toContain("runtimeOperationsService.getRunStatus");
    expect(source).toContain("runtimeOperationsService.cancelRun");
    expect(source).toContain("runtimeOperationsService.dequeueQueueItem");
  });
});
