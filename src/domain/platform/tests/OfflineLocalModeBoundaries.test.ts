import { describe, expect, it } from "bun:test";
import {
  OfflineAuthorityScopes,
  OfflineLocalModeDomainError,
  OfflineProhibitedPatterns,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  createOfflineQueuedMutationEnvelope,
  listOfflineResourceAuthorityBoundaries,
  resolveOfflineResourceAuthorityBoundary,
} from "../OfflineLocalModeBoundaries";

describe("OfflineLocalModeBoundaries", () => {
  it("publishes explicit offline capabilities for all registered resource classes", () => {
    const boundaries = listOfflineResourceAuthorityBoundaries();
    expect(boundaries).toHaveLength(Object.keys(OfflineResourceClasses).length);

    const workflowDraft = resolveOfflineResourceAuthorityBoundary(OfflineResourceClasses.workflowDraft);
    expect(workflowDraft.authoritativeStateScope).toBe(OfflineAuthorityScopes.localDraft);
    expect(workflowDraft.offlineCapabilities.edit).toBeTrue();
    expect(workflowDraft.offlineCapabilities.queueMutation).toBeTrue();
  });

  it("keeps server-authoritative resources from claiming local authority", () => {
    const workflowDefinition = resolveOfflineResourceAuthorityBoundary(OfflineResourceClasses.workflowDefinition);
    expect(workflowDefinition.authoritativeStateScope).toBe(OfflineAuthorityScopes.authoritativeServer);
    expect(workflowDefinition.offlineCapabilities.edit).toBeFalse();
    expect(workflowDefinition.prohibitedPatterns).toContain(
      OfflineProhibitedPatterns.silentGlobalDivergence,
    );
  });

  it("rejects queued mutation envelopes for resource classes that do not allow queueing", () => {
    expect(() => createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:1",
      targetResourceClass: OfflineResourceClasses.localRuntimeSession,
      targetResourceId: "runtime:session:1",
      intent: "create-or-update-authoritative",
      baseAuthoritativeRevision: "rev-1",
      localMutationRevision: 1,
      divergenceDisclosureToken: "offline-sync-warning:1",
    })).toThrow(OfflineLocalModeDomainError);
  });

  it("requires divergence disclosure and pending status for queued mutations", () => {
    const envelope = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:2",
      targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
      targetResourceId: "run:intent:123",
      intent: "create-or-update-authoritative",
      baseAuthoritativeRevision: "run-rev-10",
      localMutationRevision: 3,
      userVisibleSyncStatus: OfflineQueuedMutationStatuses.syncConflict,
      divergenceDisclosureToken: "offline-sync-warning:run:intent:123",
    });

    expect(envelope.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncConflict);
    expect(envelope.divergenceDisclosureToken).toContain("offline-sync-warning");
  });

  it("does not allow queued envelopes to pre-claim sync-applied state", () => {
    expect(() => createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:3",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:1",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow-rev-4",
      localMutationRevision: 1,
      userVisibleSyncStatus: OfflineQueuedMutationStatuses.syncApplied,
      divergenceDisclosureToken: "offline-sync-warning:workflow:draft:1",
    })).toThrow(OfflineLocalModeDomainError);
  });
});
