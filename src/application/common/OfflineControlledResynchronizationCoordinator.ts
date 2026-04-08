import type {
  CacheOfflineAuthoritativeSnapshotRequest,
  OfflineAuthoritativeSnapshotCacheService,
} from "@application/common/OfflineAuthoritativeSnapshotCache";
import {
  type AuthoritativeResourceRevisionSnapshot,
  type OfflineResynchronizationDecisionRule,
  type OfflineResynchronizationConflictClass,
  OfflineResynchronizationActions,
  OfflineResynchronizationConflictClasses,
  OfflineResynchronizationDecisionRules,
  assertResynchronizationPlanPreventsSilentGlobalDivergence,
  planOfflineResynchronization,
} from "@application/common/OfflineLocalModeResynchronization";
import {
  type OfflinePendingOperationService,
  type OfflineReplayPreparationBlockedOperation,
  type PrepareOfflineReplayOperation,
} from "@application/common/OfflinePendingOperationPersistence";
import {
  OfflineAuthorityScopes,
  OfflineQueuedMutationStatuses,
  type OfflineResourceClass,
  resolveOfflineResourceAuthorityBoundary,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  type OfflineConnectivitySurfaceStateDto,
  type OfflineReconciliationOutcomeDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { toOfflineReconciliationOutcomeDto } from "@shared/dto/runtime/OfflineSynchronizationDtos";
import {
  OfflineOperationalEventChannels,
  OfflineOperationalEventTypes,
  type IOfflineOperationalEventSink,
  publishOfflineOperationalEventBestEffort,
} from "@application/common/OfflineOperationalEventPorts";

export class OfflineControlledResynchronizationCoordinatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineControlledResynchronizationCoordinatorError";
  }
}

export const AuthoritativeReplayExecutionResultKinds = Object.freeze({
  applied: "applied",
  conflict: "conflict",
  rejected: "rejected",
  failed: "failed",
});

export type AuthoritativeReplayExecutionResultKind =
  typeof AuthoritativeReplayExecutionResultKinds[keyof typeof AuthoritativeReplayExecutionResultKinds];

export interface AuthoritativeReplayExecutionResult {
  readonly kind: AuthoritativeReplayExecutionResultKind;
  readonly reason: string;
  readonly authoritativeRevisionAfter?: string;
  readonly conflictClass?: OfflineResynchronizationConflictClass;
  readonly decisionRule?: OfflineResynchronizationDecisionRule;
  readonly requiresUserAttention?: boolean;
  readonly requiresAdminAttention?: boolean;
  readonly preserveLocalDraftAsUnsynced?: boolean;
  readonly retryable?: boolean;
  readonly nextEligibleReplayAt?: string;
}

export const OfflinePendingOperationCleanupClassifications = Object.freeze({
  successful: "successful",
  failed: "failed",
  conflicted: "conflicted",
  abandoned: "abandoned",
});

export type OfflinePendingOperationCleanupClassification =
  typeof OfflinePendingOperationCleanupClassifications[keyof typeof OfflinePendingOperationCleanupClassifications];

export const OfflinePendingOperationCleanupActions = Object.freeze({
  removedFromQueue: "removed-from-queue",
  retainedForReview: "retained-for-review",
});

export type OfflinePendingOperationCleanupAction =
  typeof OfflinePendingOperationCleanupActions[keyof typeof OfflinePendingOperationCleanupActions];

export interface OfflinePendingOperationCleanupRecord {
  readonly operationId: string;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly previousStatus: string;
  readonly nextStatus: string;
  readonly classification: OfflinePendingOperationCleanupClassification;
  readonly cleanupAction: OfflinePendingOperationCleanupAction;
  readonly reason: string;
  readonly resolvedAt: string;
}

export interface OfflineAuthoritativeSnapshotFetchResponse
  extends Omit<CacheOfflineAuthoritativeSnapshotRequest, "cachedByActorUserIdentityId"> {}

export interface IOfflineAuthoritativeResynchronizationPort {
  fetchResourceRevisions(input: {
    readonly workspaceId: string;
    readonly resources: ReadonlyArray<{
      readonly resourceClass: OfflineResourceClass;
      readonly resourceId: string;
    }>;
  }): Promise<ReadonlyArray<AuthoritativeResourceRevisionSnapshot>>;
  replayPreparedOperation(input: {
    readonly workspaceId: string;
    readonly operation: PrepareOfflineReplayOperation;
    readonly attemptedAt: string;
  }): Promise<AuthoritativeReplayExecutionResult>;
  fetchResourceSnapshotForCache(input: {
    readonly workspaceId: string;
    readonly resourceClass: OfflineResourceClass;
    readonly resourceId: string;
  }): Promise<OfflineAuthoritativeSnapshotFetchResponse | undefined>;
}

export interface IOfflineConnectivityStatePort {
  getConnectivityState(): Promise<OfflineConnectivitySurfaceStateDto>;
}

export interface OfflineControlledResynchronizationResult {
  readonly workspaceId: string;
  readonly attemptedAt: string;
  readonly connectivity: OfflineConnectivitySurfaceStateDto;
  readonly replayPreparedOperationIds: ReadonlyArray<string>;
  readonly blockedOperationIds: ReadonlyArray<string>;
  readonly blockedOperations: ReadonlyArray<OfflineReplayPreparationBlockedOperation>;
  readonly replayedOperationIds: ReadonlyArray<string>;
  readonly appliedOperationIds: ReadonlyArray<string>;
  readonly refreshedSnapshotKeys: ReadonlyArray<string>;
  readonly invalidatedSnapshotKeys: ReadonlyArray<string>;
  readonly pendingOperationCleanupRecords: ReadonlyArray<OfflinePendingOperationCleanupRecord>;
  readonly outcomes: ReadonlyArray<OfflineReconciliationOutcomeDto>;
}

export interface OfflineControlledResynchronizationCoordinatorOptions {
  readonly now?: () => Date;
  readonly eventSink?: IOfflineOperationalEventSink;
}

export class OfflineControlledResynchronizationCoordinator {
  private readonly now: () => Date;
  private readonly eventSink: IOfflineOperationalEventSink | undefined;

  constructor(
    private readonly pendingOperationService: OfflinePendingOperationService,
    private readonly snapshotCacheService: OfflineAuthoritativeSnapshotCacheService,
    private readonly authoritativePort: IOfflineAuthoritativeResynchronizationPort,
    private readonly connectivityPort: IOfflineConnectivityStatePort,
    options?: OfflineControlledResynchronizationCoordinatorOptions,
  ) {
    this.now = options?.now ?? (() => new Date());
    this.eventSink = options?.eventSink;
  }

  public async synchronizeWorkspace(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly attemptedAt?: string;
  }): Promise<OfflineControlledResynchronizationResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const attemptedAt = normalizeIsoTimestamp(input.attemptedAt ?? this.now().toISOString(), "attemptedAt");
    const connectivity = await this.connectivityPort.getConnectivityState();

    if (!connectivity.canResynchronize) {
      return Object.freeze({
        workspaceId,
        attemptedAt,
        connectivity,
        replayPreparedOperationIds: Object.freeze([]),
        blockedOperationIds: Object.freeze([]),
        blockedOperations: Object.freeze([]),
        replayedOperationIds: Object.freeze([]),
        appliedOperationIds: Object.freeze([]),
        refreshedSnapshotKeys: Object.freeze([]),
        invalidatedSnapshotKeys: Object.freeze([]),
        pendingOperationCleanupRecords: Object.freeze([]),
        outcomes: Object.freeze([]),
      });
    }

    const replayPreparation = await this.pendingOperationService.prepareReplayOperations({
      workspaceId,
      preparedAt: attemptedAt,
    });
    const replayPreparedOperationIds = Object.freeze(
      replayPreparation.prepared.map((operation) => operation.operationId),
    );
    const blockedOperations = Object.freeze(replayPreparation.blocked.map((operation) => Object.freeze({
      ...operation,
    })));
    const blockedOperationIds = Object.freeze(blockedOperations.map((operation) => operation.operationId));

    const cachedSnapshots = await this.snapshotCacheService.listWorkspaceSnapshots(workspaceId);
    const resourceTargets = dedupeResourceTargets([
      ...cachedSnapshots.map((record) => ({
        resourceClass: record.resourceClass,
        resourceId: record.resourceId,
      })),
      ...replayPreparation.prepared.map((operation) => ({
        resourceClass: operation.targetResourceClass,
        resourceId: operation.targetResourceId,
      })),
    ]);
    const authoritativeRevisions = await this.authoritativePort.fetchResourceRevisions({
      workspaceId,
      resources: resourceTargets,
    });
    const revisionByResource = new Map<string, AuthoritativeResourceRevisionSnapshot>();
    for (const revision of authoritativeRevisions) {
      revisionByResource.set(makeResourceKey(revision.resourceClass, revision.resourceId), revision);
    }
    const refreshTargets = new Map<string, { readonly resourceClass: OfflineResourceClass; readonly resourceId: string }>();
    const invalidateTargets = new Map<string, { readonly resourceClass: OfflineResourceClass; readonly resourceId: string }>();
    const refreshedSnapshotKeys = new Set<string>();
    const invalidatedSnapshotKeys = new Set<string>();
    const pendingOperationCleanupRecords: OfflinePendingOperationCleanupRecord[] = [];

    const queueRefreshTarget = (target: { readonly resourceClass: OfflineResourceClass; readonly resourceId: string }) => {
      if (!isServerAuthoritativeResourceClass(target.resourceClass)) {
        return;
      }

      const key = makeResourceKey(target.resourceClass, target.resourceId);
      if (!invalidateTargets.has(key)) {
        refreshTargets.set(key, target);
      }
    };

    const queueInvalidationTarget = (target: { readonly resourceClass: OfflineResourceClass; readonly resourceId: string }) => {
      if (!isServerAuthoritativeResourceClass(target.resourceClass)) {
        return;
      }

      const key = makeResourceKey(target.resourceClass, target.resourceId);
      invalidateTargets.set(key, target);
      refreshTargets.delete(key);
    };

    for (const cached of cachedSnapshots) {
      const revision = revisionByResource.get(makeResourceKey(cached.resourceClass, cached.resourceId));
      if (!revision) {
        continue;
      }

      if (shouldInvalidateCachedSnapshotFromRevision(revision)) {
        queueInvalidationTarget({
          resourceClass: cached.resourceClass,
          resourceId: cached.resourceId,
        });
        continue;
      }

      if (
        revision.authoritativeRevision !== cached.authoritativeRevision
        || (
          revision.authoritativeSnapshotRevision
          && revision.authoritativeSnapshotRevision !== cached.authoritativeSnapshotRevision
        )
      ) {
        queueRefreshTarget({
          resourceClass: cached.resourceClass,
          resourceId: cached.resourceId,
        });
      }
    }

    const plannedDecisions = planOfflineResynchronization({
      queuedMutations: replayPreparation.prepared.map((entry) => entry.operationEnvelope),
      authoritativeRevisions,
    });
    assertResynchronizationPlanPreventsSilentGlobalDivergence(plannedDecisions);
    const decisionByOperationId = new Map(plannedDecisions.map((decision) => [decision.mutationId, decision]));

    const outcomes: OfflineReconciliationOutcomeDto[] = [];
    const replayedOperationIds: string[] = [];
    const appliedOperationIds: string[] = [];

    for (const blockedOperation of blockedOperations) {
      const blockedRecord = await this.pendingOperationService.findQueuedOperation(
        workspaceId,
        blockedOperation.operationId,
      );
      if (!blockedRecord) {
        continue;
      }

      if (blockedOperation.reasonCode === "operation-not-pending") {
        pendingOperationCleanupRecords.push(Object.freeze({
          operationId: blockedOperation.operationId,
          resourceClass: blockedRecord.operation.targetResourceClass,
          resourceId: blockedRecord.operation.targetResourceId,
          previousStatus: blockedRecord.operation.userVisibleSyncStatus,
          nextStatus: blockedRecord.operation.userVisibleSyncStatus,
          classification: blockedRecord.operation.userVisibleSyncStatus === OfflineQueuedMutationStatuses.syncConflict
            ? OfflinePendingOperationCleanupClassifications.conflicted
            : OfflinePendingOperationCleanupClassifications.abandoned,
          cleanupAction: OfflinePendingOperationCleanupActions.retainedForReview,
          reason: blockedOperation.message,
          resolvedAt: attemptedAt,
        }));
        continue;
      }

      if (
        blockedOperation.reasonCode === "retry-exhausted"
        || blockedOperation.reasonCode === "non-retryable"
      ) {
        await this.pendingOperationService.markOperationReplayOutcome({
          workspaceId,
          operationId: blockedOperation.operationId,
          nextStatus: OfflineQueuedMutationStatuses.syncRejected,
          attemptedAt,
          incrementRetryCount: false,
          retryable: false,
          nonRetryableReasonCode: blockedOperation.reasonCode,
        });
        pendingOperationCleanupRecords.push(Object.freeze({
          operationId: blockedOperation.operationId,
          resourceClass: blockedRecord.operation.targetResourceClass,
          resourceId: blockedRecord.operation.targetResourceId,
          previousStatus: blockedRecord.operation.userVisibleSyncStatus,
          nextStatus: OfflineQueuedMutationStatuses.syncRejected,
          classification: OfflinePendingOperationCleanupClassifications.abandoned,
          cleanupAction: OfflinePendingOperationCleanupActions.retainedForReview,
          reason: blockedOperation.message,
          resolvedAt: attemptedAt,
        }));
      }

      const blockedDecision = deriveDecisionFromBlockedReplayPreparation({
        blockedOperation,
        resourceClass: blockedRecord.operation.targetResourceClass,
      });

      outcomes.push(toOfflineReconciliationOutcomeDto(blockedDecision, {
        resolvedAt: attemptedAt,
        conflictCode: blockedDecision.conflictClass,
        conflictSummary: blockedOperation.message,
        localMutationRevision: blockedRecord.operation.localMutationRevision,
      }, {
        resourceClass: blockedRecord.operation.targetResourceClass,
        resourceId: blockedRecord.operation.targetResourceId,
      }));
      this.publishReplayOutcomeEvent({
        workspaceId,
        actorUserIdentityId,
        attemptedAt,
        operationId: blockedOperation.operationId,
        resourceClass: blockedRecord.operation.targetResourceClass,
        resourceId: blockedRecord.operation.targetResourceId,
        eventType: blockedDecision.action === OfflineResynchronizationActions.conflictRequiresReview
          ? OfflineOperationalEventTypes.conflictDetected
          : OfflineOperationalEventTypes.replayFailed,
        outcome: blockedDecision.action === OfflineResynchronizationActions.conflictRequiresReview
          ? "conflict"
          : "failed",
        summary: blockedOperation.message,
        details: Object.freeze({
          decisionRule: blockedDecision.decisionRule,
          conflictClass: blockedDecision.conflictClass,
          blockedReasonCode: blockedOperation.reasonCode,
          blockingDependencyOperationIds: blockedOperation.blockingDependencyOperationIds,
        }),
      });
    }

    for (const preparedOperation of replayPreparation.prepared) {
      const operationId = preparedOperation.operationId;
      const decision = decisionByOperationId.get(operationId);
      if (!decision) {
        throw new OfflineControlledResynchronizationCoordinatorError(
          `Missing resynchronization decision for prepared operation '${operationId}'.`,
        );
      }

      const revisionSnapshot = revisionByResource.get(
        makeResourceKey(preparedOperation.targetResourceClass, preparedOperation.targetResourceId),
      );
      if (decision.action !== OfflineResynchronizationActions.applyToAuthoritative) {
        const nextStatus = decision.action === OfflineResynchronizationActions.conflictRequiresReview
          ? OfflineQueuedMutationStatuses.syncConflict
          : OfflineQueuedMutationStatuses.syncRejected;
        await this.pendingOperationService.markOperationReplayOutcome({
          workspaceId,
          operationId,
          nextStatus,
          attemptedAt,
          incrementRetryCount: false,
        });
        pendingOperationCleanupRecords.push(Object.freeze({
          operationId,
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
          previousStatus: preparedOperation.operationEnvelope.userVisibleSyncStatus,
          nextStatus,
          classification: decision.action === OfflineResynchronizationActions.conflictRequiresReview
            ? OfflinePendingOperationCleanupClassifications.conflicted
            : OfflinePendingOperationCleanupClassifications.abandoned,
          cleanupAction: OfflinePendingOperationCleanupActions.retainedForReview,
          reason: decision.reason,
          resolvedAt: attemptedAt,
        }));
        schedulePostOutcomeSnapshotMaintenance(decision, {
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
          queueRefreshTarget,
          queueInvalidationTarget,
        });
        outcomes.push(toOfflineReconciliationOutcomeDto(decision, {
          resolvedAt: attemptedAt,
          conflictCode: decision.conflictClass,
          conflictSummary: decision.reason,
          authoritativeRevision: revisionSnapshot?.authoritativeRevision,
          localMutationRevision: preparedOperation.operationEnvelope.localMutationRevision,
        }, {
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
        }));
        this.publishReplayOutcomeEvent({
          workspaceId,
          actorUserIdentityId,
          attemptedAt,
          operationId,
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
          eventType: decision.action === OfflineResynchronizationActions.conflictRequiresReview
            ? OfflineOperationalEventTypes.conflictDetected
            : OfflineOperationalEventTypes.replayFailed,
          outcome: decision.action === OfflineResynchronizationActions.conflictRequiresReview
            ? "conflict"
            : "failed",
          summary: decision.reason,
          details: Object.freeze({
            decisionRule: decision.decisionRule,
            conflictClass: decision.conflictClass,
          }),
        });
        continue;
      }

      replayedOperationIds.push(operationId);
      const replayResult = await this.authoritativePort.replayPreparedOperation({
        workspaceId,
        operation: preparedOperation,
        attemptedAt,
      });

      if (replayResult.kind === AuthoritativeReplayExecutionResultKinds.applied) {
        await this.pendingOperationService.markOperationAsApplied(workspaceId, operationId);
        appliedOperationIds.push(operationId);
        pendingOperationCleanupRecords.push(Object.freeze({
          operationId,
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
          previousStatus: preparedOperation.operationEnvelope.userVisibleSyncStatus,
          nextStatus: OfflineQueuedMutationStatuses.syncApplied,
          classification: OfflinePendingOperationCleanupClassifications.successful,
          cleanupAction: OfflinePendingOperationCleanupActions.removedFromQueue,
          reason: normalizeOptional(replayResult.reason) ?? decision.reason,
          resolvedAt: attemptedAt,
        }));
        const appliedDecision = Object.freeze({
          ...decision,
          reason: normalizeOptional(replayResult.reason) ?? decision.reason,
        });
        outcomes.push(toOfflineReconciliationOutcomeDto(appliedDecision, {
          resolvedAt: attemptedAt,
          authoritativeRevisionAfter: replayResult.authoritativeRevisionAfter,
        }, {
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
        }));
        this.publishReplayOutcomeEvent({
          workspaceId,
          actorUserIdentityId,
          attemptedAt,
          operationId,
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
          eventType: OfflineOperationalEventTypes.replaySucceeded,
          outcome: "succeeded",
          summary: normalizeOptional(replayResult.reason) ?? decision.reason,
          details: Object.freeze({
            decisionRule: decision.decisionRule,
            authoritativeRevisionAfter: replayResult.authoritativeRevisionAfter,
          }),
        });
        if (preparedOperation.pendingRunSubmission) {
          this.publishReplayOutcomeEvent({
            workspaceId,
            actorUserIdentityId,
            attemptedAt,
            operationId,
            resourceClass: preparedOperation.targetResourceClass,
            resourceId: preparedOperation.targetResourceId,
            eventType: OfflineOperationalEventTypes.protectedLocalExecutionRegistered,
            outcome: "succeeded",
            summary: "Protected local execution metadata registered through authoritative replay.",
            details: Object.freeze({
              registrationKind: "pending-run-submission",
              submissionId: preparedOperation.pendingRunSubmission.submissionId,
              workflowDefinitionId: preparedOperation.pendingRunSubmission.workflowDefinitionId,
            }),
            channel: OfflineOperationalEventChannels.audit,
          });
        }
        queueRefreshTarget({
          resourceClass: preparedOperation.targetResourceClass,
          resourceId: preparedOperation.targetResourceId,
        });
        continue;
      }

      const replayDecision = deriveDecisionFromAuthoritativeReplayResult({
        operationId,
        replayResult,
      });
      await this.pendingOperationService.markOperationReplayOutcome({
        workspaceId,
        operationId,
        nextStatus: replayDecision.action === OfflineResynchronizationActions.rejectNotAllowed
          ? OfflineQueuedMutationStatuses.syncRejected
          : OfflineQueuedMutationStatuses.syncConflict,
        attemptedAt,
        incrementRetryCount: true,
        retryable: replayResult.retryable,
        nextEligibleReplayAt: replayResult.nextEligibleReplayAt,
      });
      pendingOperationCleanupRecords.push(Object.freeze({
        operationId,
        resourceClass: preparedOperation.targetResourceClass,
        resourceId: preparedOperation.targetResourceId,
        previousStatus: preparedOperation.operationEnvelope.userVisibleSyncStatus,
        nextStatus: replayDecision.action === OfflineResynchronizationActions.rejectNotAllowed
          ? OfflineQueuedMutationStatuses.syncRejected
          : OfflineQueuedMutationStatuses.syncConflict,
        classification: replayResult.kind === AuthoritativeReplayExecutionResultKinds.failed
          ? OfflinePendingOperationCleanupClassifications.failed
          : replayDecision.action === OfflineResynchronizationActions.conflictRequiresReview
            ? OfflinePendingOperationCleanupClassifications.conflicted
            : OfflinePendingOperationCleanupClassifications.abandoned,
        cleanupAction: OfflinePendingOperationCleanupActions.retainedForReview,
        reason: replayDecision.reason,
        resolvedAt: attemptedAt,
      }));
      schedulePostOutcomeSnapshotMaintenance(replayDecision, {
        resourceClass: preparedOperation.targetResourceClass,
        resourceId: preparedOperation.targetResourceId,
        queueRefreshTarget,
        queueInvalidationTarget,
      });
      outcomes.push(toOfflineReconciliationOutcomeDto(replayDecision, {
        resolvedAt: attemptedAt,
        conflictCode: replayDecision.conflictClass,
        conflictSummary: replayDecision.reason,
        authoritativeRevision: revisionSnapshot?.authoritativeRevision,
        localMutationRevision: preparedOperation.operationEnvelope.localMutationRevision,
      }, {
        resourceClass: preparedOperation.targetResourceClass,
        resourceId: preparedOperation.targetResourceId,
      }));
      this.publishReplayOutcomeEvent({
        workspaceId,
        actorUserIdentityId,
        attemptedAt,
        operationId,
        resourceClass: preparedOperation.targetResourceClass,
        resourceId: preparedOperation.targetResourceId,
        eventType: replayDecision.action === OfflineResynchronizationActions.conflictRequiresReview
          ? OfflineOperationalEventTypes.conflictDetected
          : OfflineOperationalEventTypes.replayFailed,
        outcome: replayDecision.action === OfflineResynchronizationActions.conflictRequiresReview
          ? "conflict"
          : "failed",
        summary: replayDecision.reason,
        details: Object.freeze({
          decisionRule: replayDecision.decisionRule,
          conflictClass: replayDecision.conflictClass,
          replayResultKind: replayResult.kind,
          retryable: replayResult.retryable,
          nextEligibleReplayAt: replayResult.nextEligibleReplayAt,
        }),
      });
    }

    for (const key of [...invalidateTargets.keys()].sort((left, right) => left.localeCompare(right))) {
      const target = invalidateTargets.get(key);
      if (!target) {
        continue;
      }

      const invalidated = await this.snapshotCacheService.deleteSnapshot({
        workspaceId,
        resourceClass: target.resourceClass,
        resourceId: target.resourceId,
      });
      if (invalidated) {
        invalidatedSnapshotKeys.add(key);
      }
    }

    for (const key of [...refreshTargets.keys()].sort((left, right) => left.localeCompare(right))) {
      if (invalidateTargets.has(key)) {
        continue;
      }

      const target = refreshTargets.get(key);
      if (!target) {
        continue;
      }

      const refreshed = await this.refreshSnapshot({
        workspaceId,
        actorUserIdentityId,
        resourceClass: target.resourceClass,
        resourceId: target.resourceId,
      });
      if (refreshed) {
        refreshedSnapshotKeys.add(key);
        continue;
      }

      const invalidated = await this.snapshotCacheService.deleteSnapshot({
        workspaceId,
        resourceClass: target.resourceClass,
        resourceId: target.resourceId,
      });
      if (invalidated) {
        invalidatedSnapshotKeys.add(key);
      }
    }

    return Object.freeze({
      workspaceId,
      attemptedAt,
      connectivity,
      replayPreparedOperationIds,
      blockedOperationIds,
      blockedOperations,
      replayedOperationIds: Object.freeze(replayedOperationIds),
      appliedOperationIds: Object.freeze(appliedOperationIds),
      refreshedSnapshotKeys: Object.freeze([...refreshedSnapshotKeys.values()].sort((left, right) => left.localeCompare(right))),
      invalidatedSnapshotKeys: Object.freeze([...invalidatedSnapshotKeys.values()].sort((left, right) => left.localeCompare(right))),
      pendingOperationCleanupRecords: Object.freeze(
        [...pendingOperationCleanupRecords].sort((left, right) => left.operationId.localeCompare(right.operationId)),
      ),
      outcomes: Object.freeze(outcomes),
    });
  }

  private async refreshSnapshot(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly resourceClass: OfflineResourceClass;
    readonly resourceId: string;
  }): Promise<boolean> {
    const snapshot = await this.authoritativePort.fetchResourceSnapshotForCache({
      workspaceId: input.workspaceId,
      resourceClass: input.resourceClass,
      resourceId: input.resourceId,
    });
    if (!snapshot) {
      return false;
    }

    await this.snapshotCacheService.cacheSnapshot({
      ...snapshot,
      workspaceId: input.workspaceId,
      cachedByActorUserIdentityId: input.actorUserIdentityId,
      lastSynchronizedAt: this.now().toISOString(),
    });
    return true;
  }

  private publishReplayOutcomeEvent(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly attemptedAt: string;
    readonly operationId: string;
    readonly resourceClass: OfflineResourceClass;
    readonly resourceId: string;
    readonly eventType: typeof OfflineOperationalEventTypes[keyof typeof OfflineOperationalEventTypes];
    readonly outcome: "succeeded" | "failed" | "conflict";
    readonly summary: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly channel?: typeof OfflineOperationalEventChannels[keyof typeof OfflineOperationalEventChannels];
  }): void {
    void publishOfflineOperationalEventBestEffort(this.eventSink, Object.freeze({
      channel: input.channel ?? OfflineOperationalEventChannels.operational,
      type: input.eventType,
      occurredAt: input.attemptedAt,
      workspaceId: input.workspaceId,
      actorUserIdentityId: input.actorUserIdentityId,
      operationId: input.operationId,
      resourceClass: input.resourceClass,
      resourceId: input.resourceId,
      outcome: input.outcome,
      summary: input.summary,
      details: input.details,
    }));
  }
}

function dedupeResourceTargets(
  targets: ReadonlyArray<{ readonly resourceClass: OfflineResourceClass; readonly resourceId: string }>,
): ReadonlyArray<{ readonly resourceClass: OfflineResourceClass; readonly resourceId: string }> {
  const map = new Map<string, { readonly resourceClass: OfflineResourceClass; readonly resourceId: string }>();
  for (const target of targets) {
    const resourceId = normalizeRequired(target.resourceId, "resourceId");
    map.set(makeResourceKey(target.resourceClass, resourceId), Object.freeze({
      resourceClass: target.resourceClass,
      resourceId,
    }));
  }

  return Object.freeze([...map.values()]);
}

function shouldInvalidateCachedSnapshotFromRevision(revision: AuthoritativeResourceRevisionSnapshot): boolean {
  return revision.resourceExists === false || revision.accessRevoked === true || revision.permissionAllowsReplay === false;
}

function schedulePostOutcomeSnapshotMaintenance(
  decision: {
    readonly action: typeof OfflineResynchronizationActions[keyof typeof OfflineResynchronizationActions];
    readonly conflictClass?: OfflineResynchronizationConflictClass;
  },
  input: {
    readonly resourceClass: OfflineResourceClass;
    readonly resourceId: string;
    readonly queueRefreshTarget: (target: { readonly resourceClass: OfflineResourceClass; readonly resourceId: string }) => void;
    readonly queueInvalidationTarget: (
      target: { readonly resourceClass: OfflineResourceClass; readonly resourceId: string },
    ) => void;
  },
): void {
  if (!isServerAuthoritativeResourceClass(input.resourceClass)) {
    return;
  }

  if (decision.action === OfflineResynchronizationActions.applyToAuthoritative) {
    input.queueRefreshTarget({
      resourceClass: input.resourceClass,
      resourceId: input.resourceId,
    });
    return;
  }

  if (
    decision.conflictClass === OfflineResynchronizationConflictClasses.deletedOrRevokedResource
    || decision.conflictClass === OfflineResynchronizationConflictClasses.permissionChangedDuringDisconnection
    || decision.conflictClass === OfflineResynchronizationConflictClasses.invalidatedRunSubmission
  ) {
    input.queueInvalidationTarget({
      resourceClass: input.resourceClass,
      resourceId: input.resourceId,
    });
    return;
  }

  input.queueRefreshTarget({
    resourceClass: input.resourceClass,
    resourceId: input.resourceId,
  });
}

function isServerAuthoritativeResourceClass(resourceClass: OfflineResourceClass): boolean {
  return resolveOfflineResourceAuthorityBoundary(resourceClass).authoritativeStateScope
    === OfflineAuthorityScopes.authoritativeServer;
}

function deriveDecisionFromAuthoritativeReplayResult(input: {
  readonly operationId: string;
  readonly replayResult: AuthoritativeReplayExecutionResult;
}) {
  if (input.replayResult.kind === AuthoritativeReplayExecutionResultKinds.rejected) {
    return Object.freeze({
      mutationId: input.operationId,
      action: OfflineResynchronizationActions.rejectNotAllowed,
      conflictClass: input.replayResult.conflictClass ?? OfflineResynchronizationConflictClasses.permissionChangedDuringDisconnection,
      decisionRule: input.replayResult.decisionRule
        ?? OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
      preserveLocalDraftAsUnsynced: input.replayResult.preserveLocalDraftAsUnsynced ?? true,
      requiresUserAttention: input.replayResult.requiresUserAttention ?? true,
      requiresAdminAttention: input.replayResult.requiresAdminAttention ?? false,
      reason: normalizeOptional(input.replayResult.reason)
        ?? "Authoritative replay was rejected after reconnect validation.",
    });
  }

  if (input.replayResult.kind === AuthoritativeReplayExecutionResultKinds.conflict) {
    return Object.freeze({
      mutationId: input.operationId,
      action: OfflineResynchronizationActions.conflictRequiresReview,
      conflictClass: input.replayResult.conflictClass ?? OfflineResynchronizationConflictClasses.resourceVersionMismatch,
      decisionRule: input.replayResult.decisionRule
        ?? OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
      preserveLocalDraftAsUnsynced: input.replayResult.preserveLocalDraftAsUnsynced ?? true,
      requiresUserAttention: input.replayResult.requiresUserAttention ?? true,
      requiresAdminAttention: input.replayResult.requiresAdminAttention ?? false,
      reason: normalizeOptional(input.replayResult.reason)
        ?? "Authoritative replay reported a conflict that requires explicit review.",
    });
  }

  return Object.freeze({
    mutationId: input.operationId,
    action: OfflineResynchronizationActions.conflictRequiresReview,
    conflictClass: input.replayResult.conflictClass ?? OfflineResynchronizationConflictClasses.authoritativeStateUnavailable,
    decisionRule: input.replayResult.decisionRule
      ?? OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
    preserveLocalDraftAsUnsynced: input.replayResult.preserveLocalDraftAsUnsynced ?? true,
    requiresUserAttention: input.replayResult.requiresUserAttention ?? true,
    requiresAdminAttention: input.replayResult.requiresAdminAttention ?? false,
    reason: normalizeOptional(input.replayResult.reason)
      ?? "Authoritative replay failed before an apply/reject decision was confirmed.",
  });
}

function deriveDecisionFromBlockedReplayPreparation(input: {
  readonly blockedOperation: OfflineReplayPreparationBlockedOperation;
  readonly resourceClass: OfflineResourceClass;
}) {
  const preserveLocalDraftAsUnsynced = shouldPreserveLocalDraft(input.resourceClass);

  if (
    input.blockedOperation.reasonCode === "retry-exhausted"
    || input.blockedOperation.reasonCode === "non-retryable"
  ) {
    return Object.freeze({
      mutationId: input.blockedOperation.operationId,
      action: OfflineResynchronizationActions.rejectNotAllowed,
      conflictClass: OfflineResynchronizationConflictClasses.authoritativeStateUnavailable,
      decisionRule: OfflineResynchronizationDecisionRules.rejectReplayAndRequireUserReview,
      preserveLocalDraftAsUnsynced,
      requiresUserAttention: true,
      requiresAdminAttention: false,
      reason: input.blockedOperation.message,
    });
  }

  return Object.freeze({
    mutationId: input.blockedOperation.operationId,
    action: OfflineResynchronizationActions.conflictRequiresReview,
    conflictClass: OfflineResynchronizationConflictClasses.authoritativeStateUnavailable,
    decisionRule: OfflineResynchronizationDecisionRules.unsafeAutoMergeDeferred,
    preserveLocalDraftAsUnsynced,
    requiresUserAttention: true,
    requiresAdminAttention: false,
    reason: input.blockedOperation.message,
  });
}

function shouldPreserveLocalDraft(resourceClass: OfflineResourceClass): boolean {
  return resolveOfflineResourceAuthorityBoundary(resourceClass).authoritativeStateScope
    === OfflineAuthorityScopes.localDraft;
}

function makeResourceKey(resourceClass: OfflineResourceClass, resourceId: string): string {
  return `${resourceClass}::${resourceId}`;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineControlledResynchronizationCoordinatorError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflineControlledResynchronizationCoordinatorError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}
