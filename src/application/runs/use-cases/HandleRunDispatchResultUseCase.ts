import { randomUUID } from "node:crypto";
import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import { PlatformAuditEventKinds, type PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type {
  AuthoritativeRunDispatchAttemptResult,
  IAuthoritativeRunPersistenceRepository,
  IRunCollectedResultPersistencePort,
  IRunFinalizationResultRegistrationPort,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  transitionCanonicalRunRecord,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import type { RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  mapPlatformRunRecordToCanonicalRun,
  toRunDetailFromPlatformRecord,
  updatePlatformRunRecordCanonicalState,
} from "./RunCreationPersistenceMapper";
import { FinalizeRunExecutionOutcomeUseCase } from "./FinalizeRunExecutionOutcomeUseCase";
import {
  transitionDispatchingRunToOutcome,
  transitionRunToDispatching,
  type RunDispatchOutcome,
} from "./RunDispatchResultStateTransitions";
import type { CanonicalRunExecutionCommand, RunExecutionDispatchReceipt } from "@application/runs/ports/RunExecutionDispatchPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";
import {
  ImageManipulationFailureNormalizationSources,
  normalizeImageManipulationExecutionFailure,
} from "@application/image-workflows/ports/ImageManipulationFailureNormalization";
import {
  ImageManipulationRetryModes,
  type ImageManipulationRetryRecoveryContract,
} from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";

export interface HandleRunDispatchResultRequest {
  readonly command: CanonicalRunExecutionCommand;
  readonly dispatchStartedAt?: string;
  readonly outcome: RunDispatchOutcome;
}

export interface HandleRunDispatchResultResult {
  readonly run: RunDetail;
  readonly fromState: string;
  readonly toState: string;
  readonly dispatchAttemptResult: AuthoritativeRunDispatchAttemptResult;
  readonly queueAction: DispatchOutcomeQueueAction;
}

interface HandleRunDispatchResultUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly resultRegistrationPort?: IRunFinalizationResultRegistrationPort;
  readonly resultCollectionPersistencePort?: IRunCollectedResultPersistencePort;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
  readonly authoritativeAuditRecorder?: Pick<AuthoritativeAuditRecordingPort, "recordRunsEvent">;
}

export const DispatchOutcomeQueueActions = Object.freeze({
  runningReservationReleased: "running-reservation-released",
  failedStartRequeued: "failed-start-requeued",
  terminalFinalized: "terminal-finalized",
});

export type DispatchOutcomeQueueAction =
  typeof DispatchOutcomeQueueActions[keyof typeof DispatchOutcomeQueueActions];

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveActorId(command: CanonicalRunExecutionCommand): string {
  return normalizeOptional(command.assignment.reservationOwner) ?? "system:run-orchestrator";
}

function toDispatchAttemptResult(
  outcome: RunDispatchOutcome,
  command: CanonicalRunExecutionCommand,
): AuthoritativeRunDispatchAttemptResult {
  if (outcome.status === "accepted") {
    return Object.freeze({
      status: "accepted",
      recordedAt: outcome.receipt.acceptedAt,
      acceptedAt: outcome.receipt.acceptedAt,
      dispatchId: outcome.receipt.dispatchId,
      backendKind: outcome.receipt.backendKind,
      backendRunId: outcome.receipt.backendRunId,
      metadata: outcome.receipt.metadata,
    });
  }

  return Object.freeze({
    status: "failed-to-start",
    recordedAt: outcome.failedAt,
    backendKind: command.backend.kind,
    failure: Object.freeze({
      safeCode: outcome.failure.safeCode,
      safeMessage: outcome.failure.safeMessage,
      internalCode: outcome.failure.internalCode,
      internalMessage: outcome.failure.internalMessage,
      retryable: outcome.failure.retryable,
      details: outcome.failure.details,
    }),
  });
}

function shouldRequeueAfterFailedStart(input: {
  readonly run: CanonicalRunRecord;
  readonly outcome: RunDispatchOutcome;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
}): boolean {
  if (input.outcome.status !== "failed-to-start") {
    return false;
  }
  if (!isAutomaticDispatchRetryEligible(input.outcome.failure)) {
    return false;
  }
  if (!input.queueRepository.requeueAssignedRunForRecovery) {
    return false;
  }
  return input.run.retry.attempt < input.run.retry.maxAttempts;
}

function isAutomaticDispatchRetryEligible(input: {
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}): boolean {
  const recovery = extractRecoveryContract(input.details);
  if (recovery) {
    return recovery.retry.retryEligible
      && recovery.retry.retrySafe
      && recovery.retry.retryMode === ImageManipulationRetryModes.automatic;
  }
  return input.retryable === true;
}

function extractRecoveryContract(
  details: Readonly<Record<string, unknown>> | undefined,
): ImageManipulationRetryRecoveryContract | undefined {
  if (!details) {
    return undefined;
  }
  const candidate = details.recovery;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return undefined;
  }
  const recovery = candidate as ImageManipulationRetryRecoveryContract;
  if (!recovery.retry || !recovery.recoveryAction || !recovery.escalation) {
    return undefined;
  }
  return recovery;
}

function transitionDispatchingRunToRequeuedState(input: {
  readonly run: CanonicalRunRecord;
  readonly command: CanonicalRunExecutionCommand;
  readonly failedAt: string;
}): CanonicalRunRecord {
  const retryPending = transitionCanonicalRunRecord(input.run, {
    toState: RunLifecycleStates.retryPending,
    occurredAt: input.failedAt,
    assignment: Object.freeze({
      status: "released",
      assignedNodeId: input.command.assignment.nodeId,
      assignedAt: input.command.preparedAt,
      releasedAt: input.failedAt,
      releaseReason: "execution-failed",
    }),
    execution: Object.freeze({
      ...input.run.execution,
      adapterKind: input.command.backend.kind,
      adapterRunId: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      outcome: RunExecutionOutcomeKinds.none,
      errorCode: undefined,
      errorMessage: undefined,
    }),
    retry: Object.freeze({
      ...input.run.retry,
      queuedAt: input.failedAt,
    }),
  });

  return transitionCanonicalRunRecord(retryPending, {
    toState: RunLifecycleStates.queued,
    occurredAt: input.failedAt,
    queue: retryPending.queue
      ? Object.freeze({
        ...retryPending.queue,
        dequeuedAt: undefined,
        position: null,
        positionAsOf: input.failedAt,
      })
      : undefined,
    assignment: Object.freeze({
      status: "unassigned",
    }),
    execution: Object.freeze({
      ...retryPending.execution,
      adapterKind: input.command.backend.kind,
      adapterRunId: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      outcome: RunExecutionOutcomeKinds.none,
      errorCode: undefined,
      errorMessage: undefined,
    }),
    retry: Object.freeze({
      ...retryPending.retry,
      queuedAt: undefined,
    }),
  });
}

export class HandleRunDispatchResultUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };
  private readonly finalizationUseCase: FinalizeRunExecutionOutcomeUseCase;

  public constructor(private readonly dependencies: HandleRunDispatchResultUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
    this.finalizationUseCase = new FinalizeRunExecutionOutcomeUseCase({
      queueRepository: dependencies.queueRepository,
      resultRegistrationPort: dependencies.resultRegistrationPort,
      resultCollectionPersistencePort: dependencies.resultCollectionPersistencePort,
      authoritativeAuditRecorder: dependencies.authoritativeAuditRecorder,
    });
  }

  public async execute(request: HandleRunDispatchResultRequest): Promise<HandleRunDispatchResultResult> {
    const runId = normalizeRequired(request.command.run.runId, "runId");
    const dispatchAttemptId = normalizeRequired(request.command.dispatchAttemptId, "dispatchAttemptId");
    const dispatchStartedAt = normalizeOptional(request.dispatchStartedAt) ?? this.now().toISOString();
    const actorId = resolveActorId(request.command);
    const correlationId = normalizeOptional(request.command.run.correlationId);

    let result: HandleRunDispatchResultResult | undefined;
    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      const persistedRun = await this.dependencies.runRepository.findRunById(runId);
      if (!persistedRun) {
        throw new Error(`Run '${runId}' was not found.`);
      }

      const currentRun = mapPlatformRunRecordToCanonicalRun(persistedRun);
      const dispatchingRun = this.ensureDispatchingRun({
        run: currentRun,
        command: request.command,
        occurredAt: dispatchStartedAt,
      });

      let activePersistedRun = persistedRun;
      if (dispatchingRun.state !== currentRun.state) {
        const dispatchingRecord = updatePlatformRunRecordCanonicalState(activePersistedRun, dispatchingRun);
        const savedDispatching = await this.dependencies.runRepository.saveRun({
          ...dispatchingRecord,
          runId: activePersistedRun.runId,
          revision: activePersistedRun.revision,
        }, {
          operationKey: `run:dispatch-lifecycle:${runId}:${dispatchAttemptId}:to-dispatching`,
          actorId,
          occurredAt: dispatchStartedAt,
          correlationId,
          expectedRevision: activePersistedRun.revision,
        });
        await this.appendLifecycleEvent({
          eventId: this.idGenerator.nextId("audit"),
          runId,
          workspaceId: dispatchingRun.identity.workspaceId,
          userIdentityId: activePersistedRun.userIdentityId,
          actorId,
          occurredAt: dispatchStartedAt,
          correlationId,
          fromState: currentRun.state,
          toState: dispatchingRun.state,
          dispatchAttemptId,
          outcome: request.outcome.status,
        });
        activePersistedRun = savedDispatching.record;
      }

      const dispatchAttemptResult = toDispatchAttemptResult(request.outcome, request.command);
      const attemptResultRecorded = await this.dependencies.queueRepository.recordDispatchAttemptResult({
        runId,
        attemptId: dispatchAttemptId,
        result: dispatchAttemptResult,
      });
      if (!attemptResultRecorded) {
        throw new Error(
          `Run '${runId}' dispatch attempt '${dispatchAttemptId}' was not found while recording dispatch outcome.`,
        );
      }

      await this.appendDispatchInitiatedEvent({
        runId,
        workspaceId: dispatchingRun.identity.workspaceId,
        userIdentityId: activePersistedRun.userIdentityId,
        actorId,
        occurredAt: dispatchStartedAt,
        correlationId,
        dispatchAttemptId,
        backendKind: request.command.backend.kind,
        fromState: currentRun.state,
      });

      const activeRun = mapPlatformRunRecordToCanonicalRun(activePersistedRun);
      const requeueAfterFailedStart = shouldRequeueAfterFailedStart({
        run: activeRun,
        outcome: request.outcome,
        queueRepository: this.dependencies.queueRepository,
      });

      let finalRun: CanonicalRunRecord;
      let finalRecord = activePersistedRun;
      let queueAction: DispatchOutcomeQueueAction;
      if (requeueAfterFailedStart && request.outcome.status === "failed-to-start") {
        finalRun = transitionDispatchingRunToRequeuedState({
          run: activeRun,
          command: request.command,
          failedAt: request.outcome.failedAt,
        });
        const requeued = await this.dependencies.queueRepository.requeueAssignedRunForRecovery?.({
          runId,
          requeuedAt: request.outcome.failedAt,
          eligibilityMarker: "ready",
        });
        if (!requeued) {
          finalRun = transitionDispatchingRunToOutcome({
            run: activeRun,
            command: request.command,
            outcome: request.outcome,
          });
          const finalized = await this.finalizationUseCase.execute({
            run: finalRun,
            runRecord: activePersistedRun,
            occurredAt: finalRun.updatedAt,
            internalDiagnostics: request.outcome.failure.details,
          });
          finalRecord = finalized.runRecord;
          queueAction = DispatchOutcomeQueueActions.terminalFinalized;
        } else {
          finalRecord = updatePlatformRunRecordCanonicalState(activePersistedRun, finalRun);
          queueAction = DispatchOutcomeQueueActions.failedStartRequeued;
        }
      } else {
        finalRun = transitionDispatchingRunToOutcome({
          run: activeRun,
          command: request.command,
          outcome: request.outcome,
        });
        if (request.outcome.status === "accepted") {
          await this.dependencies.queueRepository.finalizeRunQueueEntry({
            runId,
            finalizedAt: finalRun.updatedAt,
            lifecycleState: finalRun.state,
          });
          finalRecord = updatePlatformRunRecordCanonicalState(activePersistedRun, finalRun);
          queueAction = DispatchOutcomeQueueActions.runningReservationReleased;
        } else {
          const finalized = await this.finalizationUseCase.execute({
            run: finalRun,
            runRecord: activePersistedRun,
            occurredAt: finalRun.updatedAt,
            internalDiagnostics: request.outcome.failure.details,
          });
          finalRecord = finalized.runRecord;
          queueAction = DispatchOutcomeQueueActions.terminalFinalized;
        }
      }

      const savedFinal = await this.dependencies.runRepository.saveRun({
        ...finalRecord,
        runId: activePersistedRun.runId,
        revision: activePersistedRun.revision,
      }, {
        operationKey: `run:dispatch-lifecycle:${runId}:${dispatchAttemptId}:to-${finalRun.state}`,
        actorId,
        occurredAt: finalRun.updatedAt,
        correlationId,
        expectedRevision: activePersistedRun.revision,
      });

      await this.appendLifecycleEvent({
        eventId: this.idGenerator.nextId("audit"),
        runId,
        workspaceId: finalRun.identity.workspaceId,
        userIdentityId: savedFinal.record.userIdentityId,
        actorId,
        occurredAt: finalRun.updatedAt,
        correlationId,
        fromState: activeRun.state,
        toState: finalRun.state,
        dispatchAttemptId,
        outcome: request.outcome.status,
        queueAction,
      });

      result = Object.freeze({
        run: toRunDetailFromPlatformRecord(savedFinal.record),
        fromState: currentRun.state,
        toState: finalRun.state,
        dispatchAttemptResult,
        queueAction,
      });
    });

    if (!result) {
      throw new Error(`Dispatch result handling failed for run '${runId}'.`);
    }
    return result;
  }

  private ensureDispatchingRun(input: {
    readonly run: CanonicalRunRecord;
    readonly occurredAt: string;
    readonly command: CanonicalRunExecutionCommand;
  }): CanonicalRunRecord {
    if (input.run.state === RunLifecycleStates.dispatching) {
      return input.run;
    }
    if (input.run.state !== RunLifecycleStates.assigned) {
      throw new Error(
        `Run '${input.run.identity.runId}' must be '${RunLifecycleStates.assigned}' or '${RunLifecycleStates.dispatching}' before dispatch outcome handling.`,
      );
    }
    return transitionRunToDispatching(input);
  }

  private async appendLifecycleEvent(input: {
    readonly eventId: string;
    readonly runId: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
    readonly actorId: string;
    readonly occurredAt: string;
    readonly correlationId?: string;
    readonly fromState: string;
    readonly toState: string;
    readonly dispatchAttemptId: string;
    readonly outcome: RunDispatchOutcome["status"];
    readonly queueAction?: DispatchOutcomeQueueAction;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: input.eventId,
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.lifecycle.transitioned",
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
      targetRef: `run:${input.runId}`,
      outcome: input.toState === RunLifecycleStates.failed ? "failed" : "succeeded",
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
      details: Object.freeze({
        transitionKind: "dispatch-result-handled",
        fromState: input.fromState,
        toState: input.toState,
        dispatchAttemptId: input.dispatchAttemptId,
        dispatchOutcome: input.outcome,
        dispatchQueueAction: input.queueAction,
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:lifecycle-event:${input.runId}:${input.dispatchAttemptId}:${input.fromState}->${input.toState}`,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
    });

    if (!this.dependencies.authoritativeAuditRecorder) {
      return;
    }

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:lifecycle:${input.runId}:${input.dispatchAttemptId}:${input.fromState}->${input.toState}`,
        eventType: "run-lifecycle-transitioned",
        action: "run.lifecycle.transitioned",
        outcome: input.toState === RunLifecycleStates.failed
          ? AuditEventOutcomes.failed
          : AuditEventOutcomes.succeeded,
        occurredAt: input.occurredAt,
        actor: Object.freeze({
          actorId: input.actorId,
          actorKind: input.actorId.startsWith("user:")
            ? AuditActorKinds.user
            : AuditActorKinds.service,
          actorUserIdentityId: input.actorId.startsWith("user:") ? input.actorId : undefined,
          actorServiceId: input.actorId.startsWith("user:") ? undefined : input.actorId,
        }),
        scope: input.workspaceId
          ? Object.freeze({
            kind: AuditScopeKinds.workspace,
            workspaceId: input.workspaceId,
          })
          : Object.freeze({
            kind: AuditScopeKinds.global,
          }),
        protectedResource: Object.freeze({
          resourceType: "run",
          resourceId: input.runId,
          resourceRef: input.runId.startsWith("run:") ? input.runId : `run:${input.runId}`,
          sensitivityClass: "sensitive",
          workspaceId: input.workspaceId,
        }),
        correlationId: input.correlationId,
        payload: Object.freeze({
          userSafeDetails: Object.freeze({
            transitionKind: "dispatch-result-handled",
            fromState: input.fromState,
            toState: input.toState,
            dispatchOutcome: input.outcome,
            dispatchQueueAction: input.queueAction,
          }),
          adminOnlyDetails: Object.freeze({
            dispatchAttemptId: input.dispatchAttemptId,
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail dispatch handling.
    }
  }

  private async appendDispatchInitiatedEvent(input: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
    readonly actorId: string;
    readonly occurredAt: string;
    readonly correlationId?: string;
    readonly dispatchAttemptId: string;
    readonly backendKind: string;
    readonly fromState: string;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.dispatch.initiated",
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
      targetRef: `run:${input.runId}`,
      outcome: "succeeded",
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
      details: Object.freeze({
        fromState: input.fromState,
        toState: RunLifecycleStates.dispatching,
        dispatchAttemptId: input.dispatchAttemptId,
        backendKind: input.backendKind,
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:dispatch-initiated:${input.runId}:${input.dispatchAttemptId}`,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
    });

    if (!this.dependencies.authoritativeAuditRecorder) {
      return;
    }

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:dispatch-initiated:${input.runId}:${input.dispatchAttemptId}`,
        eventType: "run-dispatch-initiated",
        action: "run.dispatch.initiated",
        outcome: AuditEventOutcomes.succeeded,
        occurredAt: input.occurredAt,
        actor: Object.freeze({
          actorId: input.actorId,
          actorKind: input.actorId.startsWith("user:")
            ? AuditActorKinds.user
            : AuditActorKinds.service,
          actorUserIdentityId: input.actorId.startsWith("user:") ? input.actorId : undefined,
          actorServiceId: input.actorId.startsWith("user:") ? undefined : input.actorId,
        }),
        scope: input.workspaceId
          ? Object.freeze({
            kind: AuditScopeKinds.workspace,
            workspaceId: input.workspaceId,
          })
          : Object.freeze({
            kind: AuditScopeKinds.global,
          }),
        protectedResource: Object.freeze({
          resourceType: "run",
          resourceId: input.runId,
          resourceRef: input.runId.startsWith("run:") ? input.runId : `run:${input.runId}`,
          sensitivityClass: "sensitive",
          workspaceId: input.workspaceId,
        }),
        correlationId: input.correlationId,
        payload: Object.freeze({
          userSafeDetails: Object.freeze({
            fromState: input.fromState,
            toState: RunLifecycleStates.dispatching,
            backendKind: input.backendKind,
          }),
          adminOnlyDetails: Object.freeze({
            dispatchAttemptId: input.dispatchAttemptId,
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail dispatch handling.
    }
  }
}

export function createDispatchFailureOutcome(input: {
  readonly failedAt: string;
  readonly error: unknown;
}): RunDispatchOutcome {
  const normalizedFailure = normalizeDispatchFailure(input.error, input.failedAt);
  const error = input.error;
  const internalCode = typeof (error as { code?: unknown } | undefined)?.code === "string"
    ? String((error as { code: string }).code)
    : normalizedFailure.internalCode;

  return Object.freeze({
    status: "failed-to-start",
    failedAt: input.failedAt,
    failure: Object.freeze({
      safeCode: normalizedFailure.safeCode,
      safeMessage: normalizedFailure.safeMessage,
      internalCode,
      internalMessage: normalizedFailure.internalMessage,
      retryable: normalizedFailure.retryable,
      details: normalizedFailure.details,
    }),
  });
}

export function createDispatchAcceptedOutcome(receipt: RunExecutionDispatchReceipt): RunDispatchOutcome {
  return Object.freeze({
    status: "accepted",
    receipt,
  });
}

function normalizeDispatchFailure(
  error: unknown,
  failedAt: string,
): {
  readonly safeCode: string;
  readonly safeMessage: string;
  readonly internalCode?: string;
  readonly internalMessage: string;
  readonly retryable: boolean;
  readonly details: Readonly<Record<string, unknown>>;
} {
  const adapterFailure = (error as { failure?: unknown } | undefined)?.failure;
  if (adapterFailure && typeof adapterFailure === "object" && !Array.isArray(adapterFailure)) {
    const typedFailure = adapterFailure as {
      code?: string;
      summary?: string;
      userMessage?: string;
      category?: string;
      stageCode?: string;
      retryable?: boolean;
      recovery?: ImageManipulationRetryRecoveryContract;
      diagnostics?: Readonly<Record<string, unknown>>;
      classification?: unknown;
    };

    const safeCode = normalizeOptional(typedFailure.code) ?? "dispatch-failed-to-start";
    const safeMessage = normalizeOptional(typedFailure.userMessage)
      ?? normalizeOptional(typedFailure.summary)
      ?? "Run failed to start on the selected execution backend.";
    const internalMessage = normalizeDispatchInternalMessage(error);
    const retryable = resolveRetryableFromRecovery(typedFailure.recovery, typedFailure.retryable);

    return Object.freeze({
      safeCode,
      safeMessage,
      internalCode: normalizeOptional((error as { code?: string } | undefined)?.code),
      internalMessage,
      retryable,
      details: Object.freeze({
        category: normalizeOptional(typedFailure.category),
        stageCode: normalizeOptional(typedFailure.stageCode),
        recovery: typedFailure.recovery,
        classification: typedFailure.classification,
        diagnostics: typedFailure.diagnostics,
      }),
    });
  }

  const normalized = normalizeImageManipulationExecutionFailure({
    source: ImageManipulationFailureNormalizationSources.dispatch,
    failedAt,
    backendErrorCode: normalizeOptional((error as { code?: string } | undefined)?.code),
    rawMessage: normalizeDispatchInternalMessage(error),
    diagnostics: error instanceof Error
      ? Object.freeze({
        name: error.name,
      })
      : undefined,
    stageCode: "dispatch",
    state: "failed",
    partialOutputCount: 0,
    partialProgressObserved: false,
  });
  const explicitRetryable = typeof (error as { retryable?: unknown } | undefined)?.retryable === "boolean"
    ? Boolean((error as { retryable: boolean }).retryable)
    : undefined;

  return Object.freeze({
    safeCode: normalized.code,
    safeMessage: normalized.userMessage ?? normalized.summary,
    internalCode: normalizeOptional((error as { code?: string } | undefined)?.code) ?? normalized.code,
    internalMessage: normalizeDispatchInternalMessage(error),
    retryable: explicitRetryable ?? resolveRetryableFromRecovery(normalized.recovery, normalized.retryable),
    details: Object.freeze({
      category: normalized.category,
      stageCode: normalized.stageCode,
      recovery: normalized.recovery,
      classification: normalized.classification,
      diagnostics: normalized.diagnostics,
    }),
  });
}

function resolveRetryableFromRecovery(
  recovery: ImageManipulationRetryRecoveryContract | undefined,
  fallback: boolean | undefined,
): boolean {
  if (!recovery) {
    return fallback === true;
  }
  return recovery.retry.retryEligible && recovery.retry.retrySafe;
}

function normalizeDispatchInternalMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  const objectMessage = typeof (error as { message?: unknown } | undefined)?.message === "string"
    ? String((error as { message: string }).message)
    : undefined;
  return objectMessage ?? "Dispatch failed with an unknown backend adapter error.";
}
