import { describe, expect, it } from "bun:test";
import { createOfflineSynchronizationStateSnapshot } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { buildDesktopOfflineStatusSurfaceModel } from "../DesktopOfflineStatusPresenter";

describe("DesktopOfflineStatusPresenter", () => {
  it("presents connected but unsynced status explicitly", () => {
    const snapshot = createOfflineSynchronizationStateSnapshot({
      workspaceId: "workspace:connected-unsynced",
      cachedResources: Object.freeze([]),
      drafts: Object.freeze([]),
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
        outcomes: Object.freeze([]),
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
    expect(model.actions.offlineModeToggleLabel).toBe("Return online");
  });
});
