import { describe, expect, it } from "bun:test";
import { createOfflineSynchronizationStateSnapshot } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { buildDesktopOfflineStatusSurfaceModel } from "../DesktopOfflineStatusPresenter";

describe("DesktopOfflineStatusPresenter", () => {
  it("presents connected but unsynced status explicitly", () => {
    const snapshot = createOfflineSynchronizationStateSnapshot({
      workspaceId: "workspace:connected-unsynced",
      cachedResources: Object.freeze([]),
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
        queueId: "queue:connected-unsynced",
        operations: Object.freeze([{
          operationId: "op:1",
          targetResourceClass: "workflow-draft",
          targetResourceId: "workflow:1",
          intent: "promote-local-draft",
          baseAuthoritativeRevision: "rev:1",
          localMutationRevision: 2,
          queuedAt: "2026-04-07T10:00:00.000Z",
          userVisibleSyncStatus: "queued-pending-sync",
          divergenceDisclosureToken: "token",
          replayDescriptor: {
            method: "PATCH",
            path: "/v1/workflows/workflow:1",
            idempotencyKey: "idem",
            payload: Object.freeze({ name: "updated" }),
          },
          retryCount: 0,
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
        state: "connected",
        stale: false,
        localModeActive: false,
        lastChangedAt: "2026-04-07T10:02:00.000Z",
        canQueueOperations: true,
        canResynchronize: true,
      }),
    });

    const model = buildDesktopOfflineStatusSurfaceModel(snapshot);
    expect(model.banner.title).toBe("Connected with unsynced local changes");
    expect(model.synchronization.pendingCount).toBe(1);
    expect(model.drafts.unsyncedCount).toBe(1);
    expect(model.conflicts.totalCount).toBe(1);
    expect(model.replayOutcomes.reviewRequiredCount).toBe(1);
    expect(model.followUp.limitations.some((entry) => entry.includes("Unsupported auto-merge scenarios"))).toBe(true);
    expect(model.actions.offlineModeToggleLabel).toBe("Go offline");
  });

  it("presents offline blocked policies and unsupported actions", () => {
    const snapshot = createOfflineSynchronizationStateSnapshot({
      workspaceId: "workspace:offline",
      cachedResources: Object.freeze([]),
      drafts: Object.freeze([]),
      queue: Object.freeze({
        queueId: "queue:offline",
        operations: Object.freeze([]),
        localExecutionRegistrations: Object.freeze([]),
        pendingRunSubmissions: Object.freeze([{
          submissionId: "submission:1",
          operationId: "operation:1",
          workflowDefinitionId: "workflow:1",
          inputDigest: "digest",
          requestedAt: "2026-04-07T10:00:00.000Z",
          requestedByActorUserIdentityId: "actor:1",
        }]),
        outcomes: Object.freeze([]),
        updatedAt: "2026-04-07T10:01:00.000Z",
      }),
      connectivity: Object.freeze({
        state: "disconnected",
        stale: true,
        localModeActive: true,
        detail: "Manual offline mode enabled",
        lastChangedAt: "2026-04-07T10:02:00.000Z",
        canQueueOperations: false,
        canResynchronize: false,
      }),
    });

    const model = buildDesktopOfflineStatusSurfaceModel(snapshot);
    expect(model.connectivity.label).toBe("Offline (local mode)");
    expect(model.banner.title).toBe("Offline local mode is active");
    expect(model.synchronization.pendingRunSubmissionCount).toBe(1);
    expect(model.policy.unsupportedActions.length).toBe(2);
    expect(model.followUp.actions.find((entry) => entry.actionKey === "sync-conflicts")?.enabled).toBe(false);
    expect(model.actions.offlineModeToggleLabel).toBe("Return online");
  });
});
