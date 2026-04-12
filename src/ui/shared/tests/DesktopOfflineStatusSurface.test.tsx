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
      drafts: Object.freeze([{
        draftId: "draft:1",
        resourceClass: "workflow-draft",
        resourceId: "workflow:1",
        baseAuthoritativeRevision: "rev:1",
        authoritativeSnapshotRevision: "rev:1",
        draftRevision: 2,
        syncStatus: "sync-conflict",
        queuedMutationId: "op:1",
        dirty: true,
        lastEditedAt: "2026-04-07T10:00:30.000Z",
        lastEditedByActorUserIdentityId: "actor:1",
        localChanges: Object.freeze([{
          changeId: "change:1",
          draftId: "draft:1",
          resourceId: "workflow:1",
          kind: "update",
          changedAt: "2026-04-07T10:00:30.000Z",
          changedByActorUserIdentityId: "actor:1",
          summary: "Adjusted workflow step order",
        }]),
      }]),
      queue: Object.freeze({
        queueId: "queue:desktop-status",
        operations: Object.freeze([{
          operationId: "op:1",
          targetResourceClass: "workflow-draft",
          targetResourceId: "workflow:1",
          intent: "promote-local-draft",
          baseAuthoritativeRevision: "rev:1",
          localMutationRevision: 2,
          queuedAt: "2026-04-07T10:00:00.000Z",
          userVisibleSyncStatus: "sync-conflict",
          divergenceDisclosureToken: "token",
          replayDescriptor: {
            method: "PATCH",
            path: "/v1/workflows/workflow:1",
            idempotencyKey: "idem",
            payload: Object.freeze({ name: "updated" }),
          },
          retryCount: 1,
          lastAttemptedAt: "2026-04-07T10:01:00.000Z",
        }]),
        localExecutionRegistrations: Object.freeze([]),
        pendingRunSubmissions: Object.freeze([]),
        outcomes: Object.freeze([{
          operationId: "op:1",
          action: "conflict-requires-review",
          requiresUserAttention: true,
          requiresAdminAttention: false,
          preserveLocalDraftAsUnsynced: true,
          decisionRule: "preserve-unsynced-draft-and-require-user-review",
          reason: "Authoritative revision changed during offline edits.",
          resolvedAt: "2026-04-07T10:01:30.000Z",
          conflicts: Object.freeze([{
            operationId: "op:1",
            resourceClass: "workflow-draft",
            resourceId: "workflow:1",
            severity: "high",
            conflictClass: "stale-base-edit",
            conflictCode: "authoritative-revision-mismatch",
            summary: "Base revision no longer matches authoritative state.",
            authoritativeRevision: "rev:2",
            localMutationRevision: 2,
            detectedAt: "2026-04-07T10:01:30.000Z",
            requiresUserAttention: true,
          }]),
        }]),
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
    expect(html).toContain("Preserved drafts");
    expect(html).toContain("Sync conflicts");
    expect(html).toContain("Replay outcomes");
    expect(html).toContain("Recovery actions");
    expect(html).toContain("Review preserved drafts");
    expect(html).toContain("Reconciliation limits");
    expect(html).toContain("Unsupported auto-merge scenarios remain manual");
    expect(html).toContain("Go offline");
  });
});
