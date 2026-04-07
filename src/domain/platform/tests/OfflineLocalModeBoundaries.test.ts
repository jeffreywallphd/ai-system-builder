import { describe, expect, it } from "bun:test";
import {
  OfflineDraftSynchronizationStatuses,
  OfflineAuthorityScopes,
  OfflineDeviceTrustPostures,
  OfflineLocalModeDomainError,
  OfflineProhibitedPatterns,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
  appendOfflineLocalDraftChange,
  createOfflineLocalDraftDocument,
  createOfflinePendingRunSubmissionRecord,
  createOfflineQueuedMutationEnvelope,
  evaluateOfflineResourcePolicy,
  listOfflineResourceEligibilityPolicies,
  listOfflineResourceAuthorityBoundaries,
  resolveOfflineResourceAuthorityBoundary,
  transitionOfflineLocalDraftSynchronizationStatus,
} from "../OfflineLocalModeBoundaries";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

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
    expect(workflowDefinition.eligibility.behaviorClass).toBe("cached-read-only");
    expect(workflowDefinition.prohibitedPatterns).toContain(
      OfflineProhibitedPatterns.silentGlobalDivergence,
    );
  });

  it("publishes explicit offline eligibility policy entries for all classes", () => {
    const matrix = listOfflineResourceEligibilityPolicies();
    expect(matrix).toHaveLength(Object.keys(OfflineResourceClasses).length);
    expect(matrix.find((entry) => entry.resourceClass === OfflineResourceClasses.secretPlaintextMaterial)?.supportsOffline)
      .toBeFalse();
  });

  it("classifies unknown resources as explicitly unsupported", () => {
    const evaluation = evaluateOfflineResourcePolicy("nonexistent-resource", {
      workspaceVisibility: WorkspaceVisibilities.private,
      workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
      workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
      sensitivityMarking: OfflineSensitivityMarkings.standard,
      storageRule: OfflineStorageRules.allowOfflineCache,
      deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
    });

    expect(evaluation.supportedResourceClass).toBeFalse();
    expect(evaluation.posture.read.allowed).toBeFalse();
    expect(evaluation.exclusionReasons).toContain(
      "Resource class is not in the registered offline eligibility catalog.",
    );
  });

  it("enforces trusted-device and sharing posture gates for local draft/edit behavior", () => {
    const pendingDevice = evaluateOfflineResourcePolicy(OfflineResourceClasses.workflowDraft, {
      workspaceVisibility: WorkspaceVisibilities.private,
      workspaceAccessRole: OfflineWorkspaceAccessRoles.member,
      workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
      sensitivityMarking: OfflineSensitivityMarkings.standard,
      storageRule: OfflineStorageRules.allowOfflineCache,
      deviceTrustPosture: OfflineDeviceTrustPostures.pendingVerification,
    });

    expect(pendingDevice.posture.edit.allowed).toBeFalse();
    expect(pendingDevice.posture.queueMutation.allowed).toBeFalse();

    const externalShare = evaluateOfflineResourcePolicy(OfflineResourceClasses.runSubmissionIntent, {
      workspaceVisibility: WorkspaceVisibilities.team,
      workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
      workspaceSharingPosture: OfflineWorkspaceSharingPostures.externalShared,
      sensitivityMarking: OfflineSensitivityMarkings.standard,
      storageRule: OfflineStorageRules.allowOfflineCache,
      deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
    });

    expect(externalShare.posture.edit.allowed).toBeFalse();
    expect(externalShare.posture.queueMutation.allowed).toBeFalse();
  });

  it("enforces sensitivity and storage rules in offline posture decisions", () => {
    const sensitiveWithoutEncryptedCache = evaluateOfflineResourcePolicy(OfflineResourceClasses.workflowDefinition, {
      workspaceVisibility: WorkspaceVisibilities.private,
      workspaceAccessRole: OfflineWorkspaceAccessRoles.admin,
      workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
      sensitivityMarking: OfflineSensitivityMarkings.sensitive,
      storageRule: OfflineStorageRules.allowOfflineCache,
      deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
    });

    expect(sensitiveWithoutEncryptedCache.posture.cache.allowed).toBeFalse();
    expect(sensitiveWithoutEncryptedCache.posture.read.allowed).toBeFalse();

    const restrictedAndExternal = evaluateOfflineResourcePolicy(OfflineResourceClasses.workflowDraft, {
      workspaceVisibility: WorkspaceVisibilities.private,
      workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
      workspaceSharingPosture: OfflineWorkspaceSharingPostures.publicLink,
      sensitivityMarking: OfflineSensitivityMarkings.restricted,
      storageRule: OfflineStorageRules.requireEncryptedOfflineCache,
      deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
    });

    expect(restrictedAndExternal.posture.read.allowed).toBeFalse();
    expect(restrictedAndExternal.posture.edit.allowed).toBeFalse();
    expect(restrictedAndExternal.posture.queueMutation.allowed).toBeFalse();
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
      replayDescriptor: {
        method: "POST",
        path: "/v1/runtime/local-sessions/runtime:session:1",
        idempotencyKey: "idem:mutation:1",
        payload: { sessionId: "runtime:session:1" },
      },
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
      replayDescriptor: {
        method: "POST",
        path: "/v1/runs/intents/run:intent:123",
        idempotencyKey: "idem:mutation:2",
        payload: { runIntentId: "run:intent:123" },
      },
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
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:1/promote",
        idempotencyKey: "idem:mutation:3",
        payload: { draftId: "workflow:draft:1" },
      },
    })).toThrow(OfflineLocalModeDomainError);
  });

  it("tracks local draft lifecycle without mutating authoritative snapshot revisions", () => {
    const draft = createOfflineLocalDraftDocument({
      draftId: "draft:workflow:1",
      resourceClass: OfflineResourceClasses.workflowDraft,
      resourceId: "workflow:draft:1",
      baseAuthoritativeRevision: "workflow:rev:9",
      lastEditedByActorUserIdentityId: "user:author-1",
    });

    const changed = appendOfflineLocalDraftChange({
      draft,
      changeId: "change:1",
      kind: "update",
      changedByActorUserIdentityId: "user:author-1",
      summary: "Adjusted tool parameters",
    });
    const queued = transitionOfflineLocalDraftSynchronizationStatus({
      draft: changed,
      nextStatus: OfflineDraftSynchronizationStatuses.queuedPendingSync,
      queuedMutationId: "mutation:workflow:1",
    });
    const conflicted = transitionOfflineLocalDraftSynchronizationStatus({
      draft: queued,
      nextStatus: OfflineDraftSynchronizationStatuses.syncConflict,
    });

    expect(changed.syncStatus).toBe(OfflineDraftSynchronizationStatuses.localOnly);
    expect(changed.baseAuthoritativeRevision).toBe("workflow:rev:9");
    expect(changed.authoritativeSnapshotRevision).toBe("workflow:rev:9");
    expect(queued.syncStatus).toBe(OfflineDraftSynchronizationStatuses.queuedPendingSync);
    expect(queued.queuedMutationId).toBe("mutation:workflow:1");
    expect(conflicted.syncStatus).toBe(OfflineDraftSynchronizationStatuses.syncConflict);
  });

  it("requires rooted replay descriptors for queued operations", () => {
    expect(() => createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:bad:descriptor",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:2",
      intent: "promote-local-draft",
      baseAuthoritativeRevision: "workflow:rev:10",
      localMutationRevision: 1,
      divergenceDisclosureToken: "offline-sync-warning:workflow:draft:2",
      replayDescriptor: {
        method: "PATCH",
        path: "v1/workflows/drafts/workflow:draft:2/promote",
        idempotencyKey: "idem:bad:descriptor",
        payload: { draftId: "workflow:draft:2" },
      },
    })).toThrow(OfflineLocalModeDomainError);
  });

  it("creates pending run submission records from queued authoritative intents", () => {
    const queued = createOfflineQueuedMutationEnvelope({
      mutationId: "mutation:run:1",
      targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
      targetResourceId: "run:intent:22",
      intent: "create-or-update-authoritative",
      baseAuthoritativeRevision: "run:rev:4",
      localMutationRevision: 2,
      divergenceDisclosureToken: "offline-sync-warning:run:intent:22",
      replayDescriptor: {
        method: "POST",
        path: "/v1/runs/intents/run:intent:22",
        idempotencyKey: "idem:mutation:run:1",
        payload: { runIntentId: "run:intent:22", workflowId: "workflow:definition:10" },
      },
    });

    const runSubmission = createOfflinePendingRunSubmissionRecord({
      submissionId: "submission:run:1",
      queuedMutation: queued,
      requestedByActorUserIdentityId: "user:author-1",
      workflowDefinitionId: "workflow:definition:10",
      inputDigest: "sha256:abc123",
    });

    expect(runSubmission.queuedMutation.targetResourceClass).toBe(OfflineResourceClasses.runSubmissionIntent);
    expect(runSubmission.queuedMutation.replayDescriptor.path).toBe("/v1/runs/intents/run:intent:22");
  });
});
