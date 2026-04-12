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
        authoritativeSnapshotRevision: "rev:9",
        draftRevision: 2,
        syncStatus: "queued-pending-sync",
        queuedMutationId: "operation:1",
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
          replayDescriptor: {
            method: "PATCH",
            path: "/v1/workflows/drafts/workflow:draft:1/promote",
            idempotencyKey: "idem:operation:1",
            payload: { draftId: "workflow:draft:1" },
          },
          retryCount: 0,
        }],
        localExecutionRegistrations: [{
          registrationId: "registration:execution:1",
          execution: {
            executionId: "execution:1",
            executionClass: "local-workflow-preview",
            resourceClass: "local-runtime-session",
            resourceId: "runtime:session:1",
            startedAt: "2026-04-07T10:01:30.000Z",
            completedAt: "2026-04-07T10:01:50.000Z",
            executedByActorUserIdentityId: "user:author-1",
            nodeOperationalMode: "workstation-client",
            workstationMode: "interactive-user-session",
            outcome: "succeeded",
            inputDigest: "sha256:execution:input:1",
            outputs: [{
              outputId: "output:execution:1",
              outputClass: "preview-artifact",
              contentDigest: "sha256:execution:output:1",
              sizeBytes: 64,
            }],
            historyScope: "explicit-local-activity",
          },
          queuedAt: "2026-04-07T10:02:10.000Z",
          userVisibleRegistrationStatus: "queued-pending-registration",
          divergenceDisclosureToken: "offline-warning:execution:1",
          replayDescriptor: {
            method: "POST",
            path: "/v1/offline/local-executions/execution:1/register",
            idempotencyKey: "idem:registration:execution:1",
            payload: { executionId: "execution:1" },
          },
          retryCount: 0,
        }],
        pendingRunSubmissions: [{
          submissionId: "submission:1",
          operationId: "operation:1",
          workflowDefinitionId: "workflow:definition:1",
          inputDigest: "sha256:abc123",
          requestedAt: "2026-04-07T10:02:00.000Z",
          requestedByActorUserIdentityId: "user:author-1",
        }],
        outcomes: [],
        updatedAt: "2026-04-07T10:02:01.000Z",
      },
      status: {
        state: "synchronizing",
        pendingOperationCount: 2,
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
    expect(parsed.status.pendingOperationCount).toBe(2);
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

  it("parses structured desktop connectivity semantics for deliberate offline mode", () => {
    const parsed = parseOfflineConnectivitySurfaceStateDto({
      state: "disconnected",
      stale: true,
      localModeActive: true,
      reasonCode: "offline-mode-deliberate",
      offlineModeIntent: "deliberate",
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "required",
      lastChangedAt: "2026-04-07T10:03:10.000Z",
      canQueueOperations: true,
      canResynchronize: false,
    });

    expect(parsed.offlineModeIntent).toBe("deliberate");
    expect(parsed.reasonCode).toBe("offline-mode-deliberate");
  });

  it("rejects deliberate offline-mode intent when state is not disconnected", () => {
    expect(() => parseOfflineConnectivitySurfaceStateDto({
      state: "connected",
      stale: false,
      localModeActive: false,
      offlineModeIntent: "deliberate",
      lastChangedAt: "2026-04-07T10:03:11.000Z",
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
          replayDescriptor: {
            method: "POST",
            path: "/v1/runs/intents/run:intent:1",
            idempotencyKey: "idem:operation:applied:1",
            payload: { runIntentId: "run:intent:1" },
          },
          retryCount: 0,
        }],
        localExecutionRegistrations: [],
        pendingRunSubmissions: [],
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

  it("rejects reconciliation outcomes without required conflict class metadata", () => {
    expect(() => parseOfflineSynchronizationStateSnapshotDto({
      contractVersion: "offline-sync/v1",
      workspaceId: "workspace:alpha",
      cachedResources: [],
      drafts: [],
      queue: {
        queueId: "offline-sync:workspace-alpha",
        operations: [{
          operationId: "operation:conflict:1",
          targetResourceClass: "workflow-draft",
          targetResourceId: "workflow:draft:1",
          intent: "promote-local-draft",
          baseAuthoritativeRevision: "rev:9",
          localMutationRevision: 3,
          queuedAt: "2026-04-07T10:03:00.000Z",
          userVisibleSyncStatus: "sync-conflict",
          divergenceDisclosureToken: "offline-warning:workflow:draft:1",
          replayDescriptor: {
            method: "PATCH",
            path: "/v1/workflows/drafts/workflow:draft:1/promote",
            idempotencyKey: "idem:operation:conflict:1",
            payload: { draftId: "workflow:draft:1" },
          },
          retryCount: 1,
        }],
        localExecutionRegistrations: [],
        pendingRunSubmissions: [],
        outcomes: [{
          operationId: "operation:conflict:1",
          action: "conflict-requires-review",
          requiresUserAttention: true,
          requiresAdminAttention: false,
          preserveLocalDraftAsUnsynced: true,
          decisionRule: "preserve-unsynced-draft-and-require-user-review",
          reason: "Authoritative revision changed while offline.",
          resolvedAt: "2026-04-07T10:03:01.000Z",
          conflicts: [{
            operationId: "operation:conflict:1",
            resourceClass: "workflow-draft",
            resourceId: "workflow:draft:1",
            severity: "high",
            conflictCode: "stale-base-edit",
            summary: "baseline stale",
            detectedAt: "2026-04-07T10:03:01.000Z",
            requiresUserAttention: true,
          }],
        }],
        updatedAt: "2026-04-07T10:03:01.000Z",
      },
      status: {
        state: "blocked-conflict",
        pendingOperationCount: 0,
        conflictCount: 1,
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
          localExecutionRegistrations: [],
          pendingRunSubmissions: [],
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

  it("rejects local execution registrations that are already marked registration-applied in queue", () => {
    expect(() => parseOfflineSynchronizationStateSnapshotDto({
      contractVersion: "offline-sync/v1",
      workspaceId: "workspace:alpha",
      cachedResources: [],
      drafts: [],
      queue: {
        queueId: "offline-sync:workspace-alpha",
        operations: [],
        localExecutionRegistrations: [{
          registrationId: "registration:applied:1",
          execution: {
            executionId: "execution:applied:1",
            executionClass: "local-workflow-preview",
            resourceClass: "local-runtime-session",
            resourceId: "runtime:session:applied:1",
            startedAt: "2026-04-07T10:05:00.000Z",
            completedAt: "2026-04-07T10:05:05.000Z",
            executedByActorUserIdentityId: "user:author-1",
            nodeOperationalMode: "workstation-client",
            workstationMode: "interactive-user-session",
            outcome: "succeeded",
            inputDigest: "sha256:execution:applied:1",
            outputs: [],
            historyScope: "explicit-local-activity",
          },
          queuedAt: "2026-04-07T10:05:06.000Z",
          userVisibleRegistrationStatus: "registration-applied",
          divergenceDisclosureToken: "offline-warning:execution:applied:1",
          replayDescriptor: {
            method: "POST",
            path: "/v1/offline/local-executions/execution:applied:1/register",
            idempotencyKey: "idem:registration:applied:1",
            payload: { executionId: "execution:applied:1" },
          },
          retryCount: 0,
        }],
        pendingRunSubmissions: [],
        outcomes: [],
        updatedAt: "2026-04-07T10:05:07.000Z",
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
        lastChangedAt: "2026-04-07T10:05:08.000Z",
        canQueueOperations: true,
        canResynchronize: true,
      },
    })).toThrow(OfflineSynchronizationSchemaValidationError);
  });
});
