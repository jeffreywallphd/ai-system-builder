import { describe, expect, it } from "bun:test";
import {
  OfflineDraftSynchronizationStatuses,
  OfflineAuthorityScopes,
  OfflineDeviceTrustPostures,
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionHistoryScopes,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineLocalExecutionRegistrationStatuses,
  OfflineNodeOperationalModes,
  OfflineLocalModeDomainError,
  OfflineProhibitedPatterns,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkstationModes,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
  appendOfflineLocalDraftChange,
  createOfflineLocalExecutionRecord,
  createOfflineLocalExecutionRegistrationEnvelope,
  createOfflineLocalDraftDocument,
  createOfflinePendingRunSubmissionRecord,
  createOfflineQueuedMutationEnvelope,
  evaluateOfflineLocalExecutionEligibility,
  evaluateOfflineResourcePolicy,
  listOfflineLocalExecutionClassPolicies,
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

  it("publishes explicit supported and out-of-scope offline local execution classes", () => {
    const catalog = listOfflineLocalExecutionClassPolicies();
    expect(catalog.some((entry) => (
      entry.executionClass === OfflineLocalExecutionClasses.localWorkflowPreview
      && entry.supportedInProductionScope
    ))).toBeTrue();
    expect(catalog.some((entry) => (
      entry.executionClass === OfflineLocalExecutionClasses.remoteOrchestratedRunReplay
      && !entry.supportedInProductionScope
    ))).toBeTrue();
  });

  it("evaluates local execution eligibility using resource policy, trust posture, and node/workstation mode", () => {
    const allowed = evaluateOfflineLocalExecutionEligibility({
      executionClass: OfflineLocalExecutionClasses.localWorkflowPreview,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourcePolicy: {
        workspaceVisibility: WorkspaceVisibilities.private,
        workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
        workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
        sensitivityMarking: OfflineSensitivityMarkings.sensitive,
        storageRule: OfflineStorageRules.requireEncryptedOfflineCache,
        deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
      },
      nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
      workstationMode: OfflineWorkstationModes.interactiveUserSession,
      allowOfflineExecutionByPolicy: true,
      allowAuthoritativeRegistrationByPolicy: true,
    });
    expect(allowed.allowed).toBeTrue();
    expect(allowed.historyScope).toBe(OfflineLocalExecutionHistoryScopes.explicitLocalActivity);
    expect(allowed.requiresMetadataCapture).toBeTrue();
    expect(allowed.requiresLaterAuthoritativeRegistration).toBeTrue();

    const blockedByMode = evaluateOfflineLocalExecutionEligibility({
      executionClass: OfflineLocalExecutionClasses.localWorkflowPreview,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourcePolicy: {
        workspaceVisibility: WorkspaceVisibilities.private,
        workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
        workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
        sensitivityMarking: OfflineSensitivityMarkings.sensitive,
        storageRule: OfflineStorageRules.requireEncryptedOfflineCache,
        deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
      },
      nodeOperationalMode: OfflineNodeOperationalModes.authoritativeControlPlane,
      workstationMode: OfflineWorkstationModes.interactiveUserSession,
      allowOfflineExecutionByPolicy: true,
      allowAuthoritativeRegistrationByPolicy: true,
    });

    expect(blockedByMode.allowed).toBeFalse();
    expect(blockedByMode.exclusionReasons.some((reason) => reason.includes("Node operational mode"))).toBeTrue();
  });

  it("excludes out-of-scope execution classes from first production implementation", () => {
    const evaluation = evaluateOfflineLocalExecutionEligibility({
      executionClass: OfflineLocalExecutionClasses.distributedClusterRun,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourcePolicy: {
        workspaceVisibility: WorkspaceVisibilities.private,
        workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
        workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
        sensitivityMarking: OfflineSensitivityMarkings.standard,
        storageRule: OfflineStorageRules.allowOfflineCache,
        deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
      },
      nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
      workstationMode: OfflineWorkstationModes.interactiveUserSession,
      allowOfflineExecutionByPolicy: true,
      allowAuthoritativeRegistrationByPolicy: true,
    });

    expect(evaluation.allowed).toBeFalse();
    expect(evaluation.historyScope).toBe(OfflineLocalExecutionHistoryScopes.outOfScopeNoRegistration);
    expect(evaluation.exclusionReasons[0]).toContain("out of scope");
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

  it("captures local execution metadata and queues explicit registration without blurring authoritative history", () => {
    const execution = createOfflineLocalExecutionRecord({
      executionId: "execution:offline:1",
      executionClass: OfflineLocalExecutionClasses.localWorkflowValidation,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourceId: "runtime:session:1",
      startedAt: "2026-04-07T11:00:00.000Z",
      completedAt: "2026-04-07T11:00:20.000Z",
      executedByActorUserIdentityId: "user:author-1",
      nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
      workstationMode: OfflineWorkstationModes.interactiveUserSession,
      outcome: OfflineLocalExecutionOutcomes.succeeded,
      inputDigest: "sha256:input:offline:1",
      outputs: [{
        outputId: "output:offline:1",
        outputClass: OfflineLocalExecutionOutputClasses.metricsSnapshot,
        contentDigest: "sha256:output:offline:1",
        sizeBytes: 128,
      }],
    });

    const registration = createOfflineLocalExecutionRegistrationEnvelope({
      registrationId: "registration:offline:1",
      execution,
      userVisibleRegistrationStatus: OfflineLocalExecutionRegistrationStatuses.registrationConflict,
      divergenceDisclosureToken: "offline-warning:execution:offline:1",
      replayDescriptor: {
        method: "POST",
        path: "/v1/offline/local-executions/execution:offline:1/register",
        idempotencyKey: "idem:registration:offline:1",
        payload: { executionId: "execution:offline:1" },
      },
    });

    expect(execution.historyScope).toBe(OfflineLocalExecutionHistoryScopes.explicitLocalActivity);
    expect(registration.execution.executionId).toBe("execution:offline:1");
    expect(registration.userVisibleRegistrationStatus).toBe("registration-conflict");
  });
});
