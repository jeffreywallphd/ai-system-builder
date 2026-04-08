import { randomUUID } from "node:crypto";
import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  PlatformAuditEventKinds,
  type PlatformAuditEventRecord,
  type PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
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
  isRunLifecycleTransitionAllowed,
  transitionCanonicalRunRecord,
  type RunExecutionProgressState,
  type RunExecutionState,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";
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
  readonly authoritativeAuditRecorder?: Pick<AuthoritativeAuditRecordingPort, "recordRunsEvent">;
}

interface ExecutionUpdateSynchronizationResult {
  readonly toState: RunLifecycleState;
  readonly execution: RunExecutionState;
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

      const synchronization = this.synchronizeExecutionUpdate({
        currentState: current.state,
        current: current.execution,
        update: request.update,
        occurredAt,
      });
      const toState = synchronization.toState;
      const nextExecution = synchronization.execution;
      const canonicalChanged = toState !== current.state || !isExecutionStateEqual(current.execution, nextExecution);
      const diagnosticsChanged = this.hasDiagnosticsChange({
        record: persisted,
        request,
        occurredAt,
      });
      if (!canonicalChanged && !diagnosticsChanged) {
        result = this.createNoChangeResult(persisted, runId, operationSuffix, occurredAt);
        return;
      }

      const next = transitionCanonicalRunRecord(current, {
        toState,
        occurredAt,
        execution: nextExecution,
      });

      const persistedCanonical = updatePlatformRunRecordCanonicalState(persisted, next);
      let persistedWithDiagnostics = this.applyInternalDiagnosticsMetadata(
        persistedCanonical,
        request,
        occurredAt,
      );
      if (
        toState === RunLifecycleStates.completed
        || toState === RunLifecycleStates.failed
        || toState === RunLifecycleStates.cancelled
      ) {
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
        correlationId: normalizeOptional(request.update.actorId),
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

  private synchronizeExecutionUpdate(input: {
    readonly currentState: RunLifecycleState;
    readonly current: RunExecutionState;
    readonly update: RunLifecycleUpdateRequest;
    readonly occurredAt: string;
  }): ExecutionUpdateSynchronizationResult {
    const requestedState = input.update.toState ?? input.currentState;
    const toState = this.resolveTargetState({
      currentState: input.currentState,
      requestedState,
    });
    return Object.freeze({
      toState,
      execution: this.buildExecutionState({
        current: input.current,
        update: input.update,
        toState,
        occurredAt: input.occurredAt,
      }),
    });
  }

  private resolveTargetState(input: {
    readonly currentState: RunLifecycleState;
    readonly requestedState: RunLifecycleState;
  }): RunLifecycleState {
    if (input.requestedState === input.currentState) {
      return input.currentState;
    }
    if (isRunLifecycleTransitionAllowed(input.currentState, input.requestedState)) {
      return input.requestedState;
    }
    return input.currentState;
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
    readonly toState: RunLifecycleState;
    readonly occurredAt: string;
  }): RunExecutionState {
    const heartbeatAt = resolveHeartbeatAt(input.current.heartbeatAt, [
      input.update.heartbeatAt,
      input.update.execution?.heartbeatAt,
    ]);
    const progress = resolveProgressState(input.current.progress, [
      input.update.progress,
      input.update.execution?.progress,
    ]);

    const merged: RunExecutionState = Object.freeze({
      ...input.current,
      ...input.update.execution,
      adapterKind: normalizeOptional(input.update.execution?.adapterKind)
        ?? normalizeOptional(input.update.senderBackendKind)
        ?? input.current.adapterKind,
      adapterRunId: normalizeOptional(input.update.execution?.adapterRunId)
        ?? normalizeOptional(input.update.senderBackendRunId)
        ?? input.current.adapterRunId,
      heartbeatAt,
      progress,
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
    const lastInternalUpdate = asRecord(executionTelemetry.lastInternalUpdate);
    const lastUpdatedAt = normalizeOptional(
      typeof lastInternalUpdate?.updatedAt === "string" ? lastInternalUpdate.updatedAt : undefined,
    );
    if (lastUpdatedAt && Date.parse(occurredAt) <= Date.parse(lastUpdatedAt)) {
      return record;
    }
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

  private hasDiagnosticsChange(input: {
    readonly record: PlatformRunRecord;
    readonly request: IngestRunExecutionUpdateRequest;
    readonly occurredAt: string;
  }): boolean {
    if (!input.request.update.internalDiagnostics) {
      return false;
    }
    const metadata = asRecord(input.record.metadata);
    const executionTelemetry = asRecord(metadata?.executionTelemetry);
    const lastInternalUpdate = asRecord(executionTelemetry?.lastInternalUpdate);
    const lastUpdatedAt = normalizeOptional(
      typeof lastInternalUpdate?.updatedAt === "string" ? lastInternalUpdate.updatedAt : undefined,
    );
    if (!lastUpdatedAt) {
      return true;
    }
    return Date.parse(input.occurredAt) > Date.parse(lastUpdatedAt);
  }

  private createNoChangeResult(
    persisted: PlatformRunRecord,
    runId: string,
    operationSuffix: string,
    occurredAt: string,
  ): IngestRunExecutionUpdateResult {
    return Object.freeze({
      mutation: Object.freeze({
        action: RunMutationActions.lifecycleUpdate,
        run: toRunDetailFromPlatformRecord(persisted),
        mutation: Object.freeze({
          changed: false,
          mutationId: `run:execution-update:${runId}:${operationSuffix}`,
          occurredAt,
        }),
      }),
      status: toRunStatusEnvelopeFromPlatformRecord(persisted),
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
    readonly correlationId?: string;
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

    if (!this.dependencies.authoritativeAuditRecorder) {
      return;
    }

    const lifecycleChanged = input.fromState !== input.toState;
    const action = lifecycleChanged ? "run.lifecycle.transitioned" : "run.execution-update.ingested";
    const eventType = lifecycleChanged ? "run-lifecycle-transitioned" : "run-execution-update-ingested";

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:execution-update:${input.runId}:${input.occurredAt}`,
        eventType,
        action,
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
            fromState: input.fromState,
            toState: input.toState,
            hadProgress: input.hadProgress,
            hadHeartbeat: input.hadHeartbeat,
            hadInternalDiagnostics: input.hadInternalDiagnostics,
            isTerminalState: input.toState === RunLifecycleStates.completed
              || input.toState === RunLifecycleStates.failed
              || input.toState === RunLifecycleStates.cancelled,
          }),
          adminOnlyDetails: Object.freeze({
            idempotencyKey: input.idempotencyKey,
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail execution update ingestion.
    }
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

function resolveHeartbeatAt(
  currentHeartbeatAt: string | undefined,
  candidates: ReadonlyArray<string | undefined>,
): string | undefined {
  let selected = currentHeartbeatAt;
  for (const value of candidates) {
    const normalized = normalizeOptional(value);
    if (!normalized) {
      continue;
    }
    if (!selected || Date.parse(normalized) > Date.parse(selected)) {
      selected = normalized;
    }
  }
  return selected;
}

function resolveProgressState(
  current: RunExecutionProgressState | undefined,
  candidates: ReadonlyArray<RunLifecycleUpdateRequest["progress"] | undefined>,
): RunExecutionProgressState | undefined {
  let selected = current;
  for (const value of candidates) {
    if (!value) {
      continue;
    }
    if (!selected || Date.parse(value.updatedAt) > Date.parse(selected.updatedAt)) {
      selected = Object.freeze({
        updatedAt: value.updatedAt,
        percent: value.percent,
        stage: value.stage,
        message: value.message,
      });
    }
  }
  return selected;
}

function isExecutionStateEqual(left: RunExecutionState, right: RunExecutionState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
