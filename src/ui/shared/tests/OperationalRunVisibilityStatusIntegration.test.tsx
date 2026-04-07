import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OperationalRunDetailStatusPanel,
  OperationalRunListPanel,
} from "../operations";
import { createSurfaceResponsiveProfile } from "../responsive";

describe("Operational run visibility and status rendering", () => {
  it("renders run list entries from queue and persisted run history", () => {
    const responsiveProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 1200 });
    const html = renderToStaticMarkup(
      React.createElement(OperationalRunListPanel, {
        queueItems: Object.freeze([
          Object.freeze({
            queueItemId: "queue:1",
            executionId: "run:queued",
            systemId: "system:alpha",
            status: "queued",
            enqueuedAt: "2026-04-07T12:00:00.000Z",
          }),
          Object.freeze({
            queueItemId: "queue:2",
            executionId: "run:running",
            systemId: "system:beta",
            status: "running",
            enqueuedAt: "2026-04-07T12:01:00.000Z",
            startedAt: "2026-04-07T12:02:00.000Z",
          }),
        ]),
        recentRuns: Object.freeze([
          Object.freeze({
            runId: "run:running",
            planId: "plan:running",
            status: "running",
            statusLabel: "Running",
            statusTone: "info",
            completedUnits: 1,
            totalUnits: 3,
            progressPercent: 33,
            progressLabel: "1/3 units",
            executionPathLabel: "Real execution",
            startedAt: "2026-04-07T12:02:00.000Z",
            updatedAt: "2026-04-07T12:03:00.000Z",
            durationSummary: "1m",
          }),
          Object.freeze({
            runId: "run:completed",
            planId: "plan:completed",
            status: "completed",
            statusLabel: "Completed",
            statusTone: "success",
            completedUnits: 3,
            totalUnits: 3,
            progressPercent: 100,
            progressLabel: "3/3 units",
            executionPathLabel: "Real execution",
            startedAt: "2026-04-07T11:58:00.000Z",
            updatedAt: "2026-04-07T12:00:00.000Z",
            durationSummary: "2m",
          }),
        ]),
        selectedExecutionId: "run:running",
        isQueueLoading: false,
        realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
        responsiveProfile,
        actorPermissionIds: Object.freeze(["runtime.run.inspect", "runtime.queue.refresh", "runtime.run.cancel", "runtime.queue.manage"]),
        surface: "desktop",
        onRefreshQueue: () => undefined,
        onInspectRun: () => undefined,
        onCancelRun: () => undefined,
        onDequeue: () => undefined,
      }),
    );

    expect(html).toContain("Run list");
    expect(html).toContain("run:queued");
    expect(html).toContain("run:running");
    expect(html).toContain("run:completed");
    expect(html).toContain("Live updates: Connected");
    expect(html).toContain("Row actions");
    expect(html).toContain("ui-responsive-table__table");
    expect(html).toContain("data-label=\"Execution\"");
    expect(html).toContain("data-label=\"Actions\"");
  });

  it("renders status changes in the run detail panel", () => {
    const responsiveProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 800 });

    const runningHtml = renderToStaticMarkup(
      React.createElement(OperationalRunDetailStatusPanel, {
        selectedExecutionId: "run:1",
        inspection: Object.freeze({
          executionId: "run:1",
          status: "running",
          progressLabel: "2/5 nodes",
          diagnosticsCount: 1,
          traceEventCount: 3,
          traceLogCount: 4,
          outputFieldCount: 0,
          outputContractIds: Object.freeze([]),
        }),
        runDetail: createRunDetailProjection("running", "Running", "info"),
        isLoading: false,
        realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
        responsiveProfile,
        actorPermissionIds: Object.freeze(["runtime.run.inspect", "runtime.run.cancel"]),
        surface: "thin-client",
        onRefresh: () => undefined,
        onCancel: () => undefined,
      }),
    );

    const failedHtml = renderToStaticMarkup(
      React.createElement(OperationalRunDetailStatusPanel, {
        selectedExecutionId: "run:1",
        inspection: Object.freeze({
          executionId: "run:1",
          status: "failed",
          progressLabel: "3/5 nodes",
          diagnosticsCount: 2,
          traceEventCount: 5,
          traceLogCount: 6,
          outputFieldCount: 0,
          outputContractIds: Object.freeze([]),
        }),
        runDetail: createRunDetailProjection("failed", "Failed", "danger"),
        isLoading: false,
        realtimeConnectionState: Object.freeze({ state: "degraded", stale: true, detail: "Reconnecting." }),
        responsiveProfile,
        actorPermissionIds: Object.freeze(["runtime.run.inspect", "runtime.run.cancel"]),
        surface: "thin-client",
        onRefresh: () => undefined,
        onCancel: () => undefined,
      }),
    );

    expect(runningHtml).toContain("Run detail and status");
    expect(runningHtml).toContain("2/5 nodes");
    expect(runningHtml).toContain("running");
    expect(runningHtml).toContain("Live updates: Connected");
    expect(failedHtml).toContain("failed");
    expect(failedHtml).toContain("Live updates: Degraded (stale)");
    expect(failedHtml).toContain("Execution timeline");
  });
});

function createRunDetailProjection(
  status: "running" | "failed",
  statusLabel: string,
  statusTone: "info" | "danger",
) {
  return Object.freeze({
    summary: Object.freeze({
      runId: "run:1",
      planId: "plan:1",
      executionKind: "workflow",
      executionFlowId: "flow:1",
      status,
      statusLabel,
      statusTone,
      completedUnits: status === "running" ? 2 : 3,
      totalUnits: 5,
      progressPercent: status === "running" ? 40 : 60,
      progressLabel: status === "running" ? "2/5 units" : "3/5 units",
      executionPathLabel: "Real execution",
      startedAt: "2026-04-07T12:00:00.000Z",
      updatedAt: "2026-04-07T12:05:00.000Z",
      durationSummary: "5m",
      executionPathDetail: undefined,
      metadataSummary: undefined,
    }),
    runId: "run:1",
    planId: "plan:1",
    executionKind: "workflow",
    status,
    cancellationSupported: true,
    startedAt: "2026-04-07T12:00:00.000Z",
    updatedAt: "2026-04-07T12:05:00.000Z",
    completedAt: status === "failed" ? "2026-04-07T12:05:00.000Z" : undefined,
    durationSummary: "5m",
    metadata: Object.freeze([]),
    runLevelMetadata: Object.freeze([]),
    terminalSummary: status === "failed" ? "Terminal failure" : undefined,
    diagnosticsSummary: status === "failed" ? "error: workflow failure" : undefined,
    diagnostics: Object.freeze([]),
    executionPathLabel: "Real execution",
    executionPathDetail: undefined,
    provenanceEntries: Object.freeze([]),
    artifactSummary: undefined,
    units: Object.freeze([]),
    timeline: Object.freeze([
      Object.freeze({
        unitId: "unit:1",
        unitLabel: "Step 1",
        fromStatus: "Running",
        toStatus: status === "failed" ? "Failed" : "Running",
        message: status === "failed" ? "Runtime failure." : "Still running.",
        provenanceDetail: undefined,
        diagnosticsSummary: undefined,
        occurredAt: "2026-04-07T12:04:00.000Z",
      }),
    ]),
  });
}
