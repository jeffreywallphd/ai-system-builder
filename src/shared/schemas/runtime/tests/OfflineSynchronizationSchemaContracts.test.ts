import { describe, expect, it } from "bun:test";
import {
  OfflineSynchronizationSchemaValidationError,
  parseOfflineConnectivitySurfaceStateDto,
  parseOfflineSynchronizationStateSnapshotDto,
  parseOfflineSynchronizationStateWriteRequestDto,
} from "../OfflineSynchronizationSchemaContracts";

describe("OfflineSynchronizationSchemaContracts", () => {
  it("parses canonical offline synchronization snapshots", () => {
    const parsed = parseOfflineSynchronizationStateSnapshotDto({
      contractVersion: "offline-sync/v1",
      workspaceId: "workspace:alpha",
      cachedResources: [{
        resourceClass: "workflow-definition",
        resourceId: "workflow:definition:1",
        authoritativeRevision: "rev:9",
        cachedRevision: "rev:9",
        cachedAt: "2026-04-07T10:00:00.000Z",
        freshness: "fresh",
      }],
      drafts: [{
        draftId: "draft:workflow:1",
        resourceClass: "workflow-draft",
        resourceId: "workflow:draft:1",
        baseAuthoritativeRevision: "rev:9",
        draftRevision: 2,
        dirty: true,
        lastEditedAt: "2026-04-07T10:01:00.000Z",
        lastEditedByActorUserIdentityId: "user:author-1",
        localChanges: [{
          changeId: "change:1",
          draftId: "draft:workflow:1",
          resourceId: "workflow:draft:1",
          kind: "update",
          changedAt: "2026-04-07T10:01:00.000Z",
          changedByActorUserIdentityId: "user:author-1",
          summary: "Updated prompt template",
        }],
      }],
      queue: {
        queueId: "offline-sync:workspace-alpha",
        operations: [{
          operationId: "operation:1",
          targetResourceClass: "workflow-draft",
          targetResourceId: "workflow:draft:1",
          intent: "promote-local-draft",
          baseAuthoritativeRevision: "rev:9",
          localMutationRevision: 2,
          queuedAt: "2026-04-07T10:02:00.000Z",
          userVisibleSyncStatus: "queued-pending-sync",
          divergenceDisclosureToken: "offline-warning:workflow:draft:1",
          retryCount: 0,
        }],
        outcomes: [],
        updatedAt: "2026-04-07T10:02:01.000Z",
      },
      status: {
        state: "synchronizing",
        pendingOperationCount: 1,
        conflictCount: 0,
        rejectedCount: 0,
        lastAttemptedAt: "2026-04-07T10:02:02.000Z",
      },
      connectivity: {
        state: "connected",
        stale: false,
        localModeActive: false,
        lastChangedAt: "2026-04-07T10:02:03.000Z",
        canQueueOperations: true,
        canResynchronize: true,
      },
    });

    expect(parsed.workspaceId).toBe("workspace:alpha");
    expect(parsed.status.pendingOperationCount).toBe(1);
  });

  it("rejects disconnected connectivity snapshots that still claim canResynchronize=true", () => {
    expect(() => parseOfflineConnectivitySurfaceStateDto({
      state: "disconnected",
      stale: true,
      localModeActive: true,
      lastChangedAt: "2026-04-07T10:03:00.000Z",
      canQueueOperations: true,
      canResynchronize: true,
    })).toThrow(OfflineSynchronizationSchemaValidationError);
  });

  it("rejects queue snapshots that keep sync-applied operations in pending queue", () => {
    expect(() => parseOfflineSynchronizationStateSnapshotDto({
      contractVersion: "offline-sync/v1",
      workspaceId: "workspace:alpha",
      cachedResources: [],
      drafts: [],
      queue: {
        queueId: "offline-sync:workspace-alpha",
        operations: [{
          operationId: "operation:applied:1",
          targetResourceClass: "run-submission-intent",
          targetResourceId: "run:intent:1",
          intent: "create-or-update-authoritative",
          baseAuthoritativeRevision: "rev:1",
          localMutationRevision: 1,
          queuedAt: "2026-04-07T10:03:00.000Z",
          userVisibleSyncStatus: "sync-applied",
          divergenceDisclosureToken: "offline-warning:run:intent:1",
          retryCount: 0,
        }],
        outcomes: [],
        updatedAt: "2026-04-07T10:03:01.000Z",
      },
      status: {
        state: "idle",
        pendingOperationCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
      },
      connectivity: {
        state: "connected",
        stale: false,
        localModeActive: false,
        lastChangedAt: "2026-04-07T10:03:02.000Z",
        canQueueOperations: true,
        canResynchronize: true,
      },
    })).toThrow(OfflineSynchronizationSchemaValidationError);
  });

  it("rejects write requests when request workspaceId does not match state workspaceId", () => {
    expect(() => parseOfflineSynchronizationStateWriteRequestDto({
      workspaceId: "workspace:beta",
      state: {
        contractVersion: "offline-sync/v1",
        workspaceId: "workspace:alpha",
        cachedResources: [],
        drafts: [],
        queue: {
          queueId: "offline-sync:workspace-alpha",
          operations: [],
          outcomes: [],
          updatedAt: "2026-04-07T10:04:00.000Z",
        },
        status: {
          state: "idle",
          pendingOperationCount: 0,
          conflictCount: 0,
          rejectedCount: 0,
        },
        connectivity: {
          state: "disconnected",
          stale: true,
          localModeActive: true,
          lastChangedAt: "2026-04-07T10:04:01.000Z",
          canQueueOperations: true,
          canResynchronize: false,
        },
      },
    })).toThrow(OfflineSynchronizationSchemaValidationError);
  });
});
