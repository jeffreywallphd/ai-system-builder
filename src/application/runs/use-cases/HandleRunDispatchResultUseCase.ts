import { randomUUID } from "node:crypto";
import { PlatformAuditEventKinds, type PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type {
  AuthoritativeRunDispatchAttemptResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunLifecycleStates,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import { toRunDetail, type RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  mapPlatformRunRecordToCanonicalRun,
  updatePlatformRunRecordCanonicalState,
} from "./RunCreationPersistenceMapper";
import {
  transitionDispatchingRunToOutcome,
  transitionRunToDispatching,
  type RunDispatchOutcome,
} from "./RunDispatchResultStateTransitions";
import type { CanonicalRunExecutionCommand, RunExecutionDispatchReceipt } from "@application/runs/ports/RunExecutionDispatchPorts";

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
}

interface HandleRunDispatchResultUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

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

export class HandleRunDispatchResultUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };

  public constructor(private readonly dependencies: HandleRunDispatchResultUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
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

      const activeRun = mapPlatformRunRecordToCanonicalRun(activePersistedRun);
      const finalRun = transitionDispatchingRunToOutcome({
        run: activeRun,
        command: request.command,
        outcome: request.outcome,
      });
      const finalRecord = updatePlatformRunRecordCanonicalState(activePersistedRun, finalRun);
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
      });

      result = Object.freeze({
        run: toRunDetail(mapPlatformRunRecordToCanonicalRun(savedFinal.record)),
        fromState: currentRun.state,
        toState: finalRun.state,
        dispatchAttemptResult,
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
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:lifecycle-event:${input.runId}:${input.dispatchAttemptId}:${input.fromState}->${input.toState}`,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
    });
  }
}

export function createDispatchFailureOutcome(input: {
  readonly failedAt: string;
  readonly error: unknown;
}): RunDispatchOutcome {
  const error = input.error;
  const objectMessage = typeof (error as { message?: unknown } | undefined)?.message === "string"
    ? String((error as { message: string }).message)
    : undefined;
  const internalMessage = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : objectMessage
        ?? "Dispatch failed with an unknown backend adapter error.";
  const internalCode = typeof (error as { code?: unknown } | undefined)?.code === "string"
    ? String((error as { code: string }).code)
    : undefined;
  const retryable = typeof (error as { retryable?: unknown } | undefined)?.retryable === "boolean"
    ? Boolean((error as { retryable: boolean }).retryable)
    : undefined;

  return Object.freeze({
    status: "failed-to-start",
    failedAt: input.failedAt,
    failure: Object.freeze({
      safeCode: "dispatch-failed-to-start",
      safeMessage: "Run failed to start on the selected execution backend.",
      internalCode,
      internalMessage,
      retryable,
    }),
  });
}

export function createDispatchAcceptedOutcome(receipt: RunExecutionDispatchReceipt): RunDispatchOutcome {
  return Object.freeze({
    status: "accepted",
    receipt,
  });
}
