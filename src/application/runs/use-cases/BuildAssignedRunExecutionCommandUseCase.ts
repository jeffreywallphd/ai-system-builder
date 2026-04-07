import type { IAuthoritativeRunPersistenceRepository, IRunOrchestrationQueuePersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionBackendKinds,
  type CanonicalRunExecutionCommand,
  type RunExecutionBackendKind,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import { RunLifecycleStates } from "@domain/runs/RunDomain";
import { mapPlatformRunRecordToCanonicalRun, type RunAuthoritativeMetadata } from "./RunCreationPersistenceMapper";

export const RunExecutionCommandBuildErrorCodes = Object.freeze({
  runNotFound: "run-not-found",
  invalidRunState: "invalid-run-state",
  missingAssignment: "missing-assignment",
  queueEntryMissing: "queue-entry-missing",
  missingSubmissionSnapshot: "missing-submission-snapshot",
  dispatchAttemptNotFound: "dispatch-attempt-not-found",
  assignmentMismatch: "assignment-mismatch",
});

export type RunExecutionCommandBuildErrorCode =
  typeof RunExecutionCommandBuildErrorCodes[keyof typeof RunExecutionCommandBuildErrorCodes];

export class RunExecutionCommandBuildError extends Error {
  public readonly code: RunExecutionCommandBuildErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: RunExecutionCommandBuildErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "RunExecutionCommandBuildError";
    this.code = code;
    this.details = details;
  }
}

export interface BuildAssignedRunExecutionCommandRequest {
  readonly runId: string;
  readonly dispatchAttemptId?: string;
}

interface BuildAssignedRunExecutionCommandUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
}

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveRunMetadata(metadata: unknown): RunAuthoritativeMetadata | undefined {
  if (!isObject(metadata)) {
    return undefined;
  }
  if (!("submissionSnapshot" in metadata)) {
    return undefined;
  }
  return metadata as RunAuthoritativeMetadata;
}

function resolveBackendKind(systemId: string, asyncExecution: boolean): RunExecutionBackendKind {
  const normalizedSystemId = systemId.trim().toLowerCase();
  if (
    normalizedSystemId === RunExecutionBackendKinds.comfyUi
    || normalizedSystemId.startsWith("comfyui:")
    || normalizedSystemId.startsWith("comfy:")
  ) {
    return RunExecutionBackendKinds.comfyUi;
  }
  return asyncExecution
    ? RunExecutionBackendKinds.remoteDispatch
    : RunExecutionBackendKinds.localWorker;
}

export class BuildAssignedRunExecutionCommandUseCase {
  public constructor(private readonly dependencies: BuildAssignedRunExecutionCommandUseCaseDependencies) {}

  public async execute(
    request: BuildAssignedRunExecutionCommandRequest,
  ): Promise<CanonicalRunExecutionCommand> {
    const runId = normalizeRequired(request.runId, "runId");
    const dispatchAttemptId = request.dispatchAttemptId?.trim();

    const persistedRun = await this.dependencies.runRepository.findRunById(runId);
    if (!persistedRun) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.runNotFound,
        `Run '${runId}' was not found.`,
      );
    }

    const canonicalRun = mapPlatformRunRecordToCanonicalRun(persistedRun);
    if (canonicalRun.state !== RunLifecycleStates.assigned) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.invalidRunState,
        `Run '${runId}' must be in state '${RunLifecycleStates.assigned}' to build an execution command.`,
        Object.freeze({
          state: canonicalRun.state,
        }),
      );
    }
    if (canonicalRun.assignment.status !== "assigned" || !canonicalRun.assignment.assignedNodeId) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.missingAssignment,
        `Run '${runId}' does not include required assignment metadata.`,
      );
    }

    const queueEntry = await this.dependencies.queueRepository.getQueueEntryByRunId(runId);
    if (!queueEntry?.queueId) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.queueEntryMissing,
        `Run '${runId}' is missing queue orchestration metadata.`,
      );
    }

    const attempts = await this.dependencies.queueRepository.listDispatchAttemptsByRunId(runId);
    const dispatchAttempt = dispatchAttemptId
      ? attempts.find((attempt) => attempt.attemptId === dispatchAttemptId)
      : attempts[0];
    if (!dispatchAttempt) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.dispatchAttemptNotFound,
        `Run '${runId}' dispatch attempt '${dispatchAttemptId ?? "<latest>"}' was not found.`,
      );
    }
    if (dispatchAttempt.nodeId !== canonicalRun.assignment.assignedNodeId) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.assignmentMismatch,
        `Dispatch attempt '${dispatchAttempt.attemptId}' node assignment does not match canonical run assignment.`,
        Object.freeze({
          attemptNodeId: dispatchAttempt.nodeId,
          assignedNodeId: canonicalRun.assignment.assignedNodeId,
        }),
      );
    }

    const runMetadata = resolveRunMetadata(persistedRun.metadata);
    const submissionSnapshot = runMetadata?.submissionSnapshot;
    if (!submissionSnapshot) {
      throw new RunExecutionCommandBuildError(
        RunExecutionCommandBuildErrorCodes.missingSubmissionSnapshot,
        `Run '${runId}' is missing authoritative submission snapshot metadata.`,
      );
    }

    const backendKind = resolveBackendKind(
      submissionSnapshot.runtimeTarget.systemId,
      submissionSnapshot.runtimeTarget.async !== false,
    );

    return Object.freeze({
      commandId: `run-execution-command:${dispatchAttempt.attemptId}`,
      dispatchAttemptId: dispatchAttempt.attemptId,
      preparedAt: dispatchAttempt.preparedAt,
      run: Object.freeze({
        runId: canonicalRun.identity.runId,
        workflowId: canonicalRun.identity.workflowId,
        workspaceId: canonicalRun.identity.workspaceId,
        submittedAt: canonicalRun.submission.submittedAt,
        source: canonicalRun.submission.source,
        submittedByActorId: canonicalRun.submission.submittedByActorId,
        correlationId: canonicalRun.submission.correlationId,
      }),
      queue: Object.freeze({
        queueId: queueEntry.queueId,
      }),
      assignment: Object.freeze({
        nodeId: dispatchAttempt.nodeId,
        reservationOwner: dispatchAttempt.reservationOwner,
        claimToken: dispatchAttempt.claimToken,
      }),
      runtimeTarget: Object.freeze({
        systemId: submissionSnapshot.runtimeTarget.systemId,
        versionId: submissionSnapshot.runtimeTarget.versionId,
        executionId: submissionSnapshot.runtimeTarget.executionId,
        tenantId: submissionSnapshot.runtimeTarget.tenantId,
        async: submissionSnapshot.runtimeTarget.async !== false,
      }),
      backend: Object.freeze({
        kind: backendKind,
      }),
      inputs: Object.freeze({
        tags: submissionSnapshot.tags,
        parameters: submissionSnapshot.parameters,
        metadata: submissionSnapshot.metadata,
      }),
      references: Object.freeze({
        storageReferences: submissionSnapshot.storageReferences,
        resourceReferences: submissionSnapshot.resourceReferences,
        policyPrerequisites: submissionSnapshot.policyPrerequisites,
      }),
    });
  }
}

