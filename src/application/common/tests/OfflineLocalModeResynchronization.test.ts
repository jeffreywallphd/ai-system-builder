import { describe, expect, it } from "bun:test";
import {
  OfflineResourceClasses,
  createOfflineQueuedMutationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineLocalModeResynchronizationError,
  OfflineResynchronizationActions,
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
    expect(decisions[0]?.requiresUserAttention).toBeFalse();
  });

  it("marks conflict when authoritative revision changed while offline", () => {
    const queued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:conflict:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:1",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:4",
      localMutationRevision: 6,
      divergenceDisclosureToken: "offline-warning:workflow:draft:1",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:1/promote",
        idempotencyKey: "idem:mutation:conflict:1",
        payload: { draftId: "workflow:draft:1" },
      },
    });

    const decisions = planOfflineResynchronization({
      queuedMutations: [queued],
      authoritativeRevisions: [{
        resourceClass: OfflineResourceClasses.workflowDraft,
        resourceId: "workflow:draft:1",
        authoritativeRevision: "workflow:rev:5",
      }],
    });

    expect(decisions[0]?.action).toBe(OfflineResynchronizationActions.conflictRequiresReview);
    expect(decisions[0]?.requiresUserAttention).toBeTrue();
  });

  it("guards against hidden divergence decisions in the final plan", () => {
    expect(() => assertResynchronizationPlanPreventsSilentGlobalDivergence([{
      mutationId: "mutation:hidden:1",
      action: OfflineResynchronizationActions.conflictRequiresReview,
      requiresUserAttention: false,
      reason: "conflict",
    }])).toThrow(OfflineLocalModeResynchronizationError);
  });
});
