export class OfflineSynchronizationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineSynchronizationContractError";
  }
}

export const OfflineSynchronizationContractVersions = Object.freeze({
  v1: "offline-sync/v1",
} as const);

export type OfflineSynchronizationContractVersion =
  typeof OfflineSynchronizationContractVersions[keyof typeof OfflineSynchronizationContractVersions];

export const OfflineSyncResourceClasses = Object.freeze({
  workspaceCatalog: "workspace-catalog",
  workflowDefinition: "workflow-definition",
  workflowDraft: "workflow-draft",
  runSubmissionIntent: "run-submission-intent",
  localRuntimeSession: "local-runtime-session",
  secretPlaintextMaterial: "secret-plaintext-material",
} as const);

export type OfflineSyncResourceClass =
  typeof OfflineSyncResourceClasses[keyof typeof OfflineSyncResourceClasses];

export const OfflineCacheFreshnessStates = Object.freeze({
  fresh: "fresh",
  stale: "stale",
  expired: "expired",
} as const);

export type OfflineCacheFreshnessState =
  typeof OfflineCacheFreshnessStates[keyof typeof OfflineCacheFreshnessStates];

export const OfflineLocalChangeKinds = Object.freeze({
  create: "create",
  update: "update",
  delete: "delete",
  reorder: "reorder",
  metadata: "metadata",
} as const);

export type OfflineLocalChangeKind =
  typeof OfflineLocalChangeKinds[keyof typeof OfflineLocalChangeKinds];

export const OfflineDraftSyncStatuses = Object.freeze({
  localOnly: "local-only",
  queuedPendingSync: "queued-pending-sync",
  syncConflict: "sync-conflict",
  syncRejected: "sync-rejected",
  syncApplied: "sync-applied",
} as const);

export type OfflineDraftSyncStatus =
  typeof OfflineDraftSyncStatuses[keyof typeof OfflineDraftSyncStatuses];

export const OfflinePendingOperationIntents = Object.freeze({
  promoteLocalDraft: "promote-local-draft",
  createOrUpdateAuthoritative: "create-or-update-authoritative",
  deleteAuthoritative: "delete-authoritative",
} as const);

export type OfflinePendingOperationIntent =
  typeof OfflinePendingOperationIntents[keyof typeof OfflinePendingOperationIntents];

export const OfflinePendingOperationStatuses = Object.freeze({
  queuedPendingSync: "queued-pending-sync",
  syncConflict: "sync-conflict",
  syncApplied: "sync-applied",
  syncRejected: "sync-rejected",
} as const);

export type OfflinePendingOperationStatus =
  typeof OfflinePendingOperationStatuses[keyof typeof OfflinePendingOperationStatuses];

export const OfflineReplayHttpMethods = Object.freeze({
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
} as const);

export type OfflineReplayHttpMethod =
  typeof OfflineReplayHttpMethods[keyof typeof OfflineReplayHttpMethods];

export const OfflineSynchronizationStates = Object.freeze({
  idle: "idle",
  synchronizing: "synchronizing",
  blockedConflict: "blocked-conflict",
  failed: "failed",
} as const);

export type OfflineSynchronizationState =
  typeof OfflineSynchronizationStates[keyof typeof OfflineSynchronizationStates];

export const OfflineConflictSeverities = Object.freeze({
  low: "low",
  medium: "medium",
  high: "high",
} as const);

export type OfflineConflictSeverity =
  typeof OfflineConflictSeverities[keyof typeof OfflineConflictSeverities];

export const OfflineConflictClasses = Object.freeze({
  staleBaseEdit: "stale-base-edit",
  deletedOrRevokedResource: "deleted-or-revoked-resource",
  permissionChangedDuringDisconnection: "permission-changed-during-disconnection",
  invalidatedRunSubmission: "invalidated-run-submission",
  resourceVersionMismatch: "resource-version-mismatch",
  authoritativeStateUnavailable: "authoritative-state-unavailable",
} as const);

export type OfflineConflictClass =
  typeof OfflineConflictClasses[keyof typeof OfflineConflictClasses];

export const OfflineReconciliationActions = Object.freeze({
  applyToAuthoritative: "apply-to-authoritative",
  conflictRequiresReview: "conflict-requires-review",
  rejectNotAllowed: "reject-not-allowed",
} as const);

export type OfflineReconciliationAction =
  typeof OfflineReconciliationActions[keyof typeof OfflineReconciliationActions];

export const OfflineConnectivityStates = Object.freeze({
  connecting: "connecting",
  connected: "connected",
  reconnecting: "reconnecting",
  degraded: "degraded",
  disconnected: "disconnected",
} as const);

export type OfflineConnectivityState =
  typeof OfflineConnectivityStates[keyof typeof OfflineConnectivityStates];

export interface OfflineCachedResourceMetadataDto {
  readonly resourceClass: OfflineSyncResourceClass;
  readonly resourceId: string;
  readonly authoritativeRevision: string;
  readonly cachedRevision: string;
  readonly cachedAt: string;
  readonly freshness: OfflineCacheFreshnessState;
  readonly expiresAt?: string;
  readonly contentHash?: string;
  readonly sizeBytes?: number;
}

export interface OfflineLocalChangeRecordDto {
  readonly changeId: string;
  readonly draftId: string;
  readonly resourceId: string;
  readonly kind: OfflineLocalChangeKind;
  readonly changedAt: string;
  readonly changedByActorUserIdentityId: string;
  readonly path?: string;
  readonly summary?: string;
}

export interface OfflineDraftStateDto {
  readonly draftId: string;
  readonly resourceClass: OfflineSyncResourceClass;
  readonly resourceId: string;
  readonly baseAuthoritativeRevision: string;
  readonly authoritativeSnapshotRevision: string;
  readonly draftRevision: number;
  readonly syncStatus: OfflineDraftSyncStatus;
  readonly queuedMutationId?: string;
  readonly dirty: boolean;
  readonly lastEditedAt: string;
  readonly lastEditedByActorUserIdentityId: string;
  readonly localChanges: ReadonlyArray<OfflineLocalChangeRecordDto>;
}

export interface OfflinePendingOperationReplayDescriptorDto {
  readonly method: OfflineReplayHttpMethod;
  readonly path: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadContentType?: string;
}

export interface OfflinePendingOperationEnvelopeDto {
  readonly operationId: string;
  readonly targetResourceClass: OfflineSyncResourceClass;
  readonly targetResourceId: string;
  readonly intent: OfflinePendingOperationIntent;
  readonly baseAuthoritativeRevision: string;
  readonly localMutationRevision: number;
  readonly queuedAt: string;
  readonly userVisibleSyncStatus: OfflinePendingOperationStatus;
  readonly divergenceDisclosureToken: string;
  readonly replayDescriptor: OfflinePendingOperationReplayDescriptorDto;
  readonly retryCount: number;
  readonly lastAttemptedAt?: string;
}

export interface OfflinePendingRunSubmissionDto {
  readonly submissionId: string;
  readonly operationId: string;
  readonly workflowDefinitionId: string;
  readonly inputDigest: string;
  readonly requestedAt: string;
  readonly requestedByActorUserIdentityId: string;
}

export interface OfflineConflictIndicatorDto {
  readonly operationId: string;
  readonly resourceClass: OfflineSyncResourceClass;
  readonly resourceId: string;
  readonly severity: OfflineConflictSeverity;
  readonly conflictClass: OfflineConflictClass;
  readonly conflictCode: string;
  readonly summary: string;
  readonly authoritativeRevision?: string;
  readonly localMutationRevision?: number;
  readonly detectedAt: string;
  readonly requiresUserAttention: boolean;
}

export interface OfflineReconciliationOutcomeDto {
  readonly operationId: string;
  readonly action: OfflineReconciliationAction;
  readonly requiresUserAttention: boolean;
  readonly requiresAdminAttention: boolean;
  readonly preserveLocalDraftAsUnsynced: boolean;
  readonly decisionRule: string;
  readonly reason: string;
  readonly resolvedAt: string;
  readonly authoritativeRevisionAfter?: string;
  readonly conflicts?: ReadonlyArray<OfflineConflictIndicatorDto>;
}

export interface OfflineSyncQueueStateDto {
  readonly queueId: string;
  readonly operations: ReadonlyArray<OfflinePendingOperationEnvelopeDto>;
  readonly pendingRunSubmissions: ReadonlyArray<OfflinePendingRunSubmissionDto>;
  readonly outcomes: ReadonlyArray<OfflineReconciliationOutcomeDto>;
  readonly updatedAt: string;
}

export interface OfflineSynchronizationStatusDto {
  readonly state: OfflineSynchronizationState;
  readonly pendingOperationCount: number;
  readonly conflictCount: number;
  readonly rejectedCount: number;
  readonly lastSynchronizedAt?: string;
  readonly lastAttemptedAt?: string;
  readonly reasonCode?: string;
}

export interface OfflineConnectivitySurfaceStateDto {
  readonly state: OfflineConnectivityState;
  readonly stale: boolean;
  readonly localModeActive: boolean;
  readonly detail?: string;
  readonly lastChangedAt: string;
  readonly canQueueOperations: boolean;
  readonly canResynchronize: boolean;
}

export interface OfflineSynchronizationStateSnapshotDto {
  readonly contractVersion: OfflineSynchronizationContractVersion;
  readonly workspaceId: string;
  readonly cachedResources: ReadonlyArray<OfflineCachedResourceMetadataDto>;
  readonly drafts: ReadonlyArray<OfflineDraftStateDto>;
  readonly queue: OfflineSyncQueueStateDto;
  readonly status: OfflineSynchronizationStatusDto;
  readonly connectivity: OfflineConnectivitySurfaceStateDto;
}

export function deriveOfflineSynchronizationStatus(input: {
  readonly queue: OfflineSyncQueueStateDto;
  readonly connectivity: OfflineConnectivitySurfaceStateDto;
  readonly lastSynchronizedAt?: string;
  readonly lastAttemptedAt?: string;
}): OfflineSynchronizationStatusDto {
  const pendingOperationCount = input.queue.operations
    .filter((operation) => operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.queuedPendingSync)
    .length;
  const conflictCount = input.queue.operations
    .filter((operation) => operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.syncConflict)
    .length;
  const rejectedCount = input.queue.operations
    .filter((operation) => operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.syncRejected)
    .length;

  let state: OfflineSynchronizationState = OfflineSynchronizationStates.idle;
  if (conflictCount > 0) {
    state = OfflineSynchronizationStates.blockedConflict;
  } else if (input.connectivity.canResynchronize && pendingOperationCount > 0) {
    state = OfflineSynchronizationStates.synchronizing;
  } else if (!input.connectivity.canResynchronize && pendingOperationCount > 0) {
    state = OfflineSynchronizationStates.failed;
  }

  return Object.freeze({
    state,
    pendingOperationCount,
    conflictCount,
    rejectedCount,
    lastSynchronizedAt: input.lastSynchronizedAt,
    lastAttemptedAt: input.lastAttemptedAt,
    reasonCode: state === OfflineSynchronizationStates.failed ? "resynchronization-unavailable" : undefined,
  });
}

function resolveAllowedOfflineDraftSyncTransitions(
  status: OfflineDraftSyncStatus,
): ReadonlyArray<OfflineDraftSyncStatus> {
  const transitions: Record<OfflineDraftSyncStatus, ReadonlyArray<OfflineDraftSyncStatus>> = {
    [OfflineDraftSyncStatuses.localOnly]: Object.freeze([
      OfflineDraftSyncStatuses.localOnly,
      OfflineDraftSyncStatuses.queuedPendingSync,
    ]),
    [OfflineDraftSyncStatuses.queuedPendingSync]: Object.freeze([
      OfflineDraftSyncStatuses.queuedPendingSync,
      OfflineDraftSyncStatuses.syncConflict,
      OfflineDraftSyncStatuses.syncRejected,
      OfflineDraftSyncStatuses.syncApplied,
    ]),
    [OfflineDraftSyncStatuses.syncConflict]: Object.freeze([
      OfflineDraftSyncStatuses.syncConflict,
      OfflineDraftSyncStatuses.queuedPendingSync,
      OfflineDraftSyncStatuses.syncRejected,
    ]),
    [OfflineDraftSyncStatuses.syncRejected]: Object.freeze([
      OfflineDraftSyncStatuses.syncRejected,
      OfflineDraftSyncStatuses.queuedPendingSync,
    ]),
    [OfflineDraftSyncStatuses.syncApplied]: Object.freeze([
      OfflineDraftSyncStatuses.syncApplied,
      OfflineDraftSyncStatuses.localOnly,
    ]),
  };
  return transitions[status];
}

export function transitionOfflineDraftSyncStatus(input: {
  readonly draft: OfflineDraftStateDto;
  readonly nextStatus: OfflineDraftSyncStatus;
  readonly queuedMutationId?: string;
}): OfflineDraftStateDto {
  const allowed = resolveAllowedOfflineDraftSyncTransitions(input.draft.syncStatus);
  if (!allowed.includes(input.nextStatus)) {
    throw new OfflineSynchronizationContractError(
      `Draft '${input.draft.draftId}' cannot transition from '${input.draft.syncStatus}' to '${input.nextStatus}'.`,
    );
  }

  const queuedMutationId = input.nextStatus === OfflineDraftSyncStatuses.queuedPendingSync
    ? normalizeRequired(input.queuedMutationId ?? input.draft.queuedMutationId ?? "", "Draft queuedMutationId")
    : undefined;

  return Object.freeze({
    ...input.draft,
    syncStatus: input.nextStatus,
    queuedMutationId,
  });
}

function resolveAllowedOfflinePendingOperationStatusTransitions(
  status: OfflinePendingOperationStatus,
): ReadonlyArray<OfflinePendingOperationStatus> {
  const transitions: Record<OfflinePendingOperationStatus, ReadonlyArray<OfflinePendingOperationStatus>> = {
    [OfflinePendingOperationStatuses.queuedPendingSync]: Object.freeze([
      OfflinePendingOperationStatuses.queuedPendingSync,
      OfflinePendingOperationStatuses.syncConflict,
      OfflinePendingOperationStatuses.syncRejected,
      OfflinePendingOperationStatuses.syncApplied,
    ]),
    [OfflinePendingOperationStatuses.syncConflict]: Object.freeze([
      OfflinePendingOperationStatuses.syncConflict,
      OfflinePendingOperationStatuses.queuedPendingSync,
      OfflinePendingOperationStatuses.syncRejected,
    ]),
    [OfflinePendingOperationStatuses.syncRejected]: Object.freeze([
      OfflinePendingOperationStatuses.syncRejected,
      OfflinePendingOperationStatuses.queuedPendingSync,
    ]),
    [OfflinePendingOperationStatuses.syncApplied]: Object.freeze([
      OfflinePendingOperationStatuses.syncApplied,
    ]),
  };
  return transitions[status];
}

export function transitionOfflinePendingOperationStatus(input: {
  readonly operation: OfflinePendingOperationEnvelopeDto;
  readonly nextStatus: OfflinePendingOperationStatus;
  readonly lastAttemptedAt?: string;
  readonly retryCount?: number;
}): OfflinePendingOperationEnvelopeDto {
  const allowed = resolveAllowedOfflinePendingOperationStatusTransitions(input.operation.userVisibleSyncStatus);
  if (!allowed.includes(input.nextStatus)) {
    throw new OfflineSynchronizationContractError(
      `Operation '${input.operation.operationId}' cannot transition from '${input.operation.userVisibleSyncStatus}' to '${input.nextStatus}'.`,
    );
  }

  return Object.freeze({
    ...input.operation,
    userVisibleSyncStatus: input.nextStatus,
    retryCount: Math.max(input.operation.retryCount, Math.floor(input.retryCount ?? input.operation.retryCount)),
    lastAttemptedAt: input.lastAttemptedAt ?? input.operation.lastAttemptedAt,
  });
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineSynchronizationContractError(`${field} is required.`);
  }
  return normalized;
}

export function createOfflineSynchronizationStateSnapshot(input: {
  readonly workspaceId: string;
  readonly cachedResources: ReadonlyArray<OfflineCachedResourceMetadataDto>;
  readonly drafts: ReadonlyArray<OfflineDraftStateDto>;
  readonly queue: OfflineSyncQueueStateDto;
  readonly connectivity: OfflineConnectivitySurfaceStateDto;
  readonly status?: OfflineSynchronizationStatusDto;
  readonly lastSynchronizedAt?: string;
  readonly lastAttemptedAt?: string;
}): OfflineSynchronizationStateSnapshotDto {
  const status = input.status ?? deriveOfflineSynchronizationStatus({
    queue: input.queue,
    connectivity: input.connectivity,
    lastSynchronizedAt: input.lastSynchronizedAt,
    lastAttemptedAt: input.lastAttemptedAt,
  });

  return Object.freeze({
    contractVersion: OfflineSynchronizationContractVersions.v1,
    workspaceId: normalizeRequired(input.workspaceId, "Offline synchronization snapshot workspaceId"),
    cachedResources: Object.freeze([...input.cachedResources]),
    drafts: Object.freeze([...input.drafts]),
    queue: input.queue,
    status,
    connectivity: input.connectivity,
  });
}
