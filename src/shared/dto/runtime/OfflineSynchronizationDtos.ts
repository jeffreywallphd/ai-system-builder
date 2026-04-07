import type {
  OfflineQueuedMutationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import type {
  OfflineResynchronizationDecision,
} from "@application/common/OfflineLocalModeResynchronization";
import {
  type OfflinePendingOperationReplayDescriptorDto,
  OfflineConnectivityStates,
  OfflineConflictSeverities,
  OfflineReconciliationActions,
  type OfflineCachedResourceMetadataDto,
  type OfflineConnectivitySurfaceStateDto,
  type OfflineConflictIndicatorDto,
  type OfflineDraftStateDto,
  type OfflinePendingOperationEnvelopeDto,
  type OfflineReconciliationOutcomeDto,
  type OfflineSynchronizationStateSnapshotDto,
  type OfflineSynchronizationStatusDto,
  type OfflineSyncQueueStateDto,
  createOfflineSynchronizationStateSnapshot,
} from "../../contracts/runtime/OfflineSynchronizationContracts";

export interface OfflineSynchronizationStateReadResponseDto {
  readonly state: OfflineSynchronizationStateSnapshotDto;
}

export interface OfflineSynchronizationStateWriteRequestDto {
  readonly workspaceId: string;
  readonly state: OfflineSynchronizationStateSnapshotDto;
  readonly persistedAt?: string;
}

export interface RuntimeRealtimeConnectionStateLike {
  readonly state: "connecting" | "connected" | "reconnecting" | "degraded" | "disconnected";
  readonly stale: boolean;
  readonly detail?: string;
}

export function toOfflinePendingOperationEnvelopeDto(
  envelope: OfflineQueuedMutationEnvelope,
  options?: {
    readonly retryCount?: number;
    readonly lastAttemptedAt?: string;
  },
): OfflinePendingOperationEnvelopeDto {
  const replayDescriptor: OfflinePendingOperationReplayDescriptorDto = Object.freeze({
    method: envelope.replayDescriptor.method,
    path: envelope.replayDescriptor.path,
    idempotencyKey: envelope.replayDescriptor.idempotencyKey,
    payload: Object.freeze({ ...envelope.replayDescriptor.payload }),
    payloadContentType: envelope.replayDescriptor.payloadContentType,
  });

  return Object.freeze({
    operationId: envelope.mutationId,
    targetResourceClass: envelope.targetResourceClass,
    targetResourceId: envelope.targetResourceId,
    intent: envelope.intent,
    baseAuthoritativeRevision: envelope.baseAuthoritativeRevision,
    localMutationRevision: envelope.localMutationRevision,
    queuedAt: envelope.queuedAt,
    userVisibleSyncStatus: envelope.userVisibleSyncStatus,
    divergenceDisclosureToken: envelope.divergenceDisclosureToken,
    replayDescriptor,
    retryCount: Math.max(0, Math.floor(options?.retryCount ?? 0)),
    lastAttemptedAt: options?.lastAttemptedAt,
  });
}

export function toOfflineReconciliationOutcomeDto(
  decision: OfflineResynchronizationDecision,
  options?: {
    readonly resolvedAt?: string;
    readonly conflictCode?: string;
    readonly conflictSummary?: string;
    readonly authoritativeRevision?: string;
    readonly localMutationRevision?: number;
  },
): OfflineReconciliationOutcomeDto {
  const resolvedAt = options?.resolvedAt ?? new Date().toISOString();
  const conflicts: ReadonlyArray<OfflineConflictIndicatorDto> | undefined =
    decision.action === OfflineReconciliationActions.conflictRequiresReview
      ? Object.freeze([Object.freeze({
        operationId: decision.mutationId,
        resourceClass: "workflow-draft",
        resourceId: "unknown",
        severity: OfflineConflictSeverities.high,
        conflictCode: options?.conflictCode ?? "authoritative-revision-mismatch",
        summary: options?.conflictSummary ?? decision.reason,
        authoritativeRevision: options?.authoritativeRevision,
        localMutationRevision: options?.localMutationRevision,
        detectedAt: resolvedAt,
        requiresUserAttention: true,
      })])
      : undefined;

  return Object.freeze({
    operationId: decision.mutationId,
    action: decision.action,
    requiresUserAttention: decision.requiresUserAttention,
    reason: decision.reason,
    resolvedAt,
    conflicts,
  });
}

export function toOfflineConnectivitySurfaceStateDto(
  state: RuntimeRealtimeConnectionStateLike,
  options?: {
    readonly localModeActive?: boolean;
    readonly lastChangedAt?: string;
    readonly canQueueOperations?: boolean;
  },
): OfflineConnectivitySurfaceStateDto {
  const resolvedState = Object.values(OfflineConnectivityStates).includes(state.state)
    ? state.state
    : OfflineConnectivityStates.disconnected;

  const canResynchronize =
    resolvedState === OfflineConnectivityStates.connected
    || resolvedState === OfflineConnectivityStates.reconnecting
    || resolvedState === OfflineConnectivityStates.degraded;

  return Object.freeze({
    state: resolvedState,
    stale: state.stale,
    localModeActive: options?.localModeActive ?? resolvedState !== OfflineConnectivityStates.connected,
    detail: state.detail,
    lastChangedAt: options?.lastChangedAt ?? new Date().toISOString(),
    canQueueOperations: options?.canQueueOperations ?? true,
    canResynchronize,
  });
}

export function toOfflineSyncQueueStateDto(input: {
  readonly queueId: string;
  readonly operations: ReadonlyArray<OfflinePendingOperationEnvelopeDto>;
  readonly pendingRunSubmissions?: ReadonlyArray<{
    readonly submissionId: string;
    readonly operationId: string;
    readonly workflowDefinitionId: string;
    readonly inputDigest: string;
    readonly requestedAt: string;
    readonly requestedByActorUserIdentityId: string;
  }>;
  readonly outcomes?: ReadonlyArray<OfflineReconciliationOutcomeDto>;
  readonly updatedAt?: string;
}): OfflineSyncQueueStateDto {
  return Object.freeze({
    queueId: input.queueId,
    operations: Object.freeze([...input.operations]),
    pendingRunSubmissions: Object.freeze([...(input.pendingRunSubmissions ?? [])]),
    outcomes: Object.freeze([...(input.outcomes ?? [])]),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
}

export function toOfflineSynchronizationStateSnapshotDto(input: {
  readonly workspaceId: string;
  readonly cachedResources: ReadonlyArray<OfflineCachedResourceMetadataDto>;
  readonly drafts: ReadonlyArray<OfflineDraftStateDto>;
  readonly queue: OfflineSyncQueueStateDto;
  readonly connectivity: OfflineConnectivitySurfaceStateDto;
  readonly status?: OfflineSynchronizationStatusDto;
  readonly lastSynchronizedAt?: string;
  readonly lastAttemptedAt?: string;
}): OfflineSynchronizationStateSnapshotDto {
  return createOfflineSynchronizationStateSnapshot(input);
}
