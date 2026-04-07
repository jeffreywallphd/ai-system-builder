import {
  type OfflineQueuedMutationEnvelope,
  type OfflineResourceClass,
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
}

export const OfflineResynchronizationActions = Object.freeze({
  applyToAuthoritative: "apply-to-authoritative",
  conflictRequiresReview: "conflict-requires-review",
  rejectNotAllowed: "reject-not-allowed",
});

export type OfflineResynchronizationAction =
  typeof OfflineResynchronizationActions[keyof typeof OfflineResynchronizationActions];

export interface OfflineResynchronizationDecision {
  readonly mutationId: string;
  readonly action: OfflineResynchronizationAction;
  readonly requiresUserAttention: boolean;
  readonly reason: string;
}

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
        requiresUserAttention: true,
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
        requiresUserAttention: true,
        reason: "Local-ephemeral runtime state is not eligible for authoritative replay.",
      }));
      continue;
    }

    if (!snapshot) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.conflictRequiresReview,
        requiresUserAttention: true,
        reason: "No authoritative revision snapshot is available for safe reconciliation.",
      }));
      continue;
    }

    if (snapshot.authoritativeRevision !== mutation.baseAuthoritativeRevision) {
      decisions.push(Object.freeze({
        mutationId: mutation.mutationId,
        action: OfflineResynchronizationActions.conflictRequiresReview,
        requiresUserAttention: true,
        reason: "Authoritative revision changed while offline; user review is required before applying queued mutation.",
      }));
      continue;
    }

    decisions.push(Object.freeze({
      mutationId: mutation.mutationId,
      action: OfflineResynchronizationActions.applyToAuthoritative,
      requiresUserAttention: false,
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
    if (!decision.reason.trim()) {
      throw new OfflineLocalModeResynchronizationError(
        `Resynchronization decision '${mutationId}' must include a non-empty reason.`,
      );
    }
  }
}
