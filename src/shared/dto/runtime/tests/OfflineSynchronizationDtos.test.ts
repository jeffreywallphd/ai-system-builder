import { describe, expect, it } from "bun:test";
import {
  OfflineResourceClasses,
  createOfflineQueuedMutationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineResynchronizationActions,
  type OfflineResynchronizationDecision,
} from "@application/common/OfflineLocalModeResynchronization";
import {
  OfflineConnectivityStates,
  OfflinePendingOperationStatuses,
} from "../../../contracts/runtime/OfflineSynchronizationContracts";
import {
  toOfflineConnectivitySurfaceStateDto,
  toOfflinePendingOperationEnvelopeDto,
  toOfflineReconciliationOutcomeDto,
  toOfflineSynchronizationStateSnapshotDto,
  toOfflineSyncQueueStateDto,
} from "../OfflineSynchronizationDtos";

describe("OfflineSynchronizationDtos", () => {
  it("maps domain queued mutation envelopes into shared pending operation DTOs", () => {
    const envelope = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:offline:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:1",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:1",
      localMutationRevision: 2,
      divergenceDisclosureToken: "offline-warning:workflow:draft:1",
      userVisibleSyncStatus: OfflinePendingOperationStatuses.queuedPendingSync,
      queuedAt: "2026-04-07T10:00:00.000Z",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:1/promote",
        idempotencyKey: "idem:mutation:offline:1",
        payload: { draftId: "workflow:draft:1" },
      },
    });

    const dto = toOfflinePendingOperationEnvelopeDto(envelope, {
      retryCount: 3,
      lastAttemptedAt: "2026-04-07T10:01:00.000Z",
    });

    expect(dto.operationId).toBe("mutation:offline:1");
    expect(dto.retryCount).toBe(3);
    expect(dto.targetResourceClass).toBe("workflow-draft");
    expect(dto.replayDescriptor.path).toBe("/v1/workflows/drafts/workflow:draft:1/promote");
  });

  it("maps reconciliation decisions and marks conflicts", () => {
    const decision: OfflineResynchronizationDecision = {
      mutationId: "mutation:offline:2",
      action: OfflineResynchronizationActions.conflictRequiresReview,
      requiresUserAttention: true,
      reason: "Authoritative revision changed while offline.",
    };

    const outcome = toOfflineReconciliationOutcomeDto(decision, {
      resolvedAt: "2026-04-07T10:03:00.000Z",
      conflictCode: "revision-mismatch",
      authoritativeRevision: "workflow:rev:2",
      localMutationRevision: 5,
    });

    expect(outcome.action).toBe("conflict-requires-review");
    expect(outcome.conflicts?.[0]?.conflictCode).toBe("revision-mismatch");
    expect(outcome.requiresUserAttention).toBeTrue();
  });

  it("maps runtime connectivity snapshots and builds state snapshots", () => {
    const connectivity = toOfflineConnectivitySurfaceStateDto({
      state: OfflineConnectivityStates.disconnected,
      stale: true,
      detail: "Realtime channel closed.",
    }, {
      localModeActive: true,
      lastChangedAt: "2026-04-07T10:04:00.000Z",
    });

    const queue = toOfflineSyncQueueStateDto({
      queueId: "offline-sync:workspace-alpha",
      operations: [],
      updatedAt: "2026-04-07T10:04:01.000Z",
    });

    const snapshot = toOfflineSynchronizationStateSnapshotDto({
      workspaceId: "workspace:alpha",
      cachedResources: [],
      drafts: [],
      queue,
      connectivity,
    });

    expect(snapshot.connectivity.state).toBe("disconnected");
    expect(snapshot.status.state).toBe("idle");
    expect(snapshot.contractVersion).toBe("offline-sync/v1");
  });
});
