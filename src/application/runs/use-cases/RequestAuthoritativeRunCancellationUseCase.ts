import { randomUUID } from "node:crypto";
import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  PlatformAuditEventKinds,
  type PlatformAuditEventRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type { IAuthoritativeRunPersistenceRepository, IRunOrchestrationIntentRepository, IRunOrchestrationQueuePersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  IRunExecutionCancellationSignalPort,
  RunExecutionCancellationSignalResult,
} from "@application/runs/ports/RunExecutionCancellationPorts";
import type {
  AuthoritativeRunMutationAuthorizationActor,
  IAuthoritativeRunMutationAuthorizationPort,
} from "@application/runs/ports/RunMutationAuthorizationPorts";
import { RunExecutionBackendKinds, type RunExecutionBackendKind } from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  RunMutationActions,
  type RunCancellationRequest,
  type RunMutationResponse,
  type RunStatusEnvelope,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  isRunLifecycleTransitionAllowed,
  transitionCanonicalRunRecord,
  type CanonicalRunRecord,
  type RunAssignmentState,
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

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new RunCancellationValidationError(`${label} is required.`);
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
    throw new RunCancellationValidationError("requestedAt must be an ISO-8601 timestamp.");
  }
  return new Date(parsed).toISOString();
}

function normalizeExecutionStateForCancelled(execution: RunExecutionState, occurredAt: string): RunExecutionState {
  return Object.freeze({
    ...execution,
    outcome: RunExecutionOutcomeKinds.cancelled,
    finishedAt: execution.finishedAt ?? occurredAt,
    errorCode: undefined,
    errorMessage: undefined,
  });
}

function normalizeQueueForDequeued(run: CanonicalRunRecord, occurredAt: string) {
  if (!run.queue || run.queue.dequeuedAt) {
    return run.queue;
  }

  return Object.freeze({
    ...run.queue,
    dequeuedAt: occurredAt,
    positionAsOf: occurredAt,
    position: null,
  });
}

function normalizeAssignmentForCancelled(run: CanonicalRunRecord, occurredAt: string): RunAssignmentState {
  if (
    run.assignment.status === RunAssignmentStatuses.assigned
    && run.assignment.assignedNodeId
    && run.assignment.assignedAt
  ) {
    return Object.freeze({
      status: RunAssignmentStatuses.released,
      assignedNodeId: run.assignment.assignedNodeId,
      assignedAt: run.assignment.assignedAt,
      releasedAt: occurredAt,
      releaseReason: "run-cancelled",
    });
  }

  return Object.freeze({
    status: RunAssignmentStatuses.unassigned,
  });
}

function supportsImmediateCancellation(state: RunLifecycleState): boolean {
  return state !== RunLifecycleStates.running && state !== RunLifecycleStates.dispatching;
}

function mapSignalOutcome(signal?: RunExecutionCancellationSignalResult):
  | "not-attempted"
  | "accepted"
  | "not-supported"
  | "rejected"
  | "failed" {
  if (!signal) {
    return "not-attempted";
  }
  if (signal.status === "accepted") {
    return "accepted";
  }
  if (signal.status === "not-supported") {
    return "not-supported";
  }
  if (signal.status === "rejected") {
    return "rejected";
  }
  return "failed";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function resolveCancellationBackendKind(value: string | undefined): RunExecutionBackendKind | undefined {
  if (!value) {
    return undefined;
  }
  return Object.values(RunExecutionBackendKinds).includes(value as RunExecutionBackendKind)
    ? value as RunExecutionBackendKind
    : undefined;
}

export class RunCancellationValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RunCancellationValidationError";
  }
}

export class RunCancellationNotFoundError extends Error {
  public constructor(runId: string) {
    super(`Run '${runId}' was not found.`);
    this.name = "RunCancellationNotFoundError";
  }
}

export class RunCancellationUnauthorizedError extends Error {
  public constructor(runId: string, actorUserIdentityId: string) {
    super(`Actor '${actorUserIdentityId}' is not authorized to cancel run '${runId}'.`);
    this.name = "RunCancellationUnauthorizedError";
  }
}

export const RunCancellationOutcomes = Object.freeze({
  cancelled: "cancelled",
  cancellationRequested: "cancellation-requested",
  alreadyFinalized: "already-finalized",
  alreadyCancelling: "already-cancelling",
  denied: "denied",
});

export type RunCancellationOutcome = typeof RunCancellationOutcomes[keyof typeof RunCancellationOutcomes];

export interface RequestAuthoritativeRunCancellation {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly authorization?: AuthoritativeRunMutationAuthorizationActor;
  readonly request: RunCancellationRequest;
  readonly correlationId?: string;
}

export interface RequestAuthoritativeRunCancellationResult {
  readonly mutation: RunMutationResponse;
  readonly status: RunStatusEnvelope;
  readonly outcome: RunCancellationOutcome;
  readonly signalResult?: RunExecutionCancellationSignalResult;
}

interface RequestAuthoritativeRunCancellationUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly authorization?: IAuthoritativeRunMutationAuthorizationPort;
  readonly cancellationSignalPort?: IRunExecutionCancellationSignalPort;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
  readonly authoritativeAuditRecorder?: Pick<AuthoritativeAuditRecordingPort, "recordRunsEvent">;
}

export class RequestAuthoritativeRunCancellationUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };

  public constructor(private readonly dependencies: RequestAuthoritativeRunCancellationUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
  }

  public async execute(
    input: RequestAuthoritativeRunCancellation,
  ): Promise<RequestAuthoritativeRunCancellationResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const runId = normalizeRequired(input.request.runId, "runId");
    const requestedAt = toIso(input.request.requestedAt, this.now().toISOString());
    const reason = normalizeOptional(input.request.reason);
    const operationSuffix = normalizeOptional(input.request.idempotencyKey)
      ?? this.idGenerator.nextId("cancel");

    let result: RequestAuthoritativeRunCancellationResult | undefined;

    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      const persisted = await this.dependencies.runRepository.findRunById(runId);
      if (!persisted || persisted.workspaceId !== workspaceId) {
        throw new RunCancellationNotFoundError(runId);
      }

      const current = mapPlatformRunRecordToCanonicalRun(persisted);
      const normalizedRequestedBy = normalizeOptional(input.request.requestedByActorId) ?? actorUserIdentityId;
      const authorizationActor = resolveAuthorizationActor(input.authorization, workspaceId, actorUserIdentityId);
      const allowed = this.dependencies.authorization
        ? await this.dependencies.authorization.canCancelRun({
          runId: current.identity.runId,
          workspaceId: current.identity.workspaceId,
          actor: authorizationActor,
        })
        : true;

      const operationKey = `run:cancel:${runId}:${operationSuffix}`;
      const correlationId = normalizeOptional(input.correlationId);

      if (!allowed) {
        await this.appendCancellationAuditEvent({
          run: current,
          actorId: actorUserIdentityId,
          requestedAt,
          outcome: RunCancellationOutcomes.denied,
          fromState: current.state,
          toState: current.state,
          reason,
          signalResult: undefined,
          idempotencyKey: input.request.idempotencyKey,
          correlationId,
        });
        throw new RunCancellationUnauthorizedError(runId, actorUserIdentityId);
      }

      if (current.state === RunLifecycleStates.completed
        || current.state === RunLifecycleStates.failed
        || current.state === RunLifecycleStates.cancelled) {
        await this.appendCancellationAuditEvent({
          run: current,
          actorId: actorUserIdentityId,
          requestedAt,
          outcome: RunCancellationOutcomes.alreadyFinalized,
          fromState: current.state,
          toState: current.state,
          reason,
          signalResult: undefined,
          idempotencyKey: input.request.idempotencyKey,
          correlationId,
        });

        result = Object.freeze({
          outcome: RunCancellationOutcomes.alreadyFinalized,
          mutation: Object.freeze({
            action: RunMutationActions.cancel,
            run: toRunDetailFromPlatformRecord(persisted),
            mutation: Object.freeze({
              changed: false,
              mutationId: operationKey,
              occurredAt: requestedAt,
            }),
          }),
          status: toRunStatusEnvelopeFromPlatformRecord(persisted),
          signalResult: undefined,
        });
        return;
      }

      if (current.state === RunLifecycleStates.cancelling) {
        await this.appendCancellationAuditEvent({
          run: current,
          actorId: actorUserIdentityId,
          requestedAt,
          outcome: RunCancellationOutcomes.alreadyCancelling,
          fromState: current.state,
          toState: current.state,
          reason,
          signalResult: undefined,
          idempotencyKey: input.request.idempotencyKey,
          correlationId,
        });

        result = Object.freeze({
          outcome: RunCancellationOutcomes.alreadyCancelling,
          mutation: Object.freeze({
            action: RunMutationActions.cancel,
            run: toRunDetailFromPlatformRecord(persisted),
            mutation: Object.freeze({
              changed: false,
              mutationId: operationKey,
              occurredAt: requestedAt,
            }),
          }),
          status: toRunStatusEnvelopeFromPlatformRecord(persisted),
          signalResult: undefined,
        });
        return;
      }

      const shouldImmediatelyCancel = supportsImmediateCancellation(current.state);
      const canTransitionDirectlyToCancelled = shouldImmediatelyCancel
        && isRunLifecycleTransitionAllowed(current.state, RunLifecycleStates.cancelled);

      let next = canTransitionDirectlyToCancelled
        ? transitionCanonicalRunRecord(current, {
          toState: RunLifecycleStates.cancelled,
          occurredAt: requestedAt,
          queue: normalizeQueueForDequeued(current, requestedAt),
          assignment: normalizeAssignmentForCancelled(current, requestedAt),
          execution: normalizeExecutionStateForCancelled(current.execution, requestedAt),
          cancellation: Object.freeze({
            requestedAt,
            requestedByActorId: normalizedRequestedBy,
            reason,
            acknowledgedAt: requestedAt,
          }),
        })
        : transitionCanonicalRunRecord(current, {
          toState: RunLifecycleStates.cancelling,
          occurredAt: requestedAt,
          cancellation: Object.freeze({
            requestedAt,
            requestedByActorId: normalizedRequestedBy,
            reason,
          }),
        });

      let signalResult: RunExecutionCancellationSignalResult | undefined;
      if (current.state === RunLifecycleStates.running || current.state === RunLifecycleStates.dispatching) {
        signalResult = await this.signalCancellationBestEffort(next, requestedAt, normalizedRequestedBy, reason);
        if (signalResult?.acknowledgedAt) {
          next = transitionCanonicalRunRecord(next, {
            toState: next.state,
            occurredAt: requestedAt,
            cancellation: Object.freeze({
              ...next.cancellation,
              acknowledgedAt: signalResult.acknowledgedAt,
            }),
          });
        }
      }

      if (shouldImmediatelyCancel && !canTransitionDirectlyToCancelled) {
        next = transitionCanonicalRunRecord(next, {
          toState: RunLifecycleStates.cancelled,
          occurredAt: requestedAt,
          queue: normalizeQueueForDequeued(next, requestedAt),
          assignment: normalizeAssignmentForCancelled(next, requestedAt),
          execution: normalizeExecutionStateForCancelled(next.execution, requestedAt),
          cancellation: Object.freeze({
            ...next.cancellation,
            acknowledgedAt: next.cancellation?.acknowledgedAt ?? requestedAt,
          }),
        });
      }

      const queueEntry = await this.dependencies.queueRepository.getQueueEntryByRunId(runId);
      if (queueEntry?.claimToken) {
        await this.dependencies.queueRepository.releaseRunClaim({
          runId,
          claimToken: queueEntry.claimToken,
          releasedAt: requestedAt,
        });
      }

      if (next.state === RunLifecycleStates.cancelled) {
        await this.dependencies.queueRepository.finalizeRunQueueEntry({
          runId,
          finalizedAt: requestedAt,
          lifecycleState: RunLifecycleStates.cancelled,
        });
      }

      const recordWithCanonical = updatePlatformRunRecordCanonicalState(persisted, next);
      const recordWithMetadata = this.applyCancellationMetadata(recordWithCanonical, {
        requestedAt,
        requestedByActorId: normalizedRequestedBy,
        reason,
        state: next.state,
        signalResult,
      });

      const saved = await this.dependencies.runRepository.saveRun(recordWithMetadata, {
        operationKey,
        actorId: actorUserIdentityId,
        occurredAt: requestedAt,
        correlationId,
        expectedRevision: persisted.revision,
      });

      await this.appendCancellationAuditEvent({
        run: next,
        actorId: actorUserIdentityId,
        requestedAt,
        outcome: next.state === RunLifecycleStates.cancelled
          ? RunCancellationOutcomes.cancelled
          : RunCancellationOutcomes.cancellationRequested,
        fromState: current.state,
        toState: next.state,
        reason,
        signalResult,
        idempotencyKey: input.request.idempotencyKey,
        correlationId,
      });

      result = Object.freeze({
        outcome: next.state === RunLifecycleStates.cancelled
          ? RunCancellationOutcomes.cancelled
          : RunCancellationOutcomes.cancellationRequested,
        mutation: Object.freeze({
          action: RunMutationActions.cancel,
          run: toRunDetailFromPlatformRecord(saved.record),
          mutation: Object.freeze({
            changed: true,
            mutationId: operationKey,
            occurredAt: requestedAt,
          }),
        }),
        status: toRunStatusEnvelopeFromPlatformRecord(saved.record),
        signalResult,
      });
    });

    if (!result) {
      throw new Error(`Run cancellation failed for run '${runId}'.`);
    }

    return result;
  }

  private async signalCancellationBestEffort(
    run: CanonicalRunRecord,
    requestedAt: string,
    requestedByActorId: string,
    reason: string | undefined,
  ): Promise<RunExecutionCancellationSignalResult | undefined> {
    if (!this.dependencies.cancellationSignalPort) {
      return Object.freeze({
        status: "not-supported",
        safeCode: "cancellation-signal-not-configured",
        safeMessage: "Execution backend cancellation signaling is not configured.",
      });
    }

    const backendKind = resolveCancellationBackendKind(normalizeOptional(run.execution.adapterKind));
    const backendRunId = normalizeOptional(run.execution.adapterRunId);

    if (!backendKind || !backendRunId) {
      return Object.freeze({
        status: "not-supported",
        safeCode: "cancellation-signal-unavailable",
        safeMessage: "Execution backend identity is unavailable for cancellation signaling.",
      });
    }

    return this.dependencies.cancellationSignalPort.signalCancellation({
      runId: run.identity.runId,
      workflowId: run.identity.workflowId,
      workspaceId: run.identity.workspaceId,
      state: run.state,
      backendKind,
      backendRunId,
      assignedNodeId: run.assignment.assignedNodeId,
      requestedAt,
      requestedByActorId,
      reason,
    });
  }

  private applyCancellationMetadata(
    record: ReturnType<typeof updatePlatformRunRecordCanonicalState>,
    input: {
      readonly requestedAt: string;
      readonly requestedByActorId: string;
      readonly reason?: string;
      readonly state: RunLifecycleState;
      readonly signalResult?: RunExecutionCancellationSignalResult;
    },
  ): ReturnType<typeof updatePlatformRunRecordCanonicalState> {
    const metadata = asRecord(record.metadata) ?? {};
    const orchestration = asRecord(metadata.orchestration) ?? {};

    metadata.orchestration = Object.freeze({
      ...orchestration,
      cancellation: Object.freeze({
        requestedAt: input.requestedAt,
        requestedByActorId: input.requestedByActorId,
        reason: input.reason,
        state: input.state,
        signal: input.signalResult
          ? Object.freeze({
            status: input.signalResult.status,
            acknowledgedAt: input.signalResult.acknowledgedAt,
            safeCode: input.signalResult.safeCode,
            safeMessage: input.signalResult.safeMessage,
            metadata: input.signalResult.metadata,
          })
          : undefined,
      }),
    });

    return Object.freeze({
      ...record,
      metadata: Object.freeze(metadata),
    });
  }

  private async appendCancellationAuditEvent(input: {
    readonly run: CanonicalRunRecord;
    readonly actorId: string;
    readonly requestedAt: string;
    readonly outcome: RunCancellationOutcome;
    readonly fromState: RunLifecycleState;
    readonly toState: RunLifecycleState;
    readonly reason?: string;
    readonly signalResult?: RunExecutionCancellationSignalResult;
    readonly idempotencyKey?: string;
    readonly correlationId?: string;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.cancellation.requested",
      actorId: input.actorId,
      workspaceId: input.run.identity.workspaceId,
      userIdentityId: input.run.submission.submittedByActorId,
      targetRef: `run:${input.run.identity.runId}`,
      outcome: input.outcome === RunCancellationOutcomes.alreadyFinalized
        || input.outcome === RunCancellationOutcomes.denied
        ? "rejected"
        : "succeeded",
      occurredAt: input.requestedAt,
      correlationId: input.correlationId,
      details: Object.freeze({
        outcome: input.outcome,
        fromState: input.fromState,
        toState: input.toState,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        signal: Object.freeze({
          outcome: mapSignalOutcome(input.signalResult),
          acknowledgedAt: input.signalResult?.acknowledgedAt,
          safeCode: input.signalResult?.safeCode,
          safeMessage: input.signalResult?.safeMessage,
        }),
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:cancellation-audit:${input.run.identity.runId}:${event.eventId}`,
      actorId: input.actorId,
      occurredAt: input.requestedAt,
      correlationId: input.correlationId,
    });

    if (!this.dependencies.authoritativeAuditRecorder) {
      return;
    }

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:cancellation:${input.run.identity.runId}:${input.outcome}`,
        eventType: "run-cancellation-requested",
        action: "run.cancellation.requested",
        outcome: input.outcome === RunCancellationOutcomes.alreadyFinalized
          || input.outcome === RunCancellationOutcomes.denied
          ? AuditEventOutcomes.denied
          : AuditEventOutcomes.succeeded,
        occurredAt: input.requestedAt,
        actor: Object.freeze({
          actorId: input.actorId,
          actorKind: input.actorId.startsWith("user:")
            ? AuditActorKinds.user
            : AuditActorKinds.service,
          actorUserIdentityId: input.actorId.startsWith("user:") ? input.actorId : undefined,
          actorServiceId: input.actorId.startsWith("user:") ? undefined : input.actorId,
        }),
        scope: Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId: input.run.identity.workspaceId,
        }),
        protectedResource: Object.freeze({
          resourceType: "run",
          resourceId: input.run.identity.runId,
          resourceRef: input.run.identity.runId.startsWith("run:")
            ? input.run.identity.runId
            : `run:${input.run.identity.runId}`,
          sensitivityClass: "sensitive",
          workspaceId: input.run.identity.workspaceId,
        }),
        correlationId: input.correlationId,
        payload: Object.freeze({
          userSafeDetails: Object.freeze({
            outcome: input.outcome,
            fromState: input.fromState,
            toState: input.toState,
            reasonCode: resolveCancellationReasonCode(input.outcome),
          }),
          adminOnlyDetails: Object.freeze({
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
            signal: Object.freeze({
              outcome: mapSignalOutcome(input.signalResult),
              acknowledgedAt: input.signalResult?.acknowledgedAt,
              safeCode: input.signalResult?.safeCode,
              safeMessage: input.signalResult?.safeMessage,
            }),
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail cancellation behavior.
    }
  }
}

function resolveCancellationReasonCode(
  outcome: RunCancellationOutcome,
): "cancelled" | "cancellation-requested" | "already-finalized" | "already-cancelling" | "denied" {
  return outcome;
}

function resolveAuthorizationActor(
  input: AuthoritativeRunMutationAuthorizationActor | undefined,
  workspaceId: string,
  actorUserIdentityId: string,
): AuthoritativeRunMutationAuthorizationActor {
  return Object.freeze({
    actorUserIdentityId,
    activeWorkspaceId: normalizeOptional(input?.activeWorkspaceId) ?? workspaceId,
    authenticatedAt: normalizeOptional(input?.authenticatedAt),
  });
}
