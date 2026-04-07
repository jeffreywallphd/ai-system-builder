import { describe, expect, it } from "bun:test";
import {
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineNodeOperationalModes,
  OfflineWorkstationModes,
  OfflineResourceClasses,
  createOfflineLocalExecutionRecord,
  createOfflineLocalExecutionRegistrationEnvelope,
  createOfflineQueuedMutationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineResynchronizationActions,
  OfflineResynchronizationConflictClasses,
  OfflineResynchronizationDecisionRules,
  type OfflineResynchronizationDecision,
} from "@application/common/OfflineLocalModeResynchronization";
import {
  OfflineConnectivityStates,
  OfflinePendingOperationStatuses,
} from "../../../contracts/runtime/OfflineSynchronizationContracts";
import {
  toOfflineConnectivitySurfaceStateDto,
  toOfflineLocalExecutionRegistrationEnvelopeDto,
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
      conflictClass: OfflineResynchronizationConflictClasses.staleBaseEdit,
      decisionRule: OfflineResynchronizationDecisionRules.preserveUnsyncedDraftAndRequireUserReview,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: true,
      requiresAdminAttention: false,
      reason: "Authoritative revision changed while offline.",
    };

    const outcome = toOfflineReconciliationOutcomeDto(decision, {
      resolvedAt: "2026-04-07T10:03:00.000Z",
      conflictCode: "revision-mismatch",
      authoritativeRevision: "workflow:rev:2",
      localMutationRevision: 5,
    });

    expect(outcome.action).toBe("conflict-requires-review");
    expect(outcome.decisionRule).toBe("preserve-unsynced-draft-and-require-user-review");
    expect(outcome.preserveLocalDraftAsUnsynced).toBeTrue();
    expect(outcome.requiresAdminAttention).toBeFalse();
    expect(outcome.conflicts?.[0]?.conflictClass).toBe("stale-base-edit");
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
      localExecutionRegistrations: [],
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

  it("maps local execution registrations as explicit local activity", () => {
    const execution = createOfflineLocalExecutionRecord({
      executionId: "execution:local:1",
      executionClass: OfflineLocalExecutionClasses.localWorkflowPreview,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourceId: "runtime:session:local:1",
      startedAt: "2026-04-07T10:05:00.000Z",
      completedAt: "2026-04-07T10:05:20.000Z",
      executedByActorUserIdentityId: "user:author-1",
      nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
      workstationMode: OfflineWorkstationModes.interactiveUserSession,
      outcome: OfflineLocalExecutionOutcomes.succeeded,
      inputDigest: "sha256:input:local:1",
      outputs: [{
        outputId: "output:local:1",
        outputClass: OfflineLocalExecutionOutputClasses.previewArtifact,
        contentDigest: "sha256:output:local:1",
        sizeBytes: 256,
      }],
    });

    const registration = createOfflineLocalExecutionRegistrationEnvelope({
      registrationId: "registration:local:1",
      execution,
      queuedAt: "2026-04-07T10:05:25.000Z",
      divergenceDisclosureToken: "offline-warning:execution:local:1",
      replayDescriptor: {
        method: "POST",
        path: "/v1/offline/local-executions/execution:local:1/register",
        idempotencyKey: "idem:registration:local:1",
        payload: { executionId: "execution:local:1" },
      },
    });

    const dto = toOfflineLocalExecutionRegistrationEnvelopeDto(registration, {
      retryCount: 2,
      lastAttemptedAt: "2026-04-07T10:06:00.000Z",
    });

    expect(dto.execution.historyScope).toBe("explicit-local-activity");
    expect(dto.userVisibleRegistrationStatus).toBe("queued-pending-registration");
    expect(dto.retryCount).toBe(2);
    expect(dto.replayDescriptor.path).toContain("/offline/local-executions/");
  });
});
