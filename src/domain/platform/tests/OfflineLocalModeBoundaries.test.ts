import { describe, expect, it } from "bun:test";
import {
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
  createOfflineQueuedMutationEnvelope,
  evaluateOfflineResourcePolicy,
  listOfflineResourceEligibilityPolicies,
  listOfflineResourceAuthorityBoundaries,
  resolveOfflineResourceAuthorityBoundary,
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
