import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("RunPage", () => {
  it("composes shared operational workspace dashboard foundations", () => {
    const source = readSource("ui/pages/RunPage.tsx");

    expect(source).toContain("OperationalWorkspaceDashboard");
    expect(source).toContain("buildOperationalWorkspaceDashboardModel");
    expect(source).toContain("RunDesktopOperationalDashboardPage");
    expect(source).toContain("RunThinClientOperationalDashboardPage");
    expect(source).toContain("NodeInventoryService");
    expect(source).toContain("RuntimeOperationsService");
    expect(source).toContain("OperationalQueueVisibilityPanel");
    expect(source).toContain("OperationalQueueDetailPanel");
    expect(source).toContain("resolveQueueVisibilityStatuses");
    expect(source).toContain("Launch allowed run");
    expect(source).toContain("runtimeOperationsService.listQueueItems");
    expect(source).toContain("runtimeOperationsService.inspectRun");
    expect(source).toContain("runtimeOperationsService.startRun");
    expect(source).toContain("runtimeOperationsService.cancelRun");
    expect(source).toContain("runtimeOperationsService.dequeueQueueItem");
    expect(source).toContain("RuntimeRealtimeSubscriptionService");
    expect(source).toContain("subscribeOperationalUpdates");
    expect(source).toContain("resolveIdentityAccessChannel");
  });
});
