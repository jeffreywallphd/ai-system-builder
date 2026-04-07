import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  RunFinalizationOutcomeStatuses,
  type AuthoritativeRunFinalizationRecord,
  type IRunFinalizationResultRegistrationPort,
  type IRunOrchestrationQueuePersistenceRepository,
  type RunFinalizationRegistrationRequest,
  type RunFinalizationRegistrationResult,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  transitionCanonicalRunRecord,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import type { RunLifecycleUpdateRequest, RunResultOutputReference } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { updatePlatformRunRecordCanonicalState } from "./RunCreationPersistenceMapper";

export interface FinalizeRunExecutionOutcomeRequest {
  readonly run: CanonicalRunRecord;
  readonly runRecord: PlatformRunRecord;
  readonly occurredAt: string;
  readonly lifecycleUpdate?: RunLifecycleUpdateRequest;
  readonly senderNodeId?: string;
  readonly internalDiagnostics?: Readonly<Record<string, unknown>>;
}

export interface FinalizeRunExecutionOutcomeResult {
  readonly run: CanonicalRunRecord;
  readonly runRecord: PlatformRunRecord;
  readonly finalization?: AuthoritativeRunFinalizationRecord;
  readonly queueFinalized: boolean;
}

interface FinalizeRunExecutionOutcomeUseCaseDependencies {
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly resultRegistrationPort?: IRunFinalizationResultRegistrationPort;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class DefaultRunFinalizationResultRegistrationPort implements IRunFinalizationResultRegistrationPort {
  public async registerFinalizationResult(
    request: RunFinalizationRegistrationRequest,
  ): Promise<RunFinalizationRegistrationResult> {
    const summary = request.result?.summary?.trim()
      || (request.outcome === "failed" ? request.safeFailureMessage ?? "Run failed during execution." : "Run completed.");
    const outputReferences = normalizeOutputReferences(request.result?.outputs);

    return Object.freeze({
      summary: Object.freeze({
        finalizedAt: request.finalizedAt,
        outcome: request.outcome,
        summary,
        outputs: outputReferences,
        metrics: request.result?.metrics,
        externalResultId: normalizeOptional(request.result?.externalResultId),
      }),
      internalDiagnostics: request.outcome === "failed"
        ? Object.freeze({
          safeFailureCode: request.safeFailureCode,
          safeFailureMessage: request.safeFailureMessage,
        })
        : undefined,
    });
  }
}

export class FinalizeRunExecutionOutcomeUseCase {
  private readonly resultRegistrationPort: IRunFinalizationResultRegistrationPort;

  public constructor(private readonly dependencies: FinalizeRunExecutionOutcomeUseCaseDependencies) {
    this.resultRegistrationPort = dependencies.resultRegistrationPort ?? new DefaultRunFinalizationResultRegistrationPort();
  }

  public async execute(request: FinalizeRunExecutionOutcomeRequest): Promise<FinalizeRunExecutionOutcomeResult> {
    if (request.run.state !== RunLifecycleStates.completed && request.run.state !== RunLifecycleStates.failed) {
      return Object.freeze({
        run: request.run,
        runRecord: request.runRecord,
        finalization: undefined,
        queueFinalized: false,
      });
    }

    const finalizedAt = request.occurredAt;
    const runWithReleasedAssignment = this.releaseAssignmentIfActive(request.run, finalizedAt);
    const runWithQueueHistory = this.ensureQueueDequeueTimestamp(runWithReleasedAssignment, finalizedAt);

    const finalizationResult = await this.resultRegistrationPort.registerFinalizationResult({
      runId: runWithQueueHistory.identity.runId,
      workflowId: runWithQueueHistory.identity.workflowId,
      workspaceId: runWithQueueHistory.identity.workspaceId,
      finalizedAt,
      outcome: runWithQueueHistory.state === RunLifecycleStates.completed
        ? RunFinalizationOutcomeStatuses.completed
        : RunFinalizationOutcomeStatuses.failed,
      result: request.lifecycleUpdate?.result,
      safeFailureCode: runWithQueueHistory.execution.outcome === RunExecutionOutcomeKinds.failed
        ? runWithQueueHistory.execution.errorCode
        : undefined,
      safeFailureMessage: runWithQueueHistory.execution.outcome === RunExecutionOutcomeKinds.failed
        ? runWithQueueHistory.execution.errorMessage
        : undefined,
    });

    const nextRecord = this.applyFinalizationMetadata({
      record: request.runRecord,
      run: runWithQueueHistory,
      finalization: finalizationResult.summary,
      senderNodeId: request.senderNodeId,
      internalDiagnostics: request.internalDiagnostics,
      registrationDiagnostics: finalizationResult.internalDiagnostics,
      finalizedAt,
    });

    const queueFinalized = await this.dependencies.queueRepository.finalizeRunQueueEntry({
      runId: runWithQueueHistory.identity.runId,
      finalizedAt,
      lifecycleState: runWithQueueHistory.state,
    });

    return Object.freeze({
      run: runWithQueueHistory,
      runRecord: nextRecord,
      finalization: finalizationResult.summary,
      queueFinalized,
    });
  }

  private releaseAssignmentIfActive(run: CanonicalRunRecord, releasedAt: string): CanonicalRunRecord {
    if (run.assignment.status !== "assigned" || !run.assignment.assignedNodeId || !run.assignment.assignedAt) {
      return run;
    }

    return transitionCanonicalRunRecord(run, {
      toState: run.state,
      occurredAt: releasedAt,
      assignment: Object.freeze({
        status: "released",
        assignedNodeId: run.assignment.assignedNodeId,
        assignedAt: run.assignment.assignedAt,
        releasedAt,
        releaseReason: run.state === RunLifecycleStates.completed
          ? "execution-completed"
          : "execution-failed",
      }),
    });
  }

  private ensureQueueDequeueTimestamp(run: CanonicalRunRecord, finalizedAt: string): CanonicalRunRecord {
    if (!run.queue || run.queue.dequeuedAt) {
      return run;
    }

    return transitionCanonicalRunRecord(run, {
      toState: run.state,
      occurredAt: finalizedAt,
      queue: Object.freeze({
        ...run.queue,
        dequeuedAt: finalizedAt,
        positionAsOf: finalizedAt,
      }),
    });
  }

  private applyFinalizationMetadata(input: {
    readonly record: PlatformRunRecord;
    readonly run: CanonicalRunRecord;
    readonly finalization: AuthoritativeRunFinalizationRecord;
    readonly senderNodeId?: string;
    readonly internalDiagnostics?: Readonly<Record<string, unknown>>;
    readonly registrationDiagnostics?: Readonly<Record<string, unknown>>;
    readonly finalizedAt: string;
  }): PlatformRunRecord {
    const metadata = isObject(input.record.metadata)
      ? { ...(input.record.metadata as Record<string, unknown>) }
      : {};
    const orchestration = isObject(metadata.orchestration)
      ? { ...(metadata.orchestration as Record<string, unknown>) }
      : {};

    metadata.orchestration = Object.freeze({
      ...orchestration,
      finalization: input.finalization,
    });

    if (input.internalDiagnostics || input.registrationDiagnostics) {
      const executionTelemetry = isObject(metadata.executionTelemetry)
        ? { ...(metadata.executionTelemetry as Record<string, unknown>) }
        : {};
      executionTelemetry.finalizationInternal = Object.freeze({
        finalizedAt: input.finalizedAt,
        senderNodeId: normalizeOptional(input.senderNodeId),
        diagnostics: input.internalDiagnostics,
        registrationDiagnostics: input.registrationDiagnostics,
      });
      metadata.executionTelemetry = Object.freeze(executionTelemetry);
    }

    return updatePlatformRunRecordCanonicalState(Object.freeze({
      ...input.record,
      metadata: Object.freeze(metadata),
    }), input.run);
  }
}

function normalizeOutputReferences(
  value: ReadonlyArray<RunResultOutputReference> | undefined,
): ReadonlyArray<RunResultOutputReference> {
  if (!value || value.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(value.map((entry) => Object.freeze({ ...entry })));
}
