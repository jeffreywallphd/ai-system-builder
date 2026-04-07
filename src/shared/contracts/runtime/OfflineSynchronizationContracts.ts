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
  readonly draftRevision: number;
  readonly dirty: boolean;
  readonly lastEditedAt: string;
  readonly lastEditedByActorUserIdentityId: string;
  readonly localChanges: ReadonlyArray<OfflineLocalChangeRecordDto>;
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
  readonly retryCount: number;
  readonly lastAttemptedAt?: string;
}

export interface OfflineConflictIndicatorDto {
  readonly operationId: string;
  readonly resourceClass: OfflineSyncResourceClass;
  readonly resourceId: string;
  readonly severity: OfflineConflictSeverity;
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
  readonly reason: string;
  readonly resolvedAt: string;
  readonly authoritativeRevisionAfter?: string;
  readonly conflicts?: ReadonlyArray<OfflineConflictIndicatorDto>;
}

export interface OfflineSyncQueueStateDto {
  readonly queueId: string;
  readonly operations: ReadonlyArray<OfflinePendingOperationEnvelopeDto>;
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
