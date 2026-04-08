import {
  type OfflineAuthoritativeSnapshotCacheService,
} from "@application/common/OfflineAuthoritativeSnapshotCache";
import {
  type IOfflineConnectivityStatePort,
  type OfflineControlledResynchronizationResult,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import {
  type OfflinePendingOperationRecord,
  type OfflinePendingOperationService,
} from "@application/common/OfflinePendingOperationPersistence";
import {
  type OfflineLocalExecutionRegistrationRecord,
  type OfflineLocalExecutionRegistrationService,
} from "@application/common/OfflineLocalExecutionRegistrationPersistence";
import {
  OfflineQueuedMutationStatuses,
  resolveOfflineResourceAuthorityBoundary,
  OfflineAuthorityScopes,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineLocalExecutionRegistrationStatuses,
  type OfflineConnectivitySurfaceStateDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";

export class OfflineDesktopStartupRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineDesktopStartupRecoveryError";
  }
}

export const OfflineDesktopStartupRecoveryActionKinds = Object.freeze({
  interruptedResynchronizationDetected: "interrupted-resynchronization-detected",
  interruptedResynchronizationRetried: "interrupted-resynchronization-retried",
  operationRetryable: "operation-retryable",
  operationManualFollowUp: "operation-manual-follow-up",
  registrationRetryable: "registration-retryable",
  registrationManualFollowUp: "registration-manual-follow-up",
  preservedDraftDetected: "preserved-draft-detected",
  expiredSnapshotDetected: "expired-snapshot-detected",
});

export type OfflineDesktopStartupRecoveryActionKind =
  typeof OfflineDesktopStartupRecoveryActionKinds[keyof typeof OfflineDesktopStartupRecoveryActionKinds];

export const OfflineDesktopStartupRecoveryActionStatuses = Object.freeze({
  applied: "applied",
  manualFollowUp: "manual-follow-up",
});

export type OfflineDesktopStartupRecoveryActionStatus =
  typeof OfflineDesktopStartupRecoveryActionStatuses[keyof typeof OfflineDesktopStartupRecoveryActionStatuses];

export interface OfflineDesktopStartupRecoveryAction {
  readonly kind: OfflineDesktopStartupRecoveryActionKind;
  readonly status: OfflineDesktopStartupRecoveryActionStatus;
  readonly occurredAt: string;
  readonly message: string;
  readonly operationId?: string;
  readonly registrationId?: string;
  readonly resourceKey?: string;
  readonly syncAttemptId?: string;
}

export const OfflineResynchronizationAttemptMarkerStatuses = Object.freeze({
  started: "started",
  completed: "completed",
});

export type OfflineResynchronizationAttemptMarkerStatus =
  typeof OfflineResynchronizationAttemptMarkerStatuses[keyof typeof OfflineResynchronizationAttemptMarkerStatuses];

export interface OfflineResynchronizationAttemptMarker {
  readonly workspaceId: string;
  readonly syncAttemptId: string;
  readonly actorUserIdentityId: string;
  readonly requestId?: string;
  readonly startedAt: string;
  readonly status: OfflineResynchronizationAttemptMarkerStatus;
  readonly completedAt?: string;
  readonly completionOutcome?: "succeeded" | "failed" | "conflict";
  readonly lastErrorSummary?: string;
  readonly updatedAt: string;
}

export interface IOfflineResynchronizationRecoveryStateRepository {
  markAttemptStarted(input: {
    readonly workspaceId: string;
    readonly syncAttemptId: string;
    readonly actorUserIdentityId: string;
    readonly requestId?: string;
    readonly startedAt: string;
  }): Promise<void>;
  markAttemptCompleted(input: {
    readonly workspaceId: string;
    readonly syncAttemptId: string;
    readonly completedAt: string;
    readonly completionOutcome: "succeeded" | "failed" | "conflict";
    readonly lastErrorSummary?: string;
  }): Promise<void>;
  listAttemptsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflineResynchronizationAttemptMarker>>;
  listInterruptedAttempts(workspaceId: string): Promise<ReadonlyArray<OfflineResynchronizationAttemptMarker>>;
}

export interface OfflineDesktopStartupRecoveryInspectionResult {
  readonly workspaceId: string;
  readonly checkedAt: string;
  readonly connectivity: OfflineConnectivitySurfaceStateDto;
  readonly interruptedAttempts: ReadonlyArray<OfflineResynchronizationAttemptMarker>;
  readonly retryableOperationIds: ReadonlyArray<string>;
  readonly retryableRegistrationIds: ReadonlyArray<string>;
  readonly manualFollowUpOperationIds: ReadonlyArray<string>;
  readonly manualFollowUpRegistrationIds: ReadonlyArray<string>;
  readonly preservedDraftResourceKeys: ReadonlyArray<string>;
  readonly expiredSnapshotKeys: ReadonlyArray<string>;
  readonly actions: ReadonlyArray<OfflineDesktopStartupRecoveryAction>;
  readonly summary: {
    readonly appliedCount: number;
    readonly manualFollowUpCount: number;
    readonly interruptedAttemptCount: number;
    readonly retryableOperationCount: number;
    readonly retryableRegistrationCount: number;
    readonly preservedDraftCount: number;
    readonly expiredSnapshotCount: number;
  };
}

export interface OfflineDesktopStartupRecoveryResult extends OfflineDesktopStartupRecoveryInspectionResult {
  readonly autoResynchronizationAttempted: boolean;
  readonly autoResynchronizationResult?: OfflineControlledResynchronizationResult;
}

export interface OfflineDesktopStartupRecoveryOptions {
  readonly now?: () => Date;
}

export class OfflineDesktopStartupRecoveryService {
  private readonly now: () => Date;

  constructor(
    private readonly pendingOperationService: OfflinePendingOperationService,
    private readonly localExecutionRegistrationService: OfflineLocalExecutionRegistrationService,
    private readonly snapshotCacheService: OfflineAuthoritativeSnapshotCacheService,
    private readonly connectivityPort: IOfflineConnectivityStatePort,
    private readonly recoveryStateRepository: IOfflineResynchronizationRecoveryStateRepository,
    options?: OfflineDesktopStartupRecoveryOptions,
  ) {
    this.now = options?.now ?? (() => new Date());
  }

  public async inspectWorkspace(input: {
    readonly workspaceId: string;
    readonly checkedAt?: string;
  }): Promise<OfflineDesktopStartupRecoveryInspectionResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const checkedAt = normalizeIsoTimestamp(input.checkedAt ?? this.now().toISOString(), "checkedAt");
    const connectivity = await this.connectivityPort.getConnectivityState();
    const interruptedAttempts = await this.recoveryStateRepository.listInterruptedAttempts(workspaceId);
    const pendingOperations = await this.pendingOperationService.listQueuedOperations(workspaceId);
    const queuedRegistrations = await this.localExecutionRegistrationService.listQueuedRegistrations(workspaceId);
    const cachedSnapshots = await this.snapshotCacheService.listWorkspaceSnapshots(workspaceId);

    const retryableOperationIds = new Set<string>();
    const retryableRegistrationIds = new Set<string>();
    const manualFollowUpOperationIds = new Set<string>();
    const manualFollowUpRegistrationIds = new Set<string>();
    const preservedDraftResourceKeys = new Set<string>();
    const expiredSnapshotKeys = new Set<string>();
    const actions: OfflineDesktopStartupRecoveryAction[] = [];

    for (const interruptedAttempt of interruptedAttempts) {
      actions.push(Object.freeze({
        kind: OfflineDesktopStartupRecoveryActionKinds.interruptedResynchronizationDetected,
        status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
        occurredAt: checkedAt,
        syncAttemptId: interruptedAttempt.syncAttemptId,
        message: `Interrupted resynchronization attempt '${interruptedAttempt.syncAttemptId}' was detected and retained for explicit recovery handling.`,
      }));
    }

    for (const record of pendingOperations) {
      const operationId = record.operation.mutationId;
      const resourceKey = makeResourceKey(
        record.operation.targetResourceClass,
        record.operation.targetResourceId,
      );
      const preserveDraft = shouldPreserveDraft(record);
      if (preserveDraft) {
        preservedDraftResourceKeys.add(resourceKey);
        actions.push(Object.freeze({
          kind: OfflineDesktopStartupRecoveryActionKinds.preservedDraftDetected,
          status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
          occurredAt: checkedAt,
          operationId,
          resourceKey,
          message: `Preserved local draft state remains unsynced for '${resourceKey}'.`,
        }));
      }

      if (isOperationRetryable(record, checkedAt)) {
        retryableOperationIds.add(operationId);
        actions.push(Object.freeze({
          kind: OfflineDesktopStartupRecoveryActionKinds.operationRetryable,
          status: OfflineDesktopStartupRecoveryActionStatuses.applied,
          occurredAt: checkedAt,
          operationId,
          resourceKey,
          message: `Queued operation '${operationId}' remains retryable for controlled replay.`,
        }));
        continue;
      }

      manualFollowUpOperationIds.add(operationId);
      actions.push(Object.freeze({
        kind: OfflineDesktopStartupRecoveryActionKinds.operationManualFollowUp,
        status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
        occurredAt: checkedAt,
        operationId,
        resourceKey,
        message: buildPendingOperationManualFollowUpMessage(record),
      }));
    }

    for (const record of queuedRegistrations) {
      const registrationId = record.registration.registrationId;
      const resourceKey = makeResourceKey(record.registration.resourceClass, record.registration.resourceId);
      if (isRegistrationRetryable(record, checkedAt)) {
        retryableRegistrationIds.add(registrationId);
        actions.push(Object.freeze({
          kind: OfflineDesktopStartupRecoveryActionKinds.registrationRetryable,
          status: OfflineDesktopStartupRecoveryActionStatuses.applied,
          occurredAt: checkedAt,
          registrationId,
          resourceKey,
          message: `Queued local execution registration '${registrationId}' remains retryable for reconnect linkage.`,
        }));
        continue;
      }

      manualFollowUpRegistrationIds.add(registrationId);
      actions.push(Object.freeze({
        kind: OfflineDesktopStartupRecoveryActionKinds.registrationManualFollowUp,
        status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
        occurredAt: checkedAt,
        registrationId,
        resourceKey,
        message: buildRegistrationManualFollowUpMessage(record),
      }));
    }

    for (const snapshot of cachedSnapshots) {
      if (!snapshot.expiresAt) {
        continue;
      }
      if (Date.parse(snapshot.expiresAt) > Date.parse(checkedAt)) {
        continue;
      }
      const resourceKey = makeResourceKey(snapshot.resourceClass, snapshot.resourceId);
      expiredSnapshotKeys.add(resourceKey);
      actions.push(Object.freeze({
        kind: OfflineDesktopStartupRecoveryActionKinds.expiredSnapshotDetected,
        status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
        occurredAt: checkedAt,
        resourceKey,
        message: `Expired offline snapshot '${resourceKey}' was retained for explicit reconnect refresh or manual follow-up.`,
      }));
    }

    const sortedActions = Object.freeze(
      [...actions].sort((left, right) => left.message.localeCompare(right.message)),
    );
    const appliedCount = sortedActions.filter(
      (entry) => entry.status === OfflineDesktopStartupRecoveryActionStatuses.applied,
    ).length;
    const manualFollowUpCount = sortedActions.length - appliedCount;

    return Object.freeze({
      workspaceId,
      checkedAt,
      connectivity,
      interruptedAttempts: Object.freeze(
        [...interruptedAttempts].sort((left, right) => left.syncAttemptId.localeCompare(right.syncAttemptId)),
      ),
      retryableOperationIds: Object.freeze([...retryableOperationIds].sort((left, right) => left.localeCompare(right))),
      retryableRegistrationIds: Object.freeze(
        [...retryableRegistrationIds].sort((left, right) => left.localeCompare(right)),
      ),
      manualFollowUpOperationIds: Object.freeze(
        [...manualFollowUpOperationIds].sort((left, right) => left.localeCompare(right)),
      ),
      manualFollowUpRegistrationIds: Object.freeze(
        [...manualFollowUpRegistrationIds].sort((left, right) => left.localeCompare(right)),
      ),
      preservedDraftResourceKeys: Object.freeze(
        [...preservedDraftResourceKeys].sort((left, right) => left.localeCompare(right)),
      ),
      expiredSnapshotKeys: Object.freeze([...expiredSnapshotKeys].sort((left, right) => left.localeCompare(right))),
      actions: sortedActions,
      summary: Object.freeze({
        appliedCount,
        manualFollowUpCount,
        interruptedAttemptCount: interruptedAttempts.length,
        retryableOperationCount: retryableOperationIds.size,
        retryableRegistrationCount: retryableRegistrationIds.size,
        preservedDraftCount: preservedDraftResourceKeys.size,
        expiredSnapshotCount: expiredSnapshotKeys.size,
      }),
    });
  }

  public async recoverWorkspaceStartup(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly requestId?: string;
    readonly checkedAt?: string;
    readonly autoRetryInterruptedResynchronization?: boolean;
    readonly executeResynchronization: (input: {
      readonly workspaceId: string;
      readonly actorUserIdentityId: string;
      readonly requestId?: string;
      readonly syncAttemptId?: string;
      readonly attemptedAt?: string;
    }) => Promise<OfflineControlledResynchronizationResult>;
  }): Promise<OfflineDesktopStartupRecoveryResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const checkedAt = normalizeIsoTimestamp(input.checkedAt ?? this.now().toISOString(), "checkedAt");
    const inspection = await this.inspectWorkspace({
      workspaceId,
      checkedAt,
    });

    const actions = [...inspection.actions];
    let autoResynchronizationResult: OfflineControlledResynchronizationResult | undefined;
    let autoResynchronizationAttempted = false;
    const latestInterruptedAttempt = [...inspection.interruptedAttempts]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];

    if (input.autoRetryInterruptedResynchronization && latestInterruptedAttempt) {
      if (
        inspection.connectivity.canResynchronize
        && (inspection.retryableOperationIds.length > 0 || inspection.retryableRegistrationIds.length > 0)
      ) {
        try {
          autoResynchronizationAttempted = true;
          autoResynchronizationResult = await input.executeResynchronization({
            workspaceId,
            actorUserIdentityId,
            requestId: input.requestId,
            syncAttemptId: latestInterruptedAttempt.syncAttemptId,
            attemptedAt: checkedAt,
          });
          await this.recoveryStateRepository.markAttemptCompleted({
            workspaceId,
            syncAttemptId: latestInterruptedAttempt.syncAttemptId,
            completedAt: checkedAt,
            completionOutcome: deriveResynchronizationOutcome(autoResynchronizationResult),
          });
          actions.push(Object.freeze({
            kind: OfflineDesktopStartupRecoveryActionKinds.interruptedResynchronizationRetried,
            status: OfflineDesktopStartupRecoveryActionStatuses.applied,
            occurredAt: checkedAt,
            syncAttemptId: latestInterruptedAttempt.syncAttemptId,
            message: `Retried interrupted resynchronization attempt '${latestInterruptedAttempt.syncAttemptId}' during startup recovery.`,
          }));
        } catch (error) {
          await this.recoveryStateRepository.markAttemptCompleted({
            workspaceId,
            syncAttemptId: latestInterruptedAttempt.syncAttemptId,
            completedAt: checkedAt,
            completionOutcome: "failed",
            lastErrorSummary: summarizeError(error),
          });
          actions.push(Object.freeze({
            kind: OfflineDesktopStartupRecoveryActionKinds.interruptedResynchronizationRetried,
            status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
            occurredAt: checkedAt,
            syncAttemptId: latestInterruptedAttempt.syncAttemptId,
            message: `Interrupted resynchronization attempt '${latestInterruptedAttempt.syncAttemptId}' retry failed during startup recovery and now requires manual follow-up.`,
          }));
        }
      } else {
        actions.push(Object.freeze({
          kind: OfflineDesktopStartupRecoveryActionKinds.interruptedResynchronizationRetried,
          status: OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp,
          occurredAt: checkedAt,
          syncAttemptId: latestInterruptedAttempt.syncAttemptId,
          message: `Interrupted resynchronization attempt '${latestInterruptedAttempt.syncAttemptId}' requires manual follow-up because retry prerequisites are not satisfied.`,
        }));
      }
    }

    const sortedActions = Object.freeze(
      [...actions].sort((left, right) => left.message.localeCompare(right.message)),
    );
    const appliedCount = sortedActions.filter(
      (entry) => entry.status === OfflineDesktopStartupRecoveryActionStatuses.applied,
    ).length;
    const manualFollowUpCount = sortedActions.length - appliedCount;

    return Object.freeze({
      ...inspection,
      actions: sortedActions,
      summary: Object.freeze({
        ...inspection.summary,
        appliedCount,
        manualFollowUpCount,
      }),
      autoResynchronizationAttempted,
      autoResynchronizationResult,
    });
  }
}

function deriveResynchronizationOutcome(
  result: OfflineControlledResynchronizationResult,
): "succeeded" | "failed" | "conflict" {
  const nonApplyCount = result.outcomes.filter((entry) => entry.action !== "apply-to-authoritative").length;
  if (nonApplyCount === 0) {
    return "succeeded";
  }

  const hasConflict = result.outcomes.some((entry) => entry.action === "conflict-requires-review");
  return hasConflict ? "conflict" : "failed";
}

function shouldPreserveDraft(record: OfflinePendingOperationRecord): boolean {
  return resolveOfflineResourceAuthorityBoundary(record.operation.targetResourceClass).authoritativeStateScope
    === OfflineAuthorityScopes.localDraft;
}

function makeResourceKey(resourceClass: string, resourceId: string): string {
  return `${resourceClass}::${resourceId}`;
}

function isOperationRetryable(record: OfflinePendingOperationRecord, checkedAt: string): boolean {
  if (record.operation.userVisibleSyncStatus !== OfflineQueuedMutationStatuses.queuedPendingSync) {
    return false;
  }
  if (!record.retryability.retryable) {
    return false;
  }
  if (record.retryability.retryCount >= record.retryability.maxRetryCount) {
    return false;
  }
  if (!record.retryability.nextEligibleReplayAt) {
    return true;
  }
  return Date.parse(record.retryability.nextEligibleReplayAt) <= Date.parse(checkedAt);
}

function isRegistrationRetryable(record: OfflineLocalExecutionRegistrationRecord, checkedAt: string): boolean {
  if (
    record.registration.userVisibleRegistrationStatus
    !== OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration
  ) {
    return false;
  }
  if (!record.retryability.retryable) {
    return false;
  }
  if (record.retryability.retryCount >= record.retryability.maxRetryCount) {
    return false;
  }
  if (!record.retryability.nextEligibleReplayAt) {
    return true;
  }
  return Date.parse(record.retryability.nextEligibleReplayAt) <= Date.parse(checkedAt);
}

function buildPendingOperationManualFollowUpMessage(record: OfflinePendingOperationRecord): string {
  const operationId = record.operation.mutationId;
  if (record.operation.userVisibleSyncStatus === OfflineQueuedMutationStatuses.syncConflict) {
    return `Queued operation '${operationId}' remains in sync-conflict and requires explicit user follow-up.`;
  }
  if (record.operation.userVisibleSyncStatus === OfflineQueuedMutationStatuses.syncRejected) {
    return `Queued operation '${operationId}' remains sync-rejected and requires explicit user follow-up.`;
  }
  if (!record.retryability.retryable) {
    const code = record.retryability.nonRetryableReasonCode
      ? ` (${record.retryability.nonRetryableReasonCode})`
      : "";
    return `Queued operation '${operationId}' is non-retryable${code} and requires explicit user follow-up.`;
  }
  if (record.retryability.retryCount >= record.retryability.maxRetryCount) {
    return `Queued operation '${operationId}' exceeded max retry attempts and requires explicit user follow-up.`;
  }
  if (record.retryability.nextEligibleReplayAt) {
    return `Queued operation '${operationId}' is deferred until '${record.retryability.nextEligibleReplayAt}' and remains pending follow-up.`;
  }
  return `Queued operation '${operationId}' requires explicit manual follow-up.`;
}

function buildRegistrationManualFollowUpMessage(record: OfflineLocalExecutionRegistrationRecord): string {
  const registrationId = record.registration.registrationId;
  if (
    record.registration.userVisibleRegistrationStatus
    === OfflineLocalExecutionRegistrationStatuses.registrationConflict
  ) {
    return `Local execution registration '${registrationId}' remains in registration-conflict and requires explicit user follow-up.`;
  }
  if (
    record.registration.userVisibleRegistrationStatus
    === OfflineLocalExecutionRegistrationStatuses.registrationRejected
  ) {
    return `Local execution registration '${registrationId}' remains registration-rejected and requires explicit user follow-up.`;
  }
  if (!record.retryability.retryable) {
    const code = record.retryability.nonRetryableReasonCode
      ? ` (${record.retryability.nonRetryableReasonCode})`
      : "";
    return `Local execution registration '${registrationId}' is non-retryable${code} and requires explicit user follow-up.`;
  }
  if (record.retryability.retryCount >= record.retryability.maxRetryCount) {
    return `Local execution registration '${registrationId}' exceeded max retry attempts and requires explicit user follow-up.`;
  }
  if (record.retryability.nextEligibleReplayAt) {
    return `Local execution registration '${registrationId}' is deferred until '${record.retryability.nextEligibleReplayAt}' and remains pending follow-up.`;
  }
  return `Local execution registration '${registrationId}' requires explicit manual follow-up.`;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineDesktopStartupRecoveryError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflineDesktopStartupRecoveryError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error instanceof Error && error.name.trim()) {
    return error.name.trim();
  }
  return "offline-resynchronization-failed";
}
