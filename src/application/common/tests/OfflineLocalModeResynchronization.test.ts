import { describe, expect, it } from "bun:test";
import {
  OfflineResourceClasses,
  createOfflineQueuedMutationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineLocalModeResynchronizationError,
  OfflineResynchronizationActions,
  OfflineResynchronizationConflictClasses,
  OfflineResynchronizationDecisionRules,
  assertResynchronizationPlanPreventsSilentGlobalDivergence,
  planOfflineResynchronization,
} from "../OfflineLocalModeResynchronization";

describe("OfflineLocalModeResynchronization", () => {
  it("applies queued mutation when authoritative revision matches baseline", () => {
    const queued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:apply:1",
      targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
      targetResourceId: "run:intent:1",
      intent: "create-or-update-authoritative",
      baseAuthoritativeRevision: "rev:10",
      localMutationRevision: 2,
      divergenceDisclosureToken: "offline-warning:run:intent:1",
      replayDescriptor: {
        method: "POST",
        path: "/v1/runs/intents/run:intent:1",
        idempotencyKey: "idem:mutation:apply:1",
        payload: { runIntentId: "run:intent:1" },
      },
    });

    const decisions = planOfflineResynchronization({
      queuedMutations: [queued],
      authoritativeRevisions: [{
        resourceClass: OfflineResourceClasses.runSubmissionIntent,
        resourceId: "run:intent:1",
        authoritativeRevision: "rev:10",
      }],
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.action).toBe(OfflineResynchronizationActions.applyToAuthoritative);
    expect(decisions[0]?.decisionRule).toBe(
      OfflineResynchronizationDecisionRules.autoApplyWhenAuthoritativeBaselineMatches,
    );
    expect(decisions[0]?.conflictClass).toBeUndefined();
    expect(decisions[0]?.preserveLocalDraftAsUnsynced).toBeFalse();
    expect(decisions[0]?.requiresAdminAttention).toBeFalse();
    expect(decisions[0]?.requiresUserAttention).toBeFalse();
  });

  it("classifies supported conflict classes with explicit decision rules (representative conflict matrix)", () => {
    const staleBaseQueued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:stale-base:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:1",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:4",
      localMutationRevision: 3,
      divergenceDisclosureToken: "offline-warning:workflow:draft:1",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:1/promote",
        idempotencyKey: "idem:mutation:stale-base:1",
        payload: { draftId: "workflow:draft:1" },
      },
    });
    const deletedOrRevokedQueued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:deleted-or-revoked:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:2",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:2",
      localMutationRevision: 1,
      divergenceDisclosureToken: "offline-warning:workflow:draft:2",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:2/promote",
        idempotencyKey: "idem:mutation:deleted-or-revoked:1",
        payload: { draftId: "workflow:draft:2" },
      },
    });
    const permissionChangedQueued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:permission-changed:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:3",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:7",
      localMutationRevision: 2,
      divergenceDisclosureToken: "offline-warning:workflow:draft:3",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:3/promote",
        idempotencyKey: "idem:mutation:permission-changed:1",
        payload: { draftId: "workflow:draft:3" },
      },
    });
    const invalidatedRunSubmissionQueued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:invalidated-run:1",
      targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
      targetResourceId: "run:intent:1",
      intent: "create-or-update-authoritative",
      baseAuthoritativeRevision: "run:rev:4",
      localMutationRevision: 1,
      divergenceDisclosureToken: "offline-warning:run:intent:1",
      replayDescriptor: {
        method: "POST",
        path: "/v1/runs/intents/run:intent:1",
        idempotencyKey: "idem:mutation:invalidated-run:1",
        payload: { runIntentId: "run:intent:1" },
      },
    });
    const versionMismatchQueued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:version-mismatch:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:4",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:9",
      localMutationRevision: 5,
      divergenceDisclosureToken: "offline-warning:workflow:draft:4",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:4/promote",
        idempotencyKey: "idem:mutation:version-mismatch:1",
        payload: { draftId: "workflow:draft:4" },
      },
    });

    const decisions = planOfflineResynchronization({
      queuedMutations: [
        staleBaseQueued,
        deletedOrRevokedQueued,
        permissionChangedQueued,
        invalidatedRunSubmissionQueued,
        versionMismatchQueued,
      ],
      authoritativeRevisions: [
        {
          resourceClass: OfflineResourceClasses.workflowDraft,
          resourceId: "workflow:draft:1",
          authoritativeRevision: "workflow:rev:5",
        },
        {
          resourceClass: OfflineResourceClasses.workflowDraft,
          resourceId: "workflow:draft:2",
          authoritativeRevision: "workflow:rev:2",
          resourceExists: false,
        },
        {
          resourceClass: OfflineResourceClasses.workflowDraft,
          resourceId: "workflow:draft:3",
          authoritativeRevision: "workflow:rev:7",
          permissionAllowsReplay: false,
          requiresAdminIntervention: true,
        },
        {
          resourceClass: OfflineResourceClasses.runSubmissionIntent,
          resourceId: "run:intent:1",
          authoritativeRevision: "run:rev:4",
          submissionStillValid: false,
        },
        {
          resourceClass: OfflineResourceClasses.workflowDraft,
          resourceId: "workflow:draft:4",
          authoritativeRevision: "workflow:rev:9",
          revisionComparable: false,
        },
      ],
    });

    expect(decisions).toHaveLength(5);
    expect(decisions[0]).toMatchObject({
      mutationId: "mutation:stale-base:1",
      action: OfflineResynchronizationActions.conflictRequiresReview,
      conflictClass: OfflineResynchronizationConflictClasses.staleBaseEdit,
      decisionRule: OfflineResynchronizationDecisionRules.preserveUnsyncedDraftAndRequireUserReview,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: true,
      requiresAdminAttention: false,
    });
    expect(decisions[1]).toMatchObject({
      mutationId: "mutation:deleted-or-revoked:1",
      action: OfflineResynchronizationActions.rejectNotAllowed,
      conflictClass: OfflineResynchronizationConflictClasses.deletedOrRevokedResource,
      decisionRule: OfflineResynchronizationDecisionRules.preserveUnsyncedDraftAndRejectReplay,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: true,
      requiresAdminAttention: false,
    });
    expect(decisions[2]).toMatchObject({
      mutationId: "mutation:permission-changed:1",
      action: OfflineResynchronizationActions.rejectNotAllowed,
      conflictClass: OfflineResynchronizationConflictClasses.permissionChangedDuringDisconnection,
      decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireAdminReview,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: true,
      requiresAdminAttention: true,
    });
    expect(decisions[3]).toMatchObject({
      mutationId: "mutation:invalidated-run:1",
      action: OfflineResynchronizationActions.rejectNotAllowed,
      conflictClass: OfflineResynchronizationConflictClasses.invalidatedRunSubmission,
      decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
      preserveLocalDraftAsUnsynced: false,
      requiresUserAttention: true,
      requiresAdminAttention: false,
    });
    expect(decisions[4]).toMatchObject({
      mutationId: "mutation:version-mismatch:1",
      action: OfflineResynchronizationActions.conflictRequiresReview,
      conflictClass: OfflineResynchronizationConflictClasses.resourceVersionMismatch,
      decisionRule: OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: true,
      requiresAdminAttention: false,
    });
  });

  it("classifies authoritative state unavailability as deferred unsafe auto-merge", () => {
    const queued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:missing-authoritative-state:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:missing",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:1",
      localMutationRevision: 2,
      divergenceDisclosureToken: "offline-warning:workflow:draft:missing",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:missing/promote",
        idempotencyKey: "idem:mutation:missing-authoritative-state:1",
        payload: { draftId: "workflow:draft:missing" },
      },
    });

    const decisions = planOfflineResynchronization({
      queuedMutations: [queued],
      authoritativeRevisions: [],
    });

    expect(decisions[0]).toMatchObject({
      action: OfflineResynchronizationActions.conflictRequiresReview,
      conflictClass: OfflineResynchronizationConflictClasses.authoritativeStateUnavailable,
      decisionRule: OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: true,
      requiresAdminAttention: false,
    });
  });

  it("guards against hidden divergence decisions in the final plan", () => {
    expect(() => assertResynchronizationPlanPreventsSilentGlobalDivergence([{
      mutationId: "mutation:hidden:1",
      action: OfflineResynchronizationActions.conflictRequiresReview,
      conflictClass: OfflineResynchronizationConflictClasses.staleBaseEdit,
      decisionRule: OfflineResynchronizationDecisionRules.preserveUnsyncedDraftAndRequireUserReview,
      preserveLocalDraftAsUnsynced: true,
      requiresUserAttention: false,
      requiresAdminAttention: false,
      reason: "conflict",
    }])).toThrow(OfflineLocalModeResynchronizationError);
  });

  it("guards against missing conflict class for non-apply decisions", () => {
    expect(() => assertResynchronizationPlanPreventsSilentGlobalDivergence([{
      mutationId: "mutation:hidden:2",
      action: OfflineResynchronizationActions.rejectNotAllowed,
      decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
      preserveLocalDraftAsUnsynced: false,
      requiresUserAttention: true,
      requiresAdminAttention: false,
      reason: "rejected",
    }])).toThrow(OfflineLocalModeResynchronizationError);
  });
});
