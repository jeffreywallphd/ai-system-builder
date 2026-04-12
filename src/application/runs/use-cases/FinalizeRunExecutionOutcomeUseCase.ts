import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  parseImageManipulationCollectedExecutionResult,
  type ImageManipulationCollectedExecutionResult,
} from "@application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts";
import {
  RunCollectedResultPersistenceStatuses,
  RunFinalizationOutcomeStatuses,
  type AuthoritativeRunFinalizationRecord,
  type IRunCollectedResultPersistencePort,
  type IRunFinalizationResultRegistrationPort,
  type IRunOrchestrationQueuePersistenceRepository,
  type RunCollectedResultPersistenceResult,
  type RunFinalizationRegistrationRequest,
  type RunFinalizationRegistrationResult,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  transitionCanonicalRunRecord,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  AuditActorKinds,
  AuditEventOutcomes,
  AuditScopeKinds,
} from "@domain/audit/AuditDomain";
import {
  RunResultAvailabilityStates,
  type RunLifecycleUpdateRequest,
  type RunResultAvailabilityState,
  type RunResultOutputReference,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
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
  readonly resultCollectionPersistencePort?: IRunCollectedResultPersistencePort;
  readonly authoritativeAuditRecorder?: Pick<AuthoritativeAuditRecordingPort, "recordRunsEvent">;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function extractWorkflowTemplateId(sourceAggregateRef: string | undefined): string | undefined {
  const normalized = normalizeOptional(sourceAggregateRef);
  if (!normalized?.startsWith("template:")) {
    return undefined;
  }
  return normalizeOptional(normalized.slice("template:".length));
}

function extractRunSystemId(runRecord: PlatformRunRecord): string | undefined {
  const metadata = isObject(runRecord.metadata) ? runRecord.metadata : undefined;
  const submissionSnapshot = metadata && isObject(metadata.submissionSnapshot)
    ? metadata.submissionSnapshot
    : undefined;
  const runtimeTarget = submissionSnapshot && isObject(submissionSnapshot.runtimeTarget)
    ? submissionSnapshot.runtimeTarget
    : undefined;
  const systemId = runtimeTarget && typeof runtimeTarget.systemId === "string"
    ? runtimeTarget.systemId
    : undefined;
  return normalizeOptional(systemId);
}

export class DefaultRunFinalizationResultRegistrationPort implements IRunFinalizationResultRegistrationPort {
  public async registerFinalizationResult(
    request: RunFinalizationRegistrationRequest,
  ): Promise<RunFinalizationRegistrationResult> {
    const summary = request.result?.summary?.trim()
      || (request.outcome === RunFinalizationOutcomeStatuses.failed
        ? request.safeFailureMessage ?? "Run failed during execution."
        : request.outcome === RunFinalizationOutcomeStatuses.cancelled
          ? "Run cancelled."
          : "Run completed.");
    const outputReferences = normalizeOutputReferences(request.result?.outputs);
    const resultAvailabilityState = request.result?.resultAvailabilityState
      ?? resolveDefaultResultAvailabilityState(request.outcome, outputReferences);
    const outputAvailability = request.result?.outputAvailabilityHint
      ?? resolveOutputAvailabilityHint(request.outcome, outputReferences);
    const terminalQuality = request.result?.terminalQualityHint
      ?? resolveTerminalQualityHint(request.outcome, outputReferences);

    return Object.freeze({
      summary: Object.freeze({
        finalizedAt: request.finalizedAt,
        outcome: request.outcome,
        summary,
        outputs: outputReferences,
        metrics: request.result?.metrics,
        externalResultId: normalizeOptional(request.result?.externalResultId),
        resultAvailabilityState,
        outputAvailability,
        terminalQuality,
      }),
      internalDiagnostics: request.outcome === RunFinalizationOutcomeStatuses.failed
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
  private readonly resultCollectionPersistencePort?: IRunCollectedResultPersistencePort;

  public constructor(private readonly dependencies: FinalizeRunExecutionOutcomeUseCaseDependencies) {
    this.resultRegistrationPort = dependencies.resultRegistrationPort ?? new DefaultRunFinalizationResultRegistrationPort();
    this.resultCollectionPersistencePort = dependencies.resultCollectionPersistencePort;
  }

  public async execute(request: FinalizeRunExecutionOutcomeRequest): Promise<FinalizeRunExecutionOutcomeResult> {
    if (
      request.run.state !== RunLifecycleStates.completed
      && request.run.state !== RunLifecycleStates.failed
      && request.run.state !== RunLifecycleStates.cancelled
    ) {
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

    const collectedResult = extractCollectedExecutionResult(request.internalDiagnostics);
    const persistenceOutcome = await this.persistCollectedResultIfAvailable({
      run: runWithQueueHistory,
      runRecord: request.runRecord,
      finalizedAt,
      senderNodeId: request.senderNodeId,
      collectedResult,
      terminalResult: request.lifecycleUpdate?.result,
    });
    await this.appendResultCollectionAuditEvent({
      run: runWithQueueHistory,
      senderNodeId: request.senderNodeId,
      occurredAt: finalizedAt,
      persistenceOutcome,
      collectedResult,
    });
    const normalizedResult = mergeTerminalResultWithPersistence(
      request.lifecycleUpdate?.result,
      persistenceOutcome,
    );

    const finalizationResult = await this.resultRegistrationPort.registerFinalizationResult({
      runId: runWithQueueHistory.identity.runId,
      workflowId: runWithQueueHistory.identity.workflowId,
      workspaceId: runWithQueueHistory.identity.workspaceId,
      finalizedAt,
      outcome: resolveFinalizationOutcomeStatus(runWithQueueHistory.state),
      result: normalizedResult,
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
      resultPersistenceDiagnostics: persistenceOutcome?.internalDiagnostics,
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
          : run.state === RunLifecycleStates.failed
            ? "execution-failed"
            : "execution-cancelled",
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
    readonly resultPersistenceDiagnostics?: Readonly<Record<string, unknown>>;
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

    if (input.internalDiagnostics || input.registrationDiagnostics || input.resultPersistenceDiagnostics) {
      const executionTelemetry = isObject(metadata.executionTelemetry)
        ? { ...(metadata.executionTelemetry as Record<string, unknown>) }
        : {};
      executionTelemetry.finalizationInternal = Object.freeze({
        finalizedAt: input.finalizedAt,
        senderNodeId: normalizeOptional(input.senderNodeId),
        diagnostics: input.internalDiagnostics,
        registrationDiagnostics: input.registrationDiagnostics,
        resultPersistenceDiagnostics: input.resultPersistenceDiagnostics,
      });
      metadata.executionTelemetry = Object.freeze(executionTelemetry);
    }

    return updatePlatformRunRecordCanonicalState(Object.freeze({
      ...input.record,
      metadata: Object.freeze(metadata),
    }), input.run);
  }

  private async persistCollectedResultIfAvailable(input: {
    readonly run: CanonicalRunRecord;
    readonly runRecord: PlatformRunRecord;
    readonly finalizedAt: string;
    readonly senderNodeId?: string;
    readonly collectedResult?: ImageManipulationCollectedExecutionResult;
    readonly terminalResult?: RunLifecycleUpdateRequest["result"];
  }): Promise<RunCollectedResultPersistenceResult | undefined> {
    if (!input.collectedResult || !this.resultCollectionPersistencePort) {
      return undefined;
    }

    try {
      return await this.resultCollectionPersistencePort.persistCollectedResult({
        runId: input.run.identity.runId,
        workflowId: input.run.identity.workflowId,
        systemId: extractRunSystemId(input.runRecord),
        workflowTemplateId: extractWorkflowTemplateId(input.runRecord.sourceAggregateRef),
        executionNodeId: normalizeOptional(input.senderNodeId) ?? normalizeOptional(input.run.assignment.assignedNodeId),
        executionAdapterKind: normalizeOptional(input.run.execution.adapterKind),
        workspaceId: input.run.identity.workspaceId,
        occurredAt: input.finalizedAt,
        actorId: normalizeOptional(input.senderNodeId) ?? "system:run-finalization",
        collectedResult: input.collectedResult,
        terminalResult: input.terminalResult,
        operationKey: `run:result-persistence:${input.run.identity.runId}:${input.finalizedAt}`,
      });
    } catch (error) {
      return Object.freeze({
        status: RunCollectedResultPersistenceStatuses.failed,
        outputs: Object.freeze([]),
        outputAvailabilityHint: "degraded",
        terminalQualityHint: "degraded",
        internalDiagnostics: Object.freeze({
          status: RunCollectedResultPersistenceStatuses.failed,
          reasonCode: "result-persistence-port-failed",
          message: error instanceof Error ? error.message : "Result persistence port failed.",
        }),
      });
    }
  }

  private async appendResultCollectionAuditEvent(input: {
    readonly run: CanonicalRunRecord;
    readonly senderNodeId?: string;
    readonly occurredAt: string;
    readonly persistenceOutcome: RunCollectedResultPersistenceResult | undefined;
    readonly collectedResult: ImageManipulationCollectedExecutionResult | undefined;
  }): Promise<void> {
    if (!this.dependencies.authoritativeAuditRecorder || !input.persistenceOutcome) {
      return;
    }

    const status = input.persistenceOutcome.status;
    if (
      status !== RunCollectedResultPersistenceStatuses.failed
      && status !== RunCollectedResultPersistenceStatuses.partiallyPersisted
    ) {
      return;
    }

    const actorId = normalizeOptional(input.senderNodeId) ?? "system:run-finalization";
    const eventType = status === RunCollectedResultPersistenceStatuses.failed
      ? "run-result-collection-failed"
      : "run-result-collection-degraded";
    const action = status === RunCollectedResultPersistenceStatuses.failed
      ? "run.result.collection.failed"
      : "run.result.collection.degraded";
    const issueCategory = status === RunCollectedResultPersistenceStatuses.failed
      ? "result-collection-failure"
      : "result-collection-degraded";
    const diagnostics = asStringRecord(input.persistenceOutcome.internalDiagnostics);

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:result-collection:${input.run.identity.runId}:${input.occurredAt}:${status}`,
        eventType,
        action,
        outcome: status === RunCollectedResultPersistenceStatuses.failed
          ? AuditEventOutcomes.failed
          : AuditEventOutcomes.rejected,
        occurredAt: input.occurredAt,
        actor: Object.freeze({
          actorId,
          actorKind: actorId.startsWith("user:")
            ? AuditActorKinds.user
            : AuditActorKinds.service,
          actorUserIdentityId: actorId.startsWith("user:") ? actorId : undefined,
          actorServiceId: actorId.startsWith("user:") ? undefined : actorId,
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
        payload: Object.freeze({
          userSafeDetails: Object.freeze({
            issueCategory,
            persistenceStatus: status,
            collectedOutputCount: input.collectedResult?.summary?.collectedCount ?? 0,
            persistedOutputCount: input.persistenceOutcome.outputs.length,
            outputAvailabilityHint: input.persistenceOutcome.outputAvailabilityHint,
            terminalQualityHint: input.persistenceOutcome.terminalQualityHint,
            reasonCode: diagnostics?.reasonCode,
          }),
          adminOnlyDetails: Object.freeze({
            diagnosticsCode: diagnostics?.code,
            diagnosticsStatus: diagnostics?.status,
            diagnosticsMessage: diagnostics?.message,
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail finalization behavior.
    }
  }
}

function asStringRecord(
  value: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!value) {
    return undefined;
  }
  const output: Record<string, string> = {};
  const keys: ReadonlyArray<"code" | "reasonCode" | "status" | "message"> = Object.freeze([
    "code",
    "reasonCode",
    "status",
    "message",
  ]);
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      output[key] = candidate.trim().slice(0, 160);
    }
  }
  return Object.keys(output).length > 0 ? Object.freeze(output) : undefined;
}

function normalizeOutputReferences(
  value: ReadonlyArray<RunResultOutputReference> | undefined,
): ReadonlyArray<RunResultOutputReference> {
  if (!value || value.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(value.map((entry) => Object.freeze({ ...entry })));
}

function extractCollectedExecutionResult(
  internalDiagnostics?: Readonly<Record<string, unknown>>,
): ImageManipulationCollectedExecutionResult | undefined {
  if (!isObject(internalDiagnostics)) {
    return undefined;
  }

  const directCandidates: ReadonlyArray<unknown> = Object.freeze([
    internalDiagnostics.imageManipulationCollectedExecutionResult,
    internalDiagnostics.collectedExecutionResult,
    internalDiagnostics.outputCollection,
    internalDiagnostics.resultCollection,
  ]);
  for (const candidate of directCandidates) {
    const parsed = parseImageManipulationCollectedExecutionResult(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const imageManipulation = isObject(internalDiagnostics.imageManipulation)
    ? internalDiagnostics.imageManipulation
    : undefined;
  if (!imageManipulation) {
    return undefined;
  }

  return parseImageManipulationCollectedExecutionResult(imageManipulation.collectedExecutionResult)
    ?? parseImageManipulationCollectedExecutionResult(imageManipulation.outputCollection)
    ?? undefined;
}

function mergeTerminalResultWithPersistence(
  result: RunLifecycleUpdateRequest["result"] | undefined,
  persistence: RunCollectedResultPersistenceResult | undefined,
): RunLifecycleUpdateRequest["result"] | undefined {
  if (!persistence) {
    return result;
  }

  const mergedOutputs = mergeOutputReferences(result?.outputs, persistence.outputs);
  return Object.freeze({
    ...(result ?? {}),
    outputs: mergedOutputs,
    resultAvailabilityState: result?.resultAvailabilityState
      ?? deriveResultAvailabilityStateFromPersistence(persistence, mergedOutputs.length),
    outputAvailabilityHint: result?.outputAvailabilityHint
      ?? persistence.outputAvailabilityHint
      ?? deriveOutputAvailabilityFromPersistence(persistence, mergedOutputs.length),
    terminalQualityHint: result?.terminalQualityHint
      ?? persistence.terminalQualityHint
      ?? deriveTerminalQualityFromPersistence(persistence, mergedOutputs.length),
  });
}

function deriveResultAvailabilityStateFromPersistence(
  persistence: RunCollectedResultPersistenceResult,
  outputCount: number,
): RunResultAvailabilityState {
  if (persistence.status === RunCollectedResultPersistenceStatuses.failed) {
    return RunResultAvailabilityStates.failedCollection;
  }
  if (persistence.status === RunCollectedResultPersistenceStatuses.partiallyPersisted) {
    return RunResultAvailabilityStates.partiallyCollected;
  }
  if (persistence.status === RunCollectedResultPersistenceStatuses.persisted) {
    const previewPendingCount = readDiagnosticCount(persistence.internalDiagnostics, "previewPendingCount");
    if (previewPendingCount > 0) {
      return RunResultAvailabilityStates.previewPending;
    }
    return outputCount > 0
      ? RunResultAvailabilityStates.available
      : RunResultAvailabilityStates.pendingResult;
  }
  return outputCount > 0
    ? RunResultAvailabilityStates.available
    : RunResultAvailabilityStates.pendingResult;
}

function readDiagnosticCount(
  diagnostics: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number {
  const value = diagnostics?.[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function mergeOutputReferences(
  existing: ReadonlyArray<RunResultOutputReference> | undefined,
  persisted: ReadonlyArray<RunResultOutputReference>,
): ReadonlyArray<RunResultOutputReference> {
  if ((!existing || existing.length === 0) && persisted.length === 0) {
    return Object.freeze([]);
  }

  const outputById = new Map<string, RunResultOutputReference>();
  for (const output of existing ?? []) {
    outputById.set(output.outputId, Object.freeze({ ...output }));
  }
  for (const output of persisted) {
    outputById.set(output.outputId, Object.freeze({ ...output }));
  }
  return Object.freeze([...outputById.values()]);
}

function deriveOutputAvailabilityFromPersistence(
  persistence: RunCollectedResultPersistenceResult,
  outputCount: number,
): "none" | "partial" | "available" | "degraded" {
  if (persistence.status === RunCollectedResultPersistenceStatuses.failed) {
    return outputCount > 0 ? "partial" : "degraded";
  }
  if (persistence.status === RunCollectedResultPersistenceStatuses.partiallyPersisted) {
    return outputCount > 0 ? "partial" : "degraded";
  }
  if (persistence.status === RunCollectedResultPersistenceStatuses.persisted) {
    return outputCount > 0 ? "available" : "none";
  }
  return outputCount > 0 ? "partial" : "none";
}

function deriveTerminalQualityFromPersistence(
  persistence: RunCollectedResultPersistenceResult,
  outputCount: number,
): "standard" | "partial" | "degraded" {
  if (persistence.status === RunCollectedResultPersistenceStatuses.failed) {
    return "degraded";
  }
  if (persistence.status === RunCollectedResultPersistenceStatuses.partiallyPersisted) {
    return outputCount > 0 ? "partial" : "degraded";
  }
  return outputCount > 0 ? "standard" : "degraded";
}

function resolveFinalizationOutcomeStatus(
  state: CanonicalRunRecord["state"],
): typeof RunFinalizationOutcomeStatuses[keyof typeof RunFinalizationOutcomeStatuses] {
  if (state === RunLifecycleStates.completed) {
    return RunFinalizationOutcomeStatuses.completed;
  }
  if (state === RunLifecycleStates.cancelled) {
    return RunFinalizationOutcomeStatuses.cancelled;
  }
  return RunFinalizationOutcomeStatuses.failed;
}

function resolveOutputAvailabilityHint(
  outcome: RunFinalizationRegistrationRequest["outcome"],
  outputs: ReadonlyArray<RunResultOutputReference>,
): "none" | "partial" | "available" | "degraded" {
  if (outputs.length === 0) {
    return "none";
  }
  if (outcome === RunFinalizationOutcomeStatuses.completed) {
    return "available";
  }
  if (outcome === RunFinalizationOutcomeStatuses.failed) {
    return "partial";
  }
  return "partial";
}

function resolveDefaultResultAvailabilityState(
  _outcome: RunFinalizationRegistrationRequest["outcome"],
  outputs: ReadonlyArray<RunResultOutputReference>,
): RunResultAvailabilityState {
  return outputs.length > 0
    ? RunResultAvailabilityStates.available
    : RunResultAvailabilityStates.pendingResult;
}

function resolveTerminalQualityHint(
  outcome: RunFinalizationRegistrationRequest["outcome"],
  outputs: ReadonlyArray<RunResultOutputReference>,
): "standard" | "partial" | "degraded" {
  if (outcome === RunFinalizationOutcomeStatuses.completed) {
    return "standard";
  }
  return outputs.length > 0 ? "partial" : "standard";
}
