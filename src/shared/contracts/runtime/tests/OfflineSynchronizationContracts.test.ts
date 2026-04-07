import { describe, expect, it } from "bun:test";
import {
  OfflineConnectivityStates,
  OfflinePendingOperationIntents,
  OfflinePendingOperationStatuses,
  OfflineSyncResourceClasses,
  OfflineSynchronizationStates,
  createOfflineSynchronizationStateSnapshot,
  deriveOfflineSynchronizationStatus,
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
          retryCount: 1,
        }],
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
});
