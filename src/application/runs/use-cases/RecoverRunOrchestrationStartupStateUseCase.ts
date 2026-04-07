import { randomUUID } from "node:crypto";
import {
  PlatformAuditEventKinds,
  PlatformRunStatuses,
  type PlatformAuditEventRecord,
  type PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunNodePlacementHoldRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  transitionCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  mapPlatformRunRecordToCanonicalRun,
  updatePlatformRunRecordCanonicalState,
} from "./RunCreationPersistenceMapper";
import { FinalizeRunExecutionOutcomeUseCase } from "./FinalizeRunExecutionOutcomeUseCase";

export const RunOrchestrationRecoveryActionKinds = Object.freeze({
  expiredPlacementHoldReleased: "expired-placement-hold-released",
  expiredClaimReleased: "expired-claim-released",
  deferredReservationReleased: "deferred-reservation-released",
  staleAssignmentRequeued: "stale-assignment-requeued",
  orphanedAssignmentFailed: "orphaned-assignment-failed",
  assignmentMismatchFailed: "assignment-mismatch-failed",
  dispatchAcceptedReconciled: "dispatch-accepted-reconciled",
  dispatchFailedToStartReconciled: "dispatch-failed-to-start-reconciled",
  staleDispatchingFailed: "stale-dispatching-failed",
  staleRunningFailed: "stale-running-failed",
  manualFollowUpRequired: "manual-follow-up-required",
});

export type RunOrchestrationRecoveryActionKind =
  typeof RunOrchestrationRecoveryActionKinds[keyof typeof RunOrchestrationRecoveryActionKinds];

export const RunOrchestrationRecoveryActionStatuses = Object.freeze({
  applied: "applied",
  manualFollowUp: "manual-follow-up",
});

export type RunOrchestrationRecoveryActionStatus =
  typeof RunOrchestrationRecoveryActionStatuses[keyof typeof RunOrchestrationRecoveryActionStatuses];

export interface RunOrchestrationRecoveryAction {
  readonly runId: string;
  readonly kind: RunOrchestrationRecoveryActionKind;
  readonly status: RunOrchestrationRecoveryActionStatus;
  readonly occurredAt: string;
  readonly message: string;
}

export interface RecoverRunOrchestrationStartupStateRequest {
  readonly asOf?: string;
  readonly staleAssignedSeconds?: number;
  readonly staleDispatchingSeconds?: number;
  readonly staleRunningHeartbeatSeconds?: number;
}

export interface RecoverRunOrchestrationStartupStateResult {
  readonly asOf: string;
  readonly actions: ReadonlyArray<RunOrchestrationRecoveryAction>;
  readonly summary: {
    readonly appliedCount: number;
    readonly manualFollowUpCount: number;
  };
}

interface RecoverRunOrchestrationStartupStateUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly placementHoldRepository?: Pick<IRunNodePlacementHoldRepository, "releaseExpiredNodePlacementHolds">;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

const DefaultStaleAssignedSeconds = 300;
const DefaultStaleDispatchingSeconds = 180;
const DefaultStaleRunningHeartbeatSeconds = 300;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeThreshold(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return fallback;
  }
  return Math.floor(value as number);
}

function parseIso(value: string): number {
  return Date.parse(value);
}

function ageSeconds(asOf: string, reference: string): number {
  return Math.max(0, Math.floor((parseIso(asOf) - parseIso(reference)) / 1000));
}

function maxIso(left: string, right: string): string {
  return parseIso(left) >= parseIso(right) ? left : right;
}

export class RecoverRunOrchestrationStartupStateUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };
  private readonly finalizationUseCase: FinalizeRunExecutionOutcomeUseCase;

  public constructor(private readonly dependencies: RecoverRunOrchestrationStartupStateUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
    this.finalizationUseCase = new FinalizeRunExecutionOutcomeUseCase({
      queueRepository: dependencies.queueRepository,
    });
  }

  public async execute(
    request: RecoverRunOrchestrationStartupStateRequest = {},
  ): Promise<RecoverRunOrchestrationStartupStateResult> {
    const asOf = normalizeOptional(request.asOf) ?? this.now().toISOString();
    const staleAssignedSeconds = normalizeThreshold(request.staleAssignedSeconds, DefaultStaleAssignedSeconds);
    const staleDispatchingSeconds = normalizeThreshold(request.staleDispatchingSeconds, DefaultStaleDispatchingSeconds);
    const staleRunningHeartbeatSeconds = normalizeThreshold(
      request.staleRunningHeartbeatSeconds,
      DefaultStaleRunningHeartbeatSeconds,
    );

    const actions: RunOrchestrationRecoveryAction[] = [];
    const queueEntries = this.dependencies.queueRepository.listQueueEntries
      ? await this.dependencies.queueRepository.listQueueEntries({
        includeDequeued: true,
      })
      : Object.freeze([]);
    const queueByRunId = new Map(queueEntries.map((entry) => [entry.runId, entry] as const));

    await this.reconcileExpiredPlacementHolds({
      asOf,
      actions,
    });

    await this.reconcileDeferredQueueIntermediaryState({
      asOf,
      queueEntries,
      actions,
    });

    await this.reconcileExpiredUnassignedClaims({
      asOf,
      queueEntries,
      actions,
    });

    const candidateRuns = await this.dependencies.runRepository.listRuns({
      statuses: [PlatformRunStatuses.pending, PlatformRunStatuses.running],
    });
    for (const runRecord of candidateRuns) {
      const run = mapPlatformRunRecordToCanonicalRun(runRecord);
      const queueEntry = queueByRunId.get(run.identity.runId);

      if (run.state === RunLifecycleStates.assigned) {
        await this.reconcileAssignedRun({
          asOf,
          staleAssignedSeconds,
          runRecord,
          queueEntry,
          actions,
        });
        continue;
      }

      if (run.state === RunLifecycleStates.dispatching) {
        await this.reconcileDispatchingRun({
          asOf,
          staleDispatchingSeconds,
          runRecord,
          queueEntry,
          actions,
        });
        continue;
      }

      if (run.state === RunLifecycleStates.running) {
        await this.reconcileRunningRun({
          asOf,
          staleRunningHeartbeatSeconds,
          runRecord,
          actions,
        });
      }
    }

    const appliedCount = actions.filter((entry) => entry.status === RunOrchestrationRecoveryActionStatuses.applied).length;
    const manualFollowUpCount = actions.filter(
      (entry) => entry.status === RunOrchestrationRecoveryActionStatuses.manualFollowUp,
    ).length;

    return Object.freeze({
      asOf,
      actions: Object.freeze(actions),
      summary: Object.freeze({
        appliedCount,
        manualFollowUpCount,
      }),
    });
  }

  private async reconcileExpiredUnassignedClaims(input: {
    readonly asOf: string;
    readonly queueEntries: ReadonlyArray<{
      readonly runId: string;
      readonly claimToken?: string;
      readonly claimExpiresAt?: string;
      readonly dequeuedAt?: string;
      readonly assignmentNodeId?: string;
    }>;
    readonly actions: RunOrchestrationRecoveryAction[];
  }): Promise<void> {
    for (const queueEntry of input.queueEntries) {
      if (!queueEntry.claimToken || !queueEntry.claimExpiresAt) {
        continue;
      }
      if (queueEntry.dequeuedAt || queueEntry.assignmentNodeId) {
        continue;
      }
      if (parseIso(queueEntry.claimExpiresAt) > parseIso(input.asOf)) {
        continue;
      }

      const released = await this.dependencies.queueRepository.releaseRunClaim({
        runId: queueEntry.runId,
        claimToken: queueEntry.claimToken,
        releasedAt: input.asOf,
      });
      if (!released) {
        await this.recordManualFollowUp({
          runId: queueEntry.runId,
          occurredAt: input.asOf,
          actions: input.actions,
          message: "Expired queue claim could not be released during startup recovery.",
        });
        continue;
      }

      await this.recordAppliedRecovery({
        runId: queueEntry.runId,
        kind: RunOrchestrationRecoveryActionKinds.expiredClaimReleased,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Released expired queue claim so assignment-ready selection can safely re-claim the run.",
      });
    }
  }

  private async reconcileExpiredPlacementHolds(input: {
    readonly asOf: string;
    readonly actions: RunOrchestrationRecoveryAction[];
  }): Promise<void> {
    if (!this.dependencies.placementHoldRepository?.releaseExpiredNodePlacementHolds) {
      return;
    }

    const released = await this.dependencies.placementHoldRepository.releaseExpiredNodePlacementHolds({
      asOf: input.asOf,
      limit: 500,
    });
    for (const hold of released) {
      await this.recordAppliedRecovery({
        runId: hold.runId,
        kind: RunOrchestrationRecoveryActionKinds.expiredPlacementHoldReleased,
        occurredAt: input.asOf,
        actions: input.actions,
        message: `Released expired node placement hold '${hold.holdToken}' for node '${hold.nodeId}'.`,
      });
    }
  }

  private async reconcileDeferredQueueIntermediaryState(input: {
    readonly asOf: string;
    readonly queueEntries: ReadonlyArray<{
      readonly runId: string;
      readonly eligibilityMarker: string;
      readonly claimToken?: string;
      readonly assignmentNodeId?: string;
      readonly assignmentClaimedAt?: string;
      readonly dispatchPreparedAt?: string;
      readonly dequeuedAt?: string;
    }>;
    readonly actions: RunOrchestrationRecoveryAction[];
  }): Promise<void> {
    for (const queueEntry of input.queueEntries) {
      if (queueEntry.eligibilityMarker !== "deferred") {
        continue;
      }

      const hasIntermediaryAssignmentSignals = Boolean(
        queueEntry.dequeuedAt || queueEntry.assignmentNodeId || queueEntry.assignmentClaimedAt || queueEntry.dispatchPreparedAt,
      );
      if (hasIntermediaryAssignmentSignals) {
        await this.recordManualFollowUp({
          runId: queueEntry.runId,
          occurredAt: input.asOf,
          actions: input.actions,
          message: "Deferred queue entry retained assignment/dequeue intermediary markers and requires manual reconciliation.",
        });
        continue;
      }

      if (!queueEntry.claimToken) {
        continue;
      }

      const released = await this.dependencies.queueRepository.releaseRunClaim({
        runId: queueEntry.runId,
        claimToken: queueEntry.claimToken,
        releasedAt: input.asOf,
      });
      if (!released) {
        await this.recordManualFollowUp({
          runId: queueEntry.runId,
          occurredAt: input.asOf,
          actions: input.actions,
          message: "Deferred queue entry retained reservation claim that could not be released during startup recovery.",
        });
        continue;
      }

      await this.recordAppliedRecovery({
        runId: queueEntry.runId,
        kind: RunOrchestrationRecoveryActionKinds.deferredReservationReleased,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Released stale reservation claim from deferred queue entry to clear interrupted no-placement defer state.",
      });
    }
  }

  private async reconcileAssignedRun(input: {
    readonly asOf: string;
    readonly staleAssignedSeconds: number;
    readonly runRecord: PlatformRunRecord;
    readonly queueEntry?: {
      readonly assignmentNodeId?: string;
      readonly assignmentClaimedAt?: string;
      readonly dispatchPreparedAt?: string;
    };
    readonly actions: RunOrchestrationRecoveryAction[];
  }): Promise<void> {
    const run = mapPlatformRunRecordToCanonicalRun(input.runRecord);
    const runId = run.identity.runId;

    if (!input.queueEntry) {
      await this.recordManualFollowUp({
        runId,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Assigned run has no queue entry and requires operator reconciliation.",
      });
      return;
    }

    const assignedNodeId = normalizeOptional(run.assignment.assignedNodeId);
    if (assignedNodeId && input.queueEntry.assignmentNodeId && input.queueEntry.assignmentNodeId !== assignedNodeId) {
      await this.recordManualFollowUp({
        runId,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Assignment mismatch detected between canonical run and queue state; manual reconciliation is required.",
      });
      return;
    }

    if (input.queueEntry.dispatchPreparedAt) {
      return;
    }
    const assignedAt = normalizeOptional(input.queueEntry.assignmentClaimedAt) ?? normalizeOptional(run.assignment.assignedAt);
    if (!assignedAt) {
      return;
    }
    if (ageSeconds(input.asOf, assignedAt) < input.staleAssignedSeconds) {
      return;
    }

    if (!this.dependencies.queueRepository.requeueAssignedRunForRecovery) {
      await this.recordManualFollowUp({
        runId,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Run exceeded stale assigned threshold but queue adapter does not support guarded recovery requeue.",
      });
      return;
    }

    const requeued = await this.dependencies.queueRepository.requeueAssignedRunForRecovery({
      runId,
      requeuedAt: input.asOf,
      eligibilityMarker: "ready",
    });
    if (!requeued) {
      await this.recordManualFollowUp({
        runId,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Guarded stale assignment requeue failed due to queue state conflict.",
      });
      return;
    }

    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      const persisted = await this.dependencies.runRepository.findRunById(runId);
      if (!persisted) {
        return;
      }
      const current = mapPlatformRunRecordToCanonicalRun(persisted);
      if (current.state !== RunLifecycleStates.assigned) {
        return;
      }

      const requeuedRun = transitionCanonicalRunRecord(current, {
        toState: RunLifecycleStates.queued,
        occurredAt: input.asOf,
        queue: current.queue
          ? Object.freeze({
            ...current.queue,
            dequeuedAt: undefined,
            position: null,
            positionAsOf: input.asOf,
          })
          : undefined,
        assignment: Object.freeze({
          status: RunAssignmentStatuses.unassigned,
        }),
        execution: Object.freeze({
          outcome: RunExecutionOutcomeKinds.none,
        }),
      });

      const updated = updatePlatformRunRecordCanonicalState(persisted, requeuedRun);
      await this.dependencies.runRepository.saveRun(updated, {
        operationKey: `run:startup-recovery:${runId}:stale-assignment-requeued`,
        actorId: "system:run-orchestration-recovery",
        occurredAt: input.asOf,
        expectedRevision: persisted.revision,
      });
    });

    await this.recordAppliedRecovery({
      runId,
      kind: RunOrchestrationRecoveryActionKinds.staleAssignmentRequeued,
      occurredAt: input.asOf,
      actions: input.actions,
      message: "Requeued stale assigned run that never progressed to dispatch preparation.",
    });
  }

  private async reconcileDispatchingRun(input: {
    readonly asOf: string;
    readonly staleDispatchingSeconds: number;
    readonly runRecord: PlatformRunRecord;
    readonly queueEntry?: {
      readonly dispatchPreparedAt?: string;
    };
    readonly actions: RunOrchestrationRecoveryAction[];
  }): Promise<void> {
    const run = mapPlatformRunRecordToCanonicalRun(input.runRecord);
    const runId = run.identity.runId;
    const dispatchAttempts = await this.dependencies.queueRepository.listDispatchAttemptsByRunId(runId);
    const latestAttempt = dispatchAttempts[0];
    const dispatchResult = latestAttempt?.dispatchResult;

    if (dispatchResult?.status === "accepted") {
      await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
        const persisted = await this.dependencies.runRepository.findRunById(runId);
        if (!persisted) {
          return;
        }
        const current = mapPlatformRunRecordToCanonicalRun(persisted);
        if (current.state !== RunLifecycleStates.dispatching) {
          return;
        }

        const startedAt = dispatchResult.acceptedAt ?? dispatchResult.recordedAt;
        const transitioned = transitionCanonicalRunRecord(current, {
          toState: RunLifecycleStates.running,
          occurredAt: maxIso(input.asOf, startedAt),
          execution: Object.freeze({
            ...current.execution,
            adapterKind: dispatchResult.backendKind ?? current.execution.adapterKind,
            adapterRunId: dispatchResult.backendRunId ?? current.execution.adapterRunId,
            startedAt: current.execution.startedAt ?? startedAt,
            outcome: RunExecutionOutcomeKinds.none,
          }),
        });
        const updated = updatePlatformRunRecordCanonicalState(persisted, transitioned);
        await this.dependencies.runRepository.saveRun(updated, {
          operationKey: `run:startup-recovery:${runId}:dispatch-accepted-reconciled`,
          actorId: "system:run-orchestration-recovery",
          occurredAt: transitioned.updatedAt,
          expectedRevision: persisted.revision,
        });
      });

      await this.recordAppliedRecovery({
        runId,
        kind: RunOrchestrationRecoveryActionKinds.dispatchAcceptedReconciled,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Recovered interrupted dispatch progression by advancing dispatching run to running from persisted accepted dispatch result.",
      });
      return;
    }

    if (dispatchResult?.status === "failed-to-start") {
      await this.failRunForRecovery({
        runRecord: input.runRecord,
        occurredAt: input.asOf,
        reasonCode: dispatchResult.failure?.safeCode ?? "dispatch-failed-to-start",
        reasonMessage: dispatchResult.failure?.safeMessage
          ?? "Run failed to start on the selected execution backend.",
      });
      await this.recordAppliedRecovery({
        runId,
        kind: RunOrchestrationRecoveryActionKinds.dispatchFailedToStartReconciled,
        occurredAt: input.asOf,
        actions: input.actions,
        message: "Recovered interrupted dispatch progression by terminally failing run from persisted failed-to-start dispatch result.",
      });
      return;
    }

    const dispatchingSince = normalizeOptional(input.queueEntry?.dispatchPreparedAt)
      ?? normalizeOptional(run.updatedAt);
    if (!dispatchingSince || ageSeconds(input.asOf, dispatchingSince) < input.staleDispatchingSeconds) {
      return;
    }

    await this.failRunForRecovery({
      runRecord: input.runRecord,
      occurredAt: input.asOf,
      reasonCode: "stale-dispatching-state",
      reasonMessage: "Dispatching run exceeded startup recovery timeout without a persisted dispatch result.",
    });
    await this.recordAppliedRecovery({
      runId,
      kind: RunOrchestrationRecoveryActionKinds.staleDispatchingFailed,
      occurredAt: input.asOf,
      actions: input.actions,
      message: "Failed stale dispatching run that had no persisted dispatch outcome after timeout.",
    });
  }

  private async reconcileRunningRun(input: {
    readonly asOf: string;
    readonly staleRunningHeartbeatSeconds: number;
    readonly runRecord: PlatformRunRecord;
    readonly actions: RunOrchestrationRecoveryAction[];
  }): Promise<void> {
    const run = mapPlatformRunRecordToCanonicalRun(input.runRecord);
    const runId = run.identity.runId;
    const lastSignalAt = normalizeOptional(run.execution.heartbeatAt)
      ?? normalizeOptional(run.execution.progress?.updatedAt)
      ?? normalizeOptional(run.execution.startedAt);
    if (!lastSignalAt) {
      return;
    }
    if (ageSeconds(input.asOf, lastSignalAt) < input.staleRunningHeartbeatSeconds) {
      return;
    }

    await this.failRunForRecovery({
      runRecord: input.runRecord,
      occurredAt: input.asOf,
      reasonCode: "stale-running-heartbeat",
      reasonMessage: "Running run exceeded heartbeat recovery timeout after startup.",
    });
    await this.recordAppliedRecovery({
      runId,
      kind: RunOrchestrationRecoveryActionKinds.staleRunningFailed,
      occurredAt: input.asOf,
      actions: input.actions,
      message: "Failed stale running run after heartbeat timeout during startup recovery.",
    });
  }

  private async failRunForRecovery(input: {
    readonly runRecord: PlatformRunRecord;
    readonly occurredAt: string;
    readonly reasonCode: string;
    readonly reasonMessage: string;
  }): Promise<void> {
    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      const runId = input.runRecord.runId;
      const persisted = await this.dependencies.runRepository.findRunById(runId);
      if (!persisted) {
        return;
      }
      const current = mapPlatformRunRecordToCanonicalRun(persisted);
      if (
        current.state === RunLifecycleStates.completed
        || current.state === RunLifecycleStates.failed
        || current.state === RunLifecycleStates.cancelled
      ) {
        return;
      }

      const startedAt = normalizeOptional(current.execution.startedAt);
      const finishedAt = startedAt ? maxIso(input.occurredAt, startedAt) : input.occurredAt;
      const failed = transitionCanonicalRunRecord(current, {
        toState: RunLifecycleStates.failed,
        occurredAt: input.occurredAt,
        execution: Object.freeze({
          ...current.execution,
          startedAt,
          finishedAt,
          outcome: RunExecutionOutcomeKinds.failed,
          errorCode: input.reasonCode,
          errorMessage: input.reasonMessage,
        }),
      });
      const finalized = await this.finalizationUseCase.execute({
        run: failed,
        runRecord: persisted,
        occurredAt: input.occurredAt,
        internalDiagnostics: Object.freeze({
          recoveryReasonCode: input.reasonCode,
        }),
      });
      const updated = finalized.runRecord;
      await this.dependencies.runRepository.saveRun(updated, {
        operationKey: `run:startup-recovery:${runId}:failed:${input.reasonCode}`,
        actorId: "system:run-orchestration-recovery",
        occurredAt: input.occurredAt,
        expectedRevision: persisted.revision,
      });
    });
  }

  private async recordAppliedRecovery(input: {
    readonly runId: string;
    readonly kind: RunOrchestrationRecoveryActionKind;
    readonly occurredAt: string;
    readonly actions: RunOrchestrationRecoveryAction[];
    readonly message: string;
  }): Promise<void> {
    input.actions.push(Object.freeze({
      runId: input.runId,
      kind: input.kind,
      status: RunOrchestrationRecoveryActionStatuses.applied,
      occurredAt: input.occurredAt,
      message: input.message,
    }));
    await this.appendRecoveryAuditEvent({
      runId: input.runId,
      occurredAt: input.occurredAt,
      actionKind: input.kind,
      status: RunOrchestrationRecoveryActionStatuses.applied,
      message: input.message,
      outcome: "succeeded",
    });
  }

  private async recordManualFollowUp(input: {
    readonly runId: string;
    readonly occurredAt: string;
    readonly actions: RunOrchestrationRecoveryAction[];
    readonly message: string;
  }): Promise<void> {
    input.actions.push(Object.freeze({
      runId: input.runId,
      kind: RunOrchestrationRecoveryActionKinds.manualFollowUpRequired,
      status: RunOrchestrationRecoveryActionStatuses.manualFollowUp,
      occurredAt: input.occurredAt,
      message: input.message,
    }));
    await this.appendRecoveryAuditEvent({
      runId: input.runId,
      occurredAt: input.occurredAt,
      actionKind: RunOrchestrationRecoveryActionKinds.manualFollowUpRequired,
      status: RunOrchestrationRecoveryActionStatuses.manualFollowUp,
      message: input.message,
      outcome: "rejected",
    });
  }

  private async appendRecoveryAuditEvent(input: {
    readonly runId: string;
    readonly occurredAt: string;
    readonly actionKind: RunOrchestrationRecoveryActionKind;
    readonly status: RunOrchestrationRecoveryActionStatus;
    readonly message: string;
    readonly outcome: "succeeded" | "rejected";
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.orchestration-recovery.startup",
      actorId: "system:run-orchestration-recovery",
      targetRef: `run:${input.runId}`,
      outcome: input.outcome,
      occurredAt: input.occurredAt,
      details: Object.freeze({
        recoveryActionKind: input.actionKind,
        recoveryStatus: input.status,
        message: input.message,
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:startup-recovery-audit:${input.runId}:${event.eventId}`,
      actorId: "system:run-orchestration-recovery",
      occurredAt: input.occurredAt,
    });
  }
}
