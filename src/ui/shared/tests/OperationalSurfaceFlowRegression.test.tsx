import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { buildOperationalWorkspaceDashboardModel } from "../../presenters/OperationalWorkspaceDashboardPresenter";
import {
  OperationalApprovedRunLaunchPanel,
  OperationalQueueDetailPanel,
  OperationalQueueVisibilityPanel,
  OperationalRealtimeBanner,
  OperationalResultReviewPanels,
  OperationalRunDetailStatusPanel,
  OperationalRunListPanel,
  OperationalWorkspaceDashboard,
  QueueVisibilityScopes,
} from "../operations";
import { createSurfaceResponsiveProfile } from "../responsive";

describe("Operational surface flow regression", () => {
  it("renders prioritized operational flow surfaces in a shared desktop composition", () => {
    const queueItems = createQueueItems();
    const runs = createRuns();
    const outputs = createOutputs();
    const model = buildOperationalWorkspaceDashboardModel({
      queueItems,
      recentRuns: runs,
      recentOutputs: outputs,
      nodeInventory: Object.freeze([]),
      realtime: Object.freeze({ state: "connected", stale: false }),
    });
    const profile = createSurfaceResponsiveProfile({ viewportWidthPx: 1280 });

    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined,
        React.createElement("div", undefined,
          React.createElement(OperationalRealtimeBanner, {
            connectionState: Object.freeze({ state: "connected", stale: false }),
            onRefresh: () => undefined,
            onReconnect: () => undefined,
          }),
          React.createElement(OperationalWorkspaceDashboard, {
            model,
            queueItems,
            recentRuns: runs,
            recentOutputs: outputs,
            isQueueLoading: false,
            isRecentOutputsLoading: false,
            realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.queue.refresh", "runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
            surface: "desktop",
            onRefreshQueue: () => undefined,
            onInspectRun: () => undefined,
            onCancelRun: () => undefined,
            onDequeue: () => undefined,
            onOpenNodeInventory: () => undefined,
          }),
          React.createElement(OperationalRunListPanel, {
            queueItems,
            recentRuns: runs,
            selectedExecutionId: "run:running",
            isQueueLoading: false,
            realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.queue.refresh", "runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
            surface: "desktop",
            onRefreshQueue: () => undefined,
            onInspectRun: () => undefined,
            onCancelRun: () => undefined,
            onDequeue: () => undefined,
          }),
          React.createElement(OperationalRunDetailStatusPanel, {
            selectedExecutionId: "run:running",
            inspection: Object.freeze({
              executionId: "run:running",
              status: "running",
              progressLabel: "2/4 nodes",
              diagnosticsCount: 1,
              traceEventCount: 3,
              traceLogCount: 4,
              outputFieldCount: 1,
              outputContractIds: Object.freeze(["contract:1"]),
            }),
            isLoading: false,
            realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.run.inspect", "runtime.run.cancel"]),
            surface: "desktop",
            onRefresh: () => undefined,
            onCancel: () => undefined,
          }),
          React.createElement(OperationalQueueVisibilityPanel, {
            queueItems,
            totalCount: queueItems.length,
            selectedQueueItemId: "queue:running",
            filters: Object.freeze({
              visibilityScope: QueueVisibilityScopes.active,
              systemIdFilter: "",
              queryFilter: "",
            }),
            isLoading: false,
            realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.queue.refresh", "runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
            surface: "desktop",
            onFiltersChanged: () => undefined,
            onRefreshQueue: () => undefined,
            onInspectRun: () => undefined,
            onCancelRun: () => undefined,
            onDequeue: () => undefined,
            onSelectQueueItem: () => undefined,
          }),
          React.createElement(OperationalQueueDetailPanel, {
            queueItems,
            selectedQueueItemId: "queue:running",
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.queue.refresh", "runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
            surface: "desktop",
            isLoading: false,
            realtimeConnectionState: Object.freeze({ state: "connected", stale: false }),
            onRefreshQueue: () => undefined,
            onInspectRun: () => undefined,
            onCancelRun: () => undefined,
            onDequeue: () => undefined,
          }),
          React.createElement(OperationalApprovedRunLaunchPanel, {
            responsiveProfile: profile,
            surface: "desktop",
            openSystemRunnerPath: "/build/system",
            onSubmit: async () => ({
              ok: false,
              error: { code: "invalid-request", message: "Validation failed." },
            }),
          }),
          React.createElement(OperationalResultReviewPanels, {
            entries: outputs,
            selectedExecutionId: "run:running",
            detailIsLoading: false,
            responsiveProfile: profile,
            onSelectExecution: () => undefined,
            onRequestPreview: () => undefined,
            onRequestDownload: () => undefined,
          }))),
    );

    expect(html).toContain("Actionable alerts");
    expect(html).toContain("Run list");
    expect(html).toContain("Run detail and status");
    expect(html).toContain("Queue visibility");
    expect(html).toContain("Queue detail");
    expect(html).toContain("Approved run initiation");
    expect(html).toContain("Result and output review");
    expect(html).toContain("Live updates: Connected");
  });

  it("keeps thin-client mobile flow consistent for reconnect, queue actions, launch, and output review", () => {
    const queueItems = createQueueItems();
    const outputs = createOutputs();
    const profile = createSurfaceResponsiveProfile({ viewportWidthPx: 420 });
    const model = buildOperationalWorkspaceDashboardModel({
      queueItems,
      recentRuns: Object.freeze([]),
      recentOutputs: outputs,
      nodeInventory: Object.freeze([]),
      realtime: Object.freeze({ state: "reconnecting", stale: true }),
    });

    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined,
        React.createElement("div", undefined,
          React.createElement(OperationalRealtimeBanner, {
            connectionState: Object.freeze({ state: "reconnecting", stale: true, detail: "Socket closed unexpectedly." }),
            onRefresh: () => undefined,
            onReconnect: () => undefined,
          }),
          React.createElement(OperationalWorkspaceDashboard, {
            model,
            queueItems,
            recentRuns: Object.freeze([]),
            recentOutputs: outputs,
            isQueueLoading: false,
            isRecentOutputsLoading: false,
            realtimeConnectionState: Object.freeze({ state: "reconnecting", stale: true }),
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.queue.refresh", "runtime.run.inspect"]),
            surface: "thin-client",
            onRefreshQueue: () => undefined,
            onInspectRun: () => undefined,
            onCancelRun: () => undefined,
            onDequeue: () => undefined,
            onOpenNodeInventory: () => undefined,
          }),
          React.createElement(OperationalRunListPanel, {
            queueItems,
            recentRuns: Object.freeze([]),
            selectedExecutionId: "run:queued",
            isQueueLoading: false,
            realtimeConnectionState: Object.freeze({ state: "reconnecting", stale: true }),
            responsiveProfile: profile,
            actorPermissionIds: Object.freeze(["runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
            surface: "thin-client",
            onRefreshQueue: () => undefined,
            onInspectRun: () => undefined,
            onCancelRun: () => undefined,
            onDequeue: () => undefined,
          }),
          React.createElement(OperationalApprovedRunLaunchPanel, {
            responsiveProfile: profile,
            surface: "thin-client",
            openSystemRunnerPath: "/build/system",
            onSubmit: async () => ({
              ok: false,
              error: { code: "invalid-request", message: "Validation failed." },
            }),
          }),
          React.createElement(OperationalResultReviewPanels, {
            entries: outputs,
            selectedExecutionId: "run:running",
            detailIsLoading: false,
            responsiveProfile: profile,
            onSelectExecution: () => undefined,
            onRequestPreview: () => undefined,
            onRequestDownload: () => undefined,
          }))),
    );

    expect(html).toContain("Reconnecting");
    expect(html).toContain("stale data fallback active");
    expect(html).toContain("Step 1: Provide approved run identifiers and bounded parameters.");
    expect(html).toContain("Step 1: Select a run output card.");
    expect(html).toContain("ui-action-list");
    expect(html).toContain("Inspect run");
    expect(html).not.toContain("Cancel run");
    expect(html).not.toContain("Dequeue");
  });
});

function createQueueItems() {
  return Object.freeze([
    Object.freeze({
      queueItemId: "queue:running",
      executionId: "run:running",
      systemId: "system:alpha",
      status: "running",
      enqueuedAt: "2026-04-07T11:58:00.000Z",
      startedAt: "2026-04-07T12:00:00.000Z",
      priority: 10,
    }),
    Object.freeze({
      queueItemId: "queue:queued",
      executionId: "run:queued",
      systemId: "system:beta",
      status: "queued",
      enqueuedAt: "2026-04-07T12:01:00.000Z",
      priority: 20,
    }),
  ]);
}

function createRuns() {
  return Object.freeze([
    Object.freeze({
      runId: "run:running",
      planId: "plan:running",
      status: "running",
      statusLabel: "Running",
      statusTone: "info",
      completedUnits: 2,
      totalUnits: 4,
      progressPercent: 50,
      progressLabel: "2/4 units",
      executionPathLabel: "Real execution",
      startedAt: "2026-04-07T12:00:00.000Z",
      updatedAt: "2026-04-07T12:03:00.000Z",
      durationSummary: "3m",
    }),
  ]);
}

function createOutputs() {
  return Object.freeze([
    Object.freeze({
      executionId: "run:running",
      status: "running",
      rootAssetId: "asset:root:running",
      rootVersionId: "asset:root:running:v1",
      outputFieldCount: 1,
      outputContractIds: Object.freeze(["contract:1"]),
      outputAssetIds: Object.freeze(["asset:output:1"]),
    }),
  ]);
}
