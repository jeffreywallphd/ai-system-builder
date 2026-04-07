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
    expect(source).toContain("Desktop and thin-client runtime operations");
    expect(source).toContain("Launch allowed run");
    expect(source).toContain("approved parameter adjustments");
    expect(source).toContain('data-testid="run-runtime-operations-panel"');
    expect(source).toContain("runtimeOperationsService.listQueueItems");
    expect(source).toContain("runtimeOperationsService.inspectRun");
    expect(source).toContain("runtimeOperationsService.startRun");
    expect(source).toContain("runtimeOperationsService.cancelRun");
    expect(source).toContain("runtimeOperationsService.dequeueQueueItem");
    expect(source).toContain("RuntimeRealtimeSubscriptionService");
    expect(source).toContain("subscribeOperationalUpdates");
    expect(source).toContain("Realtime channel:");
    expect(source).toContain("stale data fallback active");
    expect(source).toContain("Thin-client lifecycle resume handling");
  });
});
