import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createOfflineSynchronizationStateSnapshot } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import DesktopOfflineStatusSurface from "../connectivity/DesktopOfflineStatusSurface";

describe("DesktopOfflineStatusSurface", () => {
  it("renders connectivity, pending sync, cache, and policy guidance panels", () => {
    const snapshot = createOfflineSynchronizationStateSnapshot({
      workspaceId: "workspace:desktop-status",
      cachedResources: Object.freeze([{
        resourceClass: "workflow-definition",
        resourceId: "workflow:1",
        authoritativeRevision: "rev:1",
        cachedRevision: "rev:1",
        cachedAt: "2026-04-07T10:00:00.000Z",
        freshness: "fresh",
      }]),
      drafts: Object.freeze([]),
      queue: Object.freeze({
        queueId: "queue:desktop-status",
        operations: Object.freeze([]),
        localExecutionRegistrations: Object.freeze([]),
        pendingRunSubmissions: Object.freeze([]),
        outcomes: Object.freeze([]),
        updatedAt: "2026-04-07T10:01:00.000Z",
      }),
      connectivity: Object.freeze({
        state: "reconnecting",
        stale: false,
        localModeActive: false,
        detail: "Retrying trusted session",
        lastChangedAt: "2026-04-07T10:02:00.000Z",
        canQueueOperations: true,
        canResynchronize: false,
      }),
    });

    const html = renderToStaticMarkup(
      React.createElement(DesktopOfflineStatusSurface, {
        snapshot,
        isLoading: false,
        isTogglingOfflineMode: false,
        onRefresh: () => undefined,
        onToggleOfflineMode: () => undefined,
      }),
    );

    expect(html).toContain("desktop-offline-status-surface");
    expect(html).toContain("Reconnecting to authoritative services");
    expect(html).toContain("Pending sync");
    expect(html).toContain("Cached resources");
    expect(html).toContain("Policy-limited actions");
    expect(html).toContain("Go offline");
  });
});
