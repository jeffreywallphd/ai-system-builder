import {
  type OfflineQueuedMutationEnvelope,
  type OfflineResourceClass,
  OfflineResourceClasses,
  OfflineAuthorityScopes,
  OfflineLocalModeDomainError,
  assertOfflineQueuedMutationEnvelopeRequiresVisibleDivergenceSignal,
  resolveOfflineResourceAuthorityBoundary,
} from "@domain/platform/OfflineLocalModeBoundaries";

export class OfflineLocalModeResynchronizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineLocalModeResynchronizationError";
  }
}

export interface AuthoritativeResourceRevisionSnapshot {
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly authoritativeRevision: string;
  readonly authoritativeSnapshotRevision?: string;
  readonly resourceExists?: boolean;
  readonly accessRevoked?: boolean;
  readonly permissionAllowsReplay?: boolean;
  readonly requiresAdminIntervention?: boolean;
  readonly submissionStillValid?: boolean;
  readonly revisionComparable?: boolean;
}

export const OfflineResynchronizationActions = Object.freeze({
  applyToAuthoritative: "apply-to-authoritative",
  conflictRequiresReview: "conflict-requires-review",
  rejectNotAllowed: "reject-not-allowed",
});

export type OfflineResynchronizationAction =
  typeof OfflineResynchronizationActions[keyof typeof OfflineResynchronizationActions];

export const OfflineResynchronizationConflictClasses = Object.freeze({
  staleBaseEdit: "stale-base-edit",
  deletedOrRevokedResource: "deleted-or-revoked-resource",
  permissionChangedDuringDisconnection: "permission-changed-during-disconnection",
  invalidatedRunSubmission: "invalidated-run-submission",
  resourceVersionMismatch: "resource-version-mismatch",
  authoritativeStateUnavailable: "authoritative-state-unavailable",
});

export type OfflineResynchronizationConflictClass =
  typeof OfflineResynchronizationConflictClasses[keyof typeof OfflineResynchronizationConflictClasses];

export const OfflineResynchronizationDecisionRules = Object.freeze({
  autoApplyWhenAuthoritativeBaselineMatches: "auto-apply-when-authoritative-baseline-matches",
  preserveUnsyncedDraftAndRequireUserReview: "preserve-unsynced-draft-and-require-user-review",
  preserveUnsyncedDraftAndRequireAdminReview: "preserve-unsynced-draft-and-require-admin-review",
  preserveUnsyncedDraftAndRejectReplay: "preserve-unsynced-draft-and-reject-replay",
  rejectReplayAndRequireAdminReview: "reject-replay-and-require-admin-review",
  rejectReplayAndRequireUserReview: "reject-replay-and-require-user-review",
  unsafeAutoMergeDeferred: "unsafe-auto-merge-deferred",
});

export type OfflineResynchronizationDecisionRule =
  typeof OfflineResynchronizationDecisionRules[keyof typeof OfflineResynchronizationDecisionRules];

export interface OfflineResynchronizationDecision {
  readonly mutationId: string;
  readonly action: OfflineResynchronizationAction;
  readonly conflictClass?: OfflineResynchronizationConflictClass;
  readonly decisionRule: OfflineResynchronizationDecisionRule;
  readonly preserveLocalDraftAsUnsynced: boolean;
  readonly requiresUserAttention: boolean;
  readonly requiresAdminAttention: boolean;
  readonly reason: string;
}

/*
  Migration note (Story 19.1.2):
  Shared reconciliation outcome contracts now live in
  `@shared/contracts/runtime/OfflineSynchronizationContracts`
  as `OfflineReconciliationOutcomeDto` and related conflict indicators.
  This decision model remains the application-policy seam.
*/

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineLocalModeResynchronizationError(`${field} is required.`);
  }
  return normalized;
}

function makeSnapshotKey(snapshot: Pick<AuthoritativeResourceRevisionSnapshot, "resourceClass" | "resourceId">): string {
  return `${snapshot.resourceClass}::${snapshot.resourceId}`;
}

function shouldPreserveAsUnsyncedDraft(resourceClass: OfflineResourceClass): boolean {
  const boundary = resolveOfflineResourceAuthorityBoundary(resourceClass);
  return boundary.authoritativeStateScope === OfflineAuthorityScopes.localDraft;
}

export function planOfflineResynchronization(input: {
  readonly queuedMutations: ReadonlyArray<OfflineQueuedMutationEnvelope>;
  readonly authoritativeRevisions: ReadonlyArray<AuthoritativeResourceRevisionSnapshot>;
}): ReadonlyArray<OfflineResynchronizationDecision> {
  const revisionByResource = new Map<string, AuthoritativeResourceRevisionSnapshot>();
  for (const snapshot of input.authoritativeRevisions) {
    revisionByResource.set(makeSnapshotKey(snapshot), snapshot);
  }

  const decisions: OfflineResynchronizationDecision[] = [];
  for (const mutation of input.queuedMutations) {
    try {
      assertOfflineQueuedMutationEnvelopeRequiresVisibleDivergenceSignal(mutation);
    } catch (error) {
      if (error instanceof OfflineLocalModeDomainError) {
        throw new OfflineLocalModeResynchronizationError(error.message);
      }
      throw error;
    }

    const boundary = resolveOfflineResourceAuthorityBoundary(mutation.targetResourceClass);
    if (!boundary.offlineCapabilities.queueMutation) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.rejectNotAllowed,
        decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireAdminReview,
        preserveLocalDraftAsUnsynced: shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass),
        requiresUserAttention: true,
        requiresAdminAttention: true,
        reason: `Resource class '${mutation.targetResourceClass}' does not allow queued authoritative synchronization.`,
      }));
      continue;
    }

    const snapshot = revisionByResource.get(
      makeSnapshotKey({ resourceClass: mutation.targetResourceClass, resourceId: mutation.targetResourceId }),
    );
    if (boundary.authoritativeStateScope === OfflineAuthorityScopes.localEphemeral) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.rejectNotAllowed,
        decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
        preserveLocalDraftAsUnsynced: false,
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason: "Local-ephemeral runtime state is not eligible for authoritative replay.",
      }));
      continue;
    }

    if (!snapshot) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.conflictRequiresReview,
        conflictClass: OfflineResynchronizationConflictClasses.authoritativeStateUnavailable,
        decisionRule: OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
        preserveLocalDraftAsUnsynced: shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass),
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason: "No authoritative revision snapshot is available for safe reconciliation.",
      }));
      continue;
    }

    if (snapshot.resourceExists === false || snapshot.accessRevoked === true) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.rejectNotAllowed,
        conflictClass: OfflineResynchronizationConflictClasses.deletedOrRevokedResource,
        decisionRule: OfflineResynchronizationDecisionRules.preserveUnsyncedDraftAndRejectReplay,
        preserveLocalDraftAsUnsynced: shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass),
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason: "Resource was deleted or revoked while offline; replay is rejected and local draft is preserved.",
      }));
      continue;
    }

    if (snapshot.permissionAllowsReplay === false) {
      const requiresAdminAttention = snapshot.requiresAdminIntervention === true;
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.rejectNotAllowed,
        conflictClass: OfflineResynchronizationConflictClasses.permissionChangedDuringDisconnection,
        decisionRule: requiresAdminAttention
          ? OfflineResynchronizationDecisionRules.rejectReplayAndRequireAdminReview
          : OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
        preserveLocalDraftAsUnsynced: shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass),
        requiresUserAttention: true,
        requiresAdminAttention,
        reason: requiresAdminAttention
          ? "Permissions changed while offline and now require admin intervention before replay."
          : "Permissions changed while offline and replay is no longer authorized for this user.",
      }));
      continue;
    }

    if (
      mutation.targetResourceClass === OfflineResourceClasses.runSubmissionIntent
      && snapshot.submissionStillValid === false
    ) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.rejectNotAllowed,
        conflictClass: OfflineResynchronizationConflictClasses.invalidatedRunSubmission,
        decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
        preserveLocalDraftAsUnsynced: false,
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason: "Run submission intent was invalidated while offline; replay is rejected pending user correction.",
      }));
      continue;
    }

    if (snapshot.revisionComparable === false) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.conflictRequiresReview,
        conflictClass: OfflineResynchronizationConflictClasses.resourceVersionMismatch,
        decisionRule: OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
        preserveLocalDraftAsUnsynced: shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass),
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason:
          "Authoritative version format changed and cannot be safely auto-compared; unsafe auto-merge is deferred.",
      }));
      continue;
    }

    const staleBaseEdit = snapshot.authoritativeRevision !== mutation.baseAuthoritativeRevision;
    if (
      !staleBaseEdit
      && snapshot.authoritativeSnapshotRevision
      && snapshot.authoritativeSnapshotRevision !== mutation.baseAuthoritativeRevision
    ) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.conflictRequiresReview,
        conflictClass: OfflineResynchronizationConflictClasses.resourceVersionMismatch,
        decisionRule: OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
        preserveLocalDraftAsUnsynced: shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass),
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason:
          "Authoritative snapshot revision and replay baseline are from incompatible version lines; auto-merge is deferred.",
      }));
      continue;
    }

    if (staleBaseEdit) {
      const preserveLocalDraftAsUnsynced = shouldPreserveAsUnsyncedDraft(mutation.targetResourceClass);
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.conflictRequiresReview,
        conflictClass: OfflineResynchronizationConflictClasses.staleBaseEdit,
        decisionRule: preserveLocalDraftAsUnsynced
          ? OfflineResynchronizationDecisionRules.preserveUnsyncedDraftAndRequireUserReview
          : OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
        preserveLocalDraftAsUnsynced,
        requiresUserAttention: true,
        requiresAdminAttention: false,
        reason: "Authoritative revision changed while offline; user review is required before applying queued mutation.",
      }));
      continue;
    }

    decisions.push(Object.freeze({
      mutationId: mutation.mutationId,
      action: OfflineResynchronizationActions.applyToAuthoritative,
      decisionRule: OfflineResynchronizationDecisionRules.autoApplyWhenAuthoritativeBaselineMatches,
      preserveLocalDraftAsUnsynced: false,
      requiresUserAttention: false,
      requiresAdminAttention: false,
      reason: "Authoritative revision matches queued mutation baseline.",
    }));
  }

  return Object.freeze(decisions);
}

export function assertResynchronizationPlanPreventsSilentGlobalDivergence(
  decisions: ReadonlyArray<OfflineResynchronizationDecision>,
): void {
  for (const decision of decisions) {
    const mutationId = normalizeRequired(decision.mutationId, "Resynchronization decision mutationId");
    if (
      (decision.action === OfflineResynchronizationActions.conflictRequiresReview
        || decision.action === OfflineResynchronizationActions.rejectNotAllowed)
      && !decision.requiresUserAttention
    ) {
      throw new OfflineLocalModeResynchronizationError(
        `Resynchronization decision '${mutationId}' hides a divergence outcome without user attention.`,
      );
    }
    if (
      decision.requiresAdminAttention
      && decision.action !== OfflineResynchronizationActions.rejectNotAllowed
    ) {
      throw new OfflineLocalModeResynchronizationError(
        `Resynchronization decision '${mutationId}' cannot require admin attention without explicit rejection.`,
      );
    }
    if (
      decision.action === OfflineResynchronizationActions.applyToAuthoritative
      && (decision.conflictClass || decision.requiresAdminAttention || decision.preserveLocalDraftAsUnsynced)
    ) {
      throw new OfflineLocalModeResynchronizationError(
        `Resynchronization decision '${mutationId}' cannot apply authoritative replay while retaining conflict-only markers.`,
      );
    }
    if (
      decision.action !== OfflineResynchronizationActions.applyToAuthoritative
      && !decision.conflictClass
    ) {
      throw new OfflineLocalModeResynchronizationError(
        `Resynchronization decision '${mutationId}' must include conflictClass for non-apply outcomes.`,
      );
    }
    if (!decision.reason.trim()) {
      throw new OfflineLocalModeResynchronizationError(
        `Resynchronization decision '${mutationId}' must include a non-empty reason.`,
      );
    }
  }
}
