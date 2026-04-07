import { randomUUID } from "node:crypto";
import { PlatformAuditEventKinds, type PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunFinalizationResultRegistrationPort,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  RunLifecycleUpdateRequest,
  RunMutationResponse,
  RunStatusEnvelope,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RunMutationActions,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  transitionCanonicalRunRecord,
  type RunExecutionState,
} from "@domain/runs/RunDomain";
import {
  mapPlatformRunRecordToCanonicalRun,
  toRunDetailFromPlatformRecord,
  toRunStatusEnvelopeFromPlatformRecord,
  updatePlatformRunRecordCanonicalState,
} from "./RunCreationPersistenceMapper";
import { FinalizeRunExecutionOutcomeUseCase } from "./FinalizeRunExecutionOutcomeUseCase";

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new RunExecutionUpdateValidationError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toIso(value: string | undefined, fallback: string): string {
  const candidate = normalizeOptional(value) ?? fallback;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    throw new RunExecutionUpdateValidationError("occurredAt must be an ISO-8601 timestamp.");
  }
  return new Date(parsed).toISOString();
}

export class RunExecutionUpdateValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RunExecutionUpdateValidationError";
  }
}

export class RunExecutionUpdateNotFoundError extends Error {
  public constructor(runId: string) {
    super(`Run '${runId}' was not found.`);
    this.name = "RunExecutionUpdateNotFoundError";
  }
}

export class RunExecutionUpdateForbiddenError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RunExecutionUpdateForbiddenError";
  }
}

export class RunExecutionUpdateConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RunExecutionUpdateConflictError";
  }
}

export interface IngestRunExecutionUpdateRequest {
  readonly runId: string;
  readonly senderNodeId: string;
  readonly update: RunLifecycleUpdateRequest;
}

export interface IngestRunExecutionUpdateResult {
  readonly mutation: RunMutationResponse;
  readonly status: RunStatusEnvelope;
}

interface IngestRunExecutionUpdateUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly resultRegistrationPort?: IRunFinalizationResultRegistrationPort;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export class IngestRunExecutionUpdateUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };
  private readonly finalizationUseCase: FinalizeRunExecutionOutcomeUseCase;

  public constructor(private readonly dependencies: IngestRunExecutionUpdateUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
    this.finalizationUseCase = new FinalizeRunExecutionOutcomeUseCase({
      queueRepository: dependencies.queueRepository,
      resultRegistrationPort: dependencies.resultRegistrationPort,
    });
  }

  public async execute(request: IngestRunExecutionUpdateRequest): Promise<IngestRunExecutionUpdateResult> {
    const runId = normalizeRequired(request.runId, "runId");
    const senderNodeId = normalizeRequired(request.senderNodeId, "senderNodeId");
    const baseOccurredAt = toIso(request.update.occurredAt, this.now().toISOString());
    const progressOccurredAt = normalizeOptional(request.update.progress?.updatedAt)
      ?? normalizeOptional(request.update.execution?.progress?.updatedAt);
    const occurredAt = progressOccurredAt
      ? maxIso(baseOccurredAt, toIso(progressOccurredAt, baseOccurredAt))
      : baseOccurredAt;
    const operationSuffix = normalizeOptional(request.update.idempotencyKey) ?? this.idGenerator.nextId("update");

    if (!hasExecutionSignal(request.update)) {
      throw new RunExecutionUpdateValidationError(
        "Execution update payload must include lifecycle transition, heartbeat, progress, or execution fields.",
      );
    }

    let result: IngestRunExecutionUpdateResult | undefined;

    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      const persisted = await this.dependencies.runRepository.findRunById(runId);
      if (!persisted) {
        throw new RunExecutionUpdateNotFoundError(runId);
      }

      const current = mapPlatformRunRecordToCanonicalRun(persisted);
      this.assertSenderAuthorized(current.assignment.assignedNodeId, senderNodeId, runId);
      this.assertRunUpdateable(current.state, runId);
      this.assertBackendConsistency(current.execution, request.update);

      const toState = request.update.toState ?? current.state;
      const nextExecution = this.buildExecutionState({
        current: current.execution,
        update: request.update,
        toState,
        occurredAt,
      });

      let next = transitionCanonicalRunRecord(current, {
        toState,
        occurredAt,
        execution: nextExecution,
      });
      next = this.applyProgress(next, request.update.progress);

      const persistedCanonical = updatePlatformRunRecordCanonicalState(persisted, next);
      let persistedWithDiagnostics = this.applyInternalDiagnosticsMetadata(
        persistedCanonical,
        request,
        occurredAt,
      );
      if (toState === RunLifecycleStates.completed || toState === RunLifecycleStates.failed) {
        const finalized = await this.finalizationUseCase.execute({
          run: next,
          runRecord: persistedWithDiagnostics,
          occurredAt,
          lifecycleUpdate: request.update,
          senderNodeId,
          internalDiagnostics: request.update.internalDiagnostics,
        });
        persistedWithDiagnostics = finalized.runRecord;
      }

      const saved = await this.dependencies.runRepository.saveRun(
        persistedWithDiagnostics,
        {
          operationKey: `run:execution-update:${runId}:${operationSuffix}`,
          actorId: senderNodeId,
          occurredAt,
          correlationId: normalizeOptional(request.update.actorId),
          expectedRevision: persisted.revision,
        },
      );

      await this.appendExecutionUpdateAuditEvent({
        runId,
        workspaceId: saved.record.workspaceId,
        userIdentityId: saved.record.userIdentityId,
        actorId: senderNodeId,
        occurredAt,
        fromState: current.state,
        toState,
        hadProgress: Boolean(request.update.progress),
        hadHeartbeat: Boolean(request.update.heartbeatAt || request.update.execution?.heartbeatAt),
        hadInternalDiagnostics: Boolean(request.update.internalDiagnostics),
        idempotencyKey: request.update.idempotencyKey,
      });

      result = Object.freeze({
        mutation: Object.freeze({
          action: RunMutationActions.lifecycleUpdate,
          run: toRunDetailFromPlatformRecord(saved.record),
          mutation: Object.freeze({
            changed: true,
            mutationId: `run:execution-update:${runId}:${operationSuffix}`,
            occurredAt,
          }),
        }),
        status: toRunStatusEnvelopeFromPlatformRecord(saved.record),
      });
    });

    if (!result) {
      throw new Error(`Execution update ingestion failed for run '${runId}'.`);
    }
    return result;
  }

  private assertSenderAuthorized(assignedNodeId: string | undefined, senderNodeId: string, runId: string): void {
    const expected = normalizeOptional(assignedNodeId);
    if (!expected) {
      throw new RunExecutionUpdateConflictError(
        `Run '${runId}' is not assigned to a node and cannot accept execution updates.`,
      );
    }
    if (expected !== senderNodeId) {
      throw new RunExecutionUpdateForbiddenError(
        `Node '${senderNodeId}' is not authorized to update run '${runId}'.`,
      );
    }
  }

  private assertRunUpdateable(state: string, runId: string): void {
    if (state === RunLifecycleStates.completed || state === RunLifecycleStates.failed || state === RunLifecycleStates.cancelled) {
      throw new RunExecutionUpdateConflictError(
        `Run '${runId}' is terminal and cannot accept execution updates.`,
      );
    }
  }

  private assertBackendConsistency(current: RunExecutionState, update: RunLifecycleUpdateRequest): void {
    const currentAdapterRunId = normalizeOptional(current.adapterRunId);
    const incomingAdapterRunId = normalizeOptional(update.senderBackendRunId) ?? normalizeOptional(update.execution?.adapterRunId);
    if (currentAdapterRunId && incomingAdapterRunId && currentAdapterRunId !== incomingAdapterRunId) {
      throw new RunExecutionUpdateConflictError(
        `Execution update adapterRunId '${incomingAdapterRunId}' does not match authoritative adapterRunId '${currentAdapterRunId}'.`,
      );
    }

    const currentAdapterKind = normalizeOptional(current.adapterKind);
    const incomingAdapterKind = normalizeOptional(update.senderBackendKind) ?? normalizeOptional(update.execution?.adapterKind);
    if (currentAdapterKind && incomingAdapterKind && currentAdapterKind !== incomingAdapterKind) {
      throw new RunExecutionUpdateConflictError(
        `Execution update adapterKind '${incomingAdapterKind}' does not match authoritative adapterKind '${currentAdapterKind}'.`,
      );
    }
  }

  private buildExecutionState(input: {
    readonly current: RunExecutionState;
    readonly update: RunLifecycleUpdateRequest;
    readonly toState: string;
    readonly occurredAt: string;
  }): RunExecutionState {
    const merged: RunExecutionState = Object.freeze({
      ...input.current,
      ...input.update.execution,
      adapterKind: normalizeOptional(input.update.execution?.adapterKind)
        ?? normalizeOptional(input.update.senderBackendKind)
        ?? input.current.adapterKind,
      adapterRunId: normalizeOptional(input.update.execution?.adapterRunId)
        ?? normalizeOptional(input.update.senderBackendRunId)
        ?? input.current.adapterRunId,
      heartbeatAt: normalizeOptional(input.update.heartbeatAt)
        ?? normalizeOptional(input.update.execution?.heartbeatAt)
        ?? input.current.heartbeatAt,
      progress: input.update.progress
        ? Object.freeze({
          updatedAt: input.update.progress.updatedAt,
          percent: input.update.progress.percent,
          stage: input.update.progress.stage,
          message: input.update.progress.message,
        })
        : input.update.execution?.progress
          ? Object.freeze({
            updatedAt: input.update.execution.progress.updatedAt,
            percent: input.update.execution.progress.percent,
            stage: input.update.execution.progress.stage,
            message: input.update.execution.progress.message,
          })
        : input.current.progress,
      outcome: input.update.execution?.outcome ?? input.current.outcome,
    });

    if (input.toState === RunLifecycleStates.running && !merged.startedAt) {
      return Object.freeze({
        ...merged,
        startedAt: input.occurredAt,
      });
    }

    if (
      input.toState === RunLifecycleStates.completed
      || input.toState === RunLifecycleStates.failed
      || input.toState === RunLifecycleStates.cancelled
    ) {
      const resolvedOutcome = resolveTerminalOutcome(input.toState, merged.outcome);
      const failedMessage = resolvedOutcome === RunExecutionOutcomeKinds.failed
        ? normalizeOptional(merged.errorMessage) ?? "Run failed during execution."
        : merged.errorMessage;
      return Object.freeze({
        ...merged,
        finishedAt: merged.finishedAt ?? input.occurredAt,
        outcome: resolvedOutcome,
        errorMessage: failedMessage,
        errorCode: resolvedOutcome === RunExecutionOutcomeKinds.failed
          ? normalizeOptional(merged.errorCode) ?? "execution-failed"
          : merged.errorCode,
      });
    }

    return merged;
  }

  private applyProgress(
    run: ReturnType<typeof mapPlatformRunRecordToCanonicalRun>,
    progress: RunLifecycleUpdateRequest["progress"] | undefined,
  ): ReturnType<typeof mapPlatformRunRecordToCanonicalRun> {
    if (!progress) {
      return run;
    }

    return transitionCanonicalRunRecord(run, {
      toState: run.state,
      occurredAt: run.updatedAt,
      execution: Object.freeze({
        ...run.execution,
        progress: Object.freeze({
          updatedAt: progress.updatedAt,
          percent: progress.percent,
          stage: progress.stage,
          message: progress.message,
        }),
      }),
    });
  }

  private applyInternalDiagnosticsMetadata(
    record: ReturnType<typeof updatePlatformRunRecordCanonicalState>,
    request: IngestRunExecutionUpdateRequest,
    occurredAt: string,
  ): ReturnType<typeof updatePlatformRunRecordCanonicalState> {
    if (!request.update.internalDiagnostics) {
      return record;
    }

    const metadata = asRecord(record.metadata) ?? {};
    const executionTelemetry = asRecord(metadata.executionTelemetry) ?? {};
    const nextMetadata = Object.freeze({
      ...metadata,
      executionTelemetry: Object.freeze({
        ...executionTelemetry,
        lastInternalUpdate: Object.freeze({
          updatedAt: occurredAt,
          senderNodeId: request.senderNodeId,
          senderBackendKind: request.update.senderBackendKind,
          senderBackendRunId: request.update.senderBackendRunId,
          diagnostics: request.update.internalDiagnostics,
        }),
      }),
    });

    return Object.freeze({
      ...record,
      metadata: nextMetadata,
    });
  }

  private async appendExecutionUpdateAuditEvent(input: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
    readonly actorId: string;
    readonly occurredAt: string;
    readonly fromState: string;
    readonly toState: string;
    readonly hadProgress: boolean;
    readonly hadHeartbeat: boolean;
    readonly hadInternalDiagnostics: boolean;
    readonly idempotencyKey?: string;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.execution-update.ingested",
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
      targetRef: `run:${input.runId}`,
      outcome: "succeeded",
      occurredAt: input.occurredAt,
      details: Object.freeze({
        fromState: input.fromState,
        toState: input.toState,
        hadProgress: input.hadProgress,
        hadHeartbeat: input.hadHeartbeat,
        hadInternalDiagnostics: input.hadInternalDiagnostics,
        idempotencyKey: input.idempotencyKey,
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:execution-update-audit:${input.runId}:${event.eventId}`,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
    });
  }
}

function hasExecutionSignal(update: RunLifecycleUpdateRequest): boolean {
  return Boolean(
    update.toState
      || update.heartbeatAt
      || update.progress
      || update.execution
      || update.internalDiagnostics,
  );
}

function resolveTerminalOutcome(
  toState: string,
  currentOutcome: RunExecutionState["outcome"],
): RunExecutionState["outcome"] {
  if (toState === RunLifecycleStates.completed) {
    return currentOutcome === RunExecutionOutcomeKinds.none
      ? RunExecutionOutcomeKinds.succeeded
      : currentOutcome;
  }
  if (toState === RunLifecycleStates.cancelled) {
    return currentOutcome === RunExecutionOutcomeKinds.none
      ? RunExecutionOutcomeKinds.cancelled
      : currentOutcome;
  }
  if (toState === RunLifecycleStates.failed) {
    return currentOutcome === RunExecutionOutcomeKinds.none
      ? RunExecutionOutcomeKinds.failed
      : currentOutcome;
  }
  return currentOutcome;
}

function maxIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}
