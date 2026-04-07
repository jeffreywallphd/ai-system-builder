import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSurfaceResponsiveProfile } from "../responsive";
import OperationalWorkspaceDashboard from "../operations/OperationalWorkspaceDashboard";
import { buildOperationalWorkspaceDashboardModel } from "../../presenters/OperationalWorkspaceDashboardPresenter";

describe("OperationalWorkspaceDashboard", () => {
  it("renders shared dashboard cards, status sections, and alerts", () => {
    const model = buildOperationalWorkspaceDashboardModel({
      queueItems: Object.freeze([
        Object.freeze({
          queueItemId: "queue:1",
          executionId: "run:1",
          systemId: "system:alpha",
          status: "queued",
          enqueuedAt: "2026-04-07T10:00:00.000Z",
        }),
      ]),
      recentRuns: Object.freeze([
        Object.freeze({
          runId: "run:1",
          planId: "plan:1",
          status: "running",
          statusLabel: "Running",
          statusTone: "info",
          completedUnits: 1,
          totalUnits: 3,
          progressPercent: 33,
          progressLabel: "1/3 units",
          executionPathLabel: "Real execution",
          startedAt: "2026-04-07T10:00:00.000Z",
          updatedAt: "2026-04-07T10:01:00.000Z",
          durationSummary: "1m",
        }),
      ]),
      recentOutputs: Object.freeze([
        Object.freeze({
          executionId: "run:output",
          status: "completed",
          outputFieldCount: 2,
          outputContractIds: Object.freeze(["contract:1"]),
        }),
      ]),
      nodeInventory: Object.freeze([]),
      realtime: Object.freeze({ state: "connected", stale: false }),
    });

    const html = renderToStaticMarkup(
      React.createElement(OperationalWorkspaceDashboard, {
        model,
        queueItems: Object.freeze([
          Object.freeze({
            queueItemId: "queue:1",
            executionId: "run:1",
            systemId: "system:alpha",
            status: "queued",
            enqueuedAt: "2026-04-07T10:00:00.000Z",
          }),
        ]),
        recentRuns: Object.freeze([
          Object.freeze({
            runId: "run:1",
            planId: "plan:1",
            status: "running",
            statusLabel: "Running",
            statusTone: "info",
            completedUnits: 1,
            totalUnits: 3,
            progressPercent: 33,
            progressLabel: "1/3 units",
            executionPathLabel: "Real execution",
            startedAt: "2026-04-07T10:00:00.000Z",
            updatedAt: "2026-04-07T10:01:00.000Z",
            durationSummary: "1m",
          }),
        ]),
        recentOutputs: Object.freeze([
          Object.freeze({
            executionId: "run:output",
            status: "completed",
            outputFieldCount: 2,
            outputContractIds: Object.freeze(["contract:1"]),
          }),
        ]),
        isQueueLoading: false,
        isRecentOutputsLoading: false,
        realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
        responsiveProfile: createSurfaceResponsiveProfile({ viewportWidthPx: 1200 }),
        onRefreshQueue: () => undefined,
        onInspectRun: () => undefined,
        onCancelRun: () => undefined,
        onDequeue: () => undefined,
        onOpenNodeInventory: () => undefined,
      }),
    );

    expect(html).toContain("operational-workspace-dashboard");
    expect(html).toContain("Actionable alerts");
    expect(html).toContain("Queue state");
    expect(html).toContain("Live updates: Connected");
    expect(html).toContain("Recent outputs");
    expect(html).toContain("Node availability");
    expect(html).toContain("ui-operational-truncate");
  });
});
