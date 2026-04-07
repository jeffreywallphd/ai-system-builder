import { describe, expect, it } from "bun:test";
import {
  OfflineConnectivityStates,
  OfflineDraftSyncStatuses,
  OfflinePendingOperationIntents,
  OfflinePendingOperationStatuses,
  OfflineSyncResourceClasses,
  OfflineSynchronizationStates,
  createOfflineSynchronizationStateSnapshot,
  deriveOfflineSynchronizationStatus,
  transitionOfflineDraftSyncStatus,
  transitionOfflinePendingOperationStatus,
} from "../OfflineSynchronizationContracts";

describe("OfflineSynchronizationContracts", () => {
  it("derives blocked conflict status when queue includes conflict entries", () => {
    const status = deriveOfflineSynchronizationStatus({
      queue: {
        queueId: "offline-sync:workspace-alpha",
        operations: [{
          operationId: "operation:1",
          targetResourceClass: OfflineSyncResourceClasses.workflowDraft,
          targetResourceId: "workflow:draft:1",
          intent: OfflinePendingOperationIntents.promoteLocalDraft,
          baseAuthoritativeRevision: "rev:1",
          localMutationRevision: 2,
          queuedAt: "2026-04-07T00:00:00.000Z",
          userVisibleSyncStatus: OfflinePendingOperationStatuses.syncConflict,
          divergenceDisclosureToken: "offline-warning:workflow:draft:1",
          replayDescriptor: {
            method: "PATCH",
            path: "/v1/workflows/drafts/workflow:draft:1/promote",
            idempotencyKey: "idem:operation:1",
            payload: { draftId: "workflow:draft:1" },
          },
          retryCount: 1,
        }],
        pendingRunSubmissions: [],
        outcomes: [],
        updatedAt: "2026-04-07T00:00:01.000Z",
      },
      connectivity: {
        state: OfflineConnectivityStates.connected,
        stale: false,
        localModeActive: false,
        lastChangedAt: "2026-04-07T00:00:02.000Z",
        canQueueOperations: true,
        canResynchronize: true,
      },
    });

    expect(status.state).toBe(OfflineSynchronizationStates.blockedConflict);
    expect(status.conflictCount).toBe(1);
    expect(status.pendingOperationCount).toBe(0);
  });

  it("builds versioned snapshot payloads", () => {
    const snapshot = createOfflineSynchronizationStateSnapshot({
      workspaceId: "workspace:alpha",
      cachedResources: [{
        resourceClass: OfflineSyncResourceClasses.workflowDefinition,
        resourceId: "workflow:definition:1",
        authoritativeRevision: "rev:10",
        cachedRevision: "rev:10",
        cachedAt: "2026-04-07T00:00:00.000Z",
        freshness: "fresh",
      }],
      drafts: [],
      queue: {
        queueId: "offline-sync:workspace-alpha",
        operations: [],
        pendingRunSubmissions: [],
        outcomes: [],
        updatedAt: "2026-04-07T00:00:01.000Z",
      },
      connectivity: {
        state: OfflineConnectivityStates.disconnected,
        stale: true,
        localModeActive: true,
        lastChangedAt: "2026-04-07T00:00:02.000Z",
        canQueueOperations: true,
        canResynchronize: false,
      },
    });

    expect(snapshot.contractVersion).toBe("offline-sync/v1");
    expect(snapshot.status.state).toBe(OfflineSynchronizationStates.idle);
    expect(snapshot.connectivity.localModeActive).toBeTrue();
  });

  it("enforces explicit draft sync transitions", () => {
    const transitioned = transitionOfflineDraftSyncStatus({
      draft: {
        draftId: "draft:1",
        resourceClass: OfflineSyncResourceClasses.workflowDraft,
        resourceId: "workflow:draft:1",
        baseAuthoritativeRevision: "rev:1",
        authoritativeSnapshotRevision: "rev:1",
        draftRevision: 1,
        syncStatus: OfflineDraftSyncStatuses.localOnly,
        dirty: true,
        lastEditedAt: "2026-04-07T00:00:00.000Z",
        lastEditedByActorUserIdentityId: "user:1",
        localChanges: [],
      },
      nextStatus: OfflineDraftSyncStatuses.queuedPendingSync,
      queuedMutationId: "operation:1",
    });

    expect(transitioned.syncStatus).toBe(OfflineDraftSyncStatuses.queuedPendingSync);
    expect(transitioned.queuedMutationId).toBe("operation:1");
  });

  it("enforces explicit pending operation status transitions", () => {
    const transitioned = transitionOfflinePendingOperationStatus({
      operation: {
        operationId: "operation:2",
        targetResourceClass: OfflineSyncResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:1",
        intent: OfflinePendingOperationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "rev:1",
        localMutationRevision: 2,
        queuedAt: "2026-04-07T00:00:00.000Z",
        userVisibleSyncStatus: OfflinePendingOperationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:workflow:draft:1",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:1/promote",
          idempotencyKey: "idem:operation:2",
          payload: { draftId: "workflow:draft:1" },
        },
        retryCount: 0,
      },
      nextStatus: OfflinePendingOperationStatuses.syncConflict,
      retryCount: 1,
      lastAttemptedAt: "2026-04-07T00:01:00.000Z",
    });

    expect(transitioned.userVisibleSyncStatus).toBe(OfflinePendingOperationStatuses.syncConflict);
    expect(transitioned.retryCount).toBe(1);
  });
});
