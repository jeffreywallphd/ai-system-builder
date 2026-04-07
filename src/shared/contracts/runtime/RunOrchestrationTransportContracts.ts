import type { SharedApiMutationResult, SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  type CanonicalRunRecord,
  type RunAssignmentState,
  type RunCancellationState,
  type RunExecutionState,
  type RunLifecycleState,
  type RunQueueState,
  type RunRetryState,
  type RunSubmissionSource,
} from "@domain/runs/RunDomain";

export const RunOrchestrationTransportContractVersions = Object.freeze({
  v1: "run-orchestration-transport/v1",
} as const);

export type RunOrchestrationTransportContractVersion =
  typeof RunOrchestrationTransportContractVersions[keyof typeof RunOrchestrationTransportContractVersions];

export const RunOrchestrationTransportRoutes = Object.freeze({
  submitRun: "/api/v1/runtime/runs/start",
  listRuns: "/api/v1/runtime/runs",
  getRunDetail: "/api/v1/runtime/runs/:runId",
  getRunStatus: "/api/v1/runtime/runs/:runId/status",
  cancelRun: "/api/v1/runtime/runs/:runId/cancel",
  retryRun: "/api/v1/runtime/runs/:runId/retry",
  listQueueStatus: "/api/v1/runtime/queue",
  updateLifecycle: "/api/v1/runtime/runs/:runId/lifecycle",
} as const);

export const RunMutationActions = Object.freeze({
  cancel: "cancel",
  retry: "retry",
  lifecycleUpdate: "lifecycle-update",
} as const);

export type RunMutationAction = typeof RunMutationActions[keyof typeof RunMutationActions];

export const RunLifecycleEventKinds = Object.freeze({
  runSubmitted: "run-submitted",
  runStateChanged: "run-state-changed",
  runCancelled: "run-cancelled",
  runRetryQueued: "run-retry-queued",
} as const);

export type RunLifecycleEventKind = typeof RunLifecycleEventKinds[keyof typeof RunLifecycleEventKinds];

export interface RunSubmissionRuntimeTarget {
  readonly systemId: string;
  readonly versionId: string;
  readonly executionId?: string;
  readonly tenantId?: string;
  readonly async?: boolean;
}

export interface RunSubmissionRequest {
  readonly workflowId?: string;
  readonly workspaceId?: string;
  readonly source?: RunSubmissionSource;
  readonly submittedByActorId?: string;
  readonly clientRequestId?: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly runtimeTarget: RunSubmissionRuntimeTarget;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RunSubmissionValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface RunQueueStatusSnapshot {
  readonly queueId: string;
  readonly enteredAt: string;
  readonly position: number | null;
  readonly positionAsOf: string;
  readonly dequeuedAt?: string;
}

export interface RunSummary {
  readonly contractVersion: RunOrchestrationTransportContractVersion;
  readonly runId: string;
  readonly workflowId: string;
  readonly workspaceId?: string;
  readonly source: RunSubmissionSource;
  readonly state: RunLifecycleState;
  readonly assignmentStatus: typeof RunAssignmentStatuses[keyof typeof RunAssignmentStatuses];
  readonly executionOutcome: typeof RunExecutionOutcomeKinds[keyof typeof RunExecutionOutcomeKinds];
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly queue?: RunQueueStatusSnapshot;
}

export interface RunDetail extends RunSummary {
  readonly submission: {
    readonly submittedByActorId?: string;
    readonly clientRequestId?: string;
    readonly correlationId?: string;
  };
  readonly assignment: RunAssignmentState;
  readonly execution: RunExecutionState;
  readonly cancellation?: RunCancellationState;
  readonly retry: RunRetryState;
  readonly finalization?: RunResultSummary & {
    readonly finalizedAt: string;
    readonly outcome: "completed" | "failed";
  };
}

export interface RunSubmissionAcceptedResponse {
  readonly run: RunDetail;
  readonly mutation: SharedApiMutationResult;
  readonly validationIssues?: ReadonlyArray<RunSubmissionValidationIssue>;
}

export interface RunDetailReadRequest {
  readonly runId: string;
  readonly workspaceId?: string;
}

export interface RunListReadRequest {
  readonly workspaceId: string;
  readonly states?: ReadonlyArray<RunLifecycleState>;
  readonly sources?: ReadonlyArray<RunSubmissionSource>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: "submittedAt" | "updatedAt" | "state";
  readonly sortDirection?: "asc" | "desc";
}

export interface RunListReadResponse {
  readonly items: ReadonlyArray<RunSummary>;
  readonly totalCount: number;
}

export interface RunStatusReadRequest {
  readonly runId: string;
  readonly workspaceId?: string;
}

export interface RunStatusEnvelope {
  readonly runId: string;
  readonly state: RunLifecycleState;
  readonly updatedAt: string;
  readonly queue?: RunQueueStatusSnapshot;
  readonly assignmentStatus: typeof RunAssignmentStatuses[keyof typeof RunAssignmentStatuses];
  readonly executionOutcome: typeof RunExecutionOutcomeKinds[keyof typeof RunExecutionOutcomeKinds];
  readonly execution?: {
    readonly startedAt?: string;
    readonly heartbeatAt?: string;
    readonly finishedAt?: string;
    readonly progress?: RunExecutionProgressSnapshot;
  };
  readonly retry: {
    readonly attempt: number;
    readonly maxAttempts: number;
    readonly queuedAt?: string;
  };
  readonly finalization?: RunDetail["finalization"];
}

export interface RunExecutionProgressSnapshot {
  readonly updatedAt: string;
  readonly percent?: number;
  readonly stage?: string;
  readonly message?: string;
}

export const RunResultOutputReferenceKinds = Object.freeze({
  asset: "asset",
  storageObject: "storage-object",
  url: "url",
  inline: "inline",
} as const);

export type RunResultOutputReferenceKind =
  typeof RunResultOutputReferenceKinds[keyof typeof RunResultOutputReferenceKinds];

export interface RunResultOutputReference {
  readonly outputId: string;
  readonly kind: RunResultOutputReferenceKind;
  readonly label?: string;
  readonly assetId?: string;
  readonly storageInstanceId?: string;
  readonly objectKey?: string;
  readonly objectVersionId?: string;
  readonly uri?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RunResultRegistrationInput {
  readonly summary?: string;
  readonly externalResultId?: string;
  readonly outputs?: ReadonlyArray<RunResultOutputReference>;
  readonly metrics?: Readonly<Record<string, unknown>>;
}

export interface RunResultSummary {
  readonly summary?: string;
  readonly externalResultId?: string;
  readonly outputs: ReadonlyArray<RunResultOutputReference>;
  readonly metrics?: Readonly<Record<string, unknown>>;
}

export interface RunQueueStatusReadRequest {
  readonly workspaceId: string;
  readonly statuses?: ReadonlyArray<RunLifecycleState>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RunQueueStatusItem {
  readonly runId: string;
  readonly workflowId: string;
  readonly workspaceId: string;
  readonly state: RunLifecycleState;
  readonly queue: RunQueueStatusSnapshot;
  readonly assignmentStatus: typeof RunAssignmentStatuses[keyof typeof RunAssignmentStatuses];
  readonly executionOutcome: typeof RunExecutionOutcomeKinds[keyof typeof RunExecutionOutcomeKinds];
  readonly updatedAt: string;
}

export interface RunQueueStatusReadResponse {
  readonly items: ReadonlyArray<RunQueueStatusItem>;
  readonly totalCount: number;
  readonly asOf: string;
}

export interface RunCancellationRequest {
  readonly runId: string;
  readonly reason?: string;
  readonly requestedByActorId?: string;
  readonly requestedAt?: string;
  readonly idempotencyKey?: string;
}

export interface RunRetryRequest {
  readonly runId: string;
  readonly reason?: string;
  readonly requestedByActorId?: string;
  readonly requestedAt?: string;
  readonly idempotencyKey?: string;
}

export interface RunLifecycleUpdateRequest {
  readonly runId: string;
  readonly toState?: RunLifecycleState;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly actorId?: string;
  readonly idempotencyKey?: string;
  readonly senderNodeId?: string;
  readonly senderBackendKind?: string;
  readonly senderBackendRunId?: string;
  readonly heartbeatAt?: string;
  readonly progress?: RunExecutionProgressSnapshot;
  readonly result?: RunResultRegistrationInput;
  readonly internalDiagnostics?: Readonly<Record<string, unknown>>;
  readonly queue?: RunQueueState;
  readonly assignment?: RunAssignmentState;
  readonly execution?: RunExecutionState;
  readonly cancellation?: RunCancellationState;
  readonly retry?: Partial<RunRetryState>;
}

export interface RunMutationResponse {
  readonly action: RunMutationAction;
  readonly run: RunDetail;
  readonly mutation: SharedApiMutationResult;
}

export interface RunLifecycleEventEnvelope {
  readonly eventId: string;
  readonly eventKind: RunLifecycleEventKind;
  readonly occurredAt: string;
  readonly run: RunStatusEnvelope;
}

export interface RunOrchestrationTransportContract {
  readonly submitRun: {
    readonly request: RunSubmissionRequest;
    readonly response: SharedApiResponseEnvelope<RunSubmissionAcceptedResponse>;
  };
  readonly getRunDetail: {
    readonly request: RunDetailReadRequest;
    readonly response: SharedApiResponseEnvelope<RunDetail>;
  };
  readonly listRuns: {
    readonly request: RunListReadRequest;
    readonly response: SharedApiResponseEnvelope<RunListReadResponse>;
  };
  readonly getRunStatus: {
    readonly request: RunStatusReadRequest;
    readonly response: SharedApiResponseEnvelope<RunStatusEnvelope>;
  };
  readonly cancelRun: {
    readonly request: RunCancellationRequest;
    readonly response: SharedApiResponseEnvelope<RunMutationResponse>;
  };
  readonly retryRun: {
    readonly request: RunRetryRequest;
    readonly response: SharedApiResponseEnvelope<RunMutationResponse>;
  };
  readonly listQueueStatus: {
    readonly request: RunQueueStatusReadRequest;
    readonly response: SharedApiResponseEnvelope<RunQueueStatusReadResponse>;
  };
  readonly updateLifecycle: {
    readonly request: RunLifecycleUpdateRequest;
    readonly response: SharedApiResponseEnvelope<RunMutationResponse>;
  };
}

export function toRunQueueStatusSnapshot(queue: RunQueueState | undefined): RunQueueStatusSnapshot | undefined {
  if (!queue) {
    return undefined;
  }

  return Object.freeze({
    queueId: queue.queueId,
    enteredAt: queue.enteredAt,
    position: queue.position,
    positionAsOf: queue.positionAsOf,
    dequeuedAt: queue.dequeuedAt,
  });
}

export function toRunSummary(run: CanonicalRunRecord): RunSummary {
  return Object.freeze({
    contractVersion: RunOrchestrationTransportContractVersions.v1,
    runId: run.identity.runId,
    workflowId: run.identity.workflowId,
    workspaceId: run.identity.workspaceId,
    source: run.submission.source,
    state: run.state,
    assignmentStatus: run.assignment.status,
    executionOutcome: run.execution.outcome,
    submittedAt: run.submission.submittedAt,
    updatedAt: run.updatedAt,
    queue: toRunQueueStatusSnapshot(run.queue),
  });
}

export function toRunDetail(run: CanonicalRunRecord): RunDetail {
  return Object.freeze({
    ...toRunSummary(run),
    submission: Object.freeze({
      submittedByActorId: run.submission.submittedByActorId,
      clientRequestId: run.submission.clientRequestId,
      correlationId: run.submission.correlationId,
    }),
    assignment: run.assignment,
    execution: run.execution,
    cancellation: run.cancellation,
    retry: run.retry,
  });
}

export function toRunStatusEnvelope(run: CanonicalRunRecord): RunStatusEnvelope {
  return Object.freeze({
    runId: run.identity.runId,
    state: run.state,
    updatedAt: run.updatedAt,
    queue: toRunQueueStatusSnapshot(run.queue),
    assignmentStatus: run.assignment.status,
    executionOutcome: run.execution.outcome,
    execution: Object.freeze({
      startedAt: run.execution.startedAt,
      heartbeatAt: run.execution.heartbeatAt,
      finishedAt: run.execution.finishedAt,
      progress: run.execution.progress
        ? Object.freeze({
          updatedAt: run.execution.progress.updatedAt,
          percent: run.execution.progress.percent,
          stage: run.execution.progress.stage,
          message: run.execution.progress.message,
        })
        : undefined,
    }),
    retry: Object.freeze({
      attempt: run.retry.attempt,
      maxAttempts: run.retry.maxAttempts,
      queuedAt: run.retry.queuedAt,
    }),
  });
}

export function resolveRunSubmissionSource(source: string | undefined): RunSubmissionSource {
  const normalized = source?.trim();
  const fallback = RunSubmissionSources.uiManual;
  if (!normalized) {
    return fallback;
  }

  const allowed = Object.values(RunSubmissionSources);
  return allowed.includes(normalized as RunSubmissionSource)
    ? normalized as RunSubmissionSource
    : fallback;
}

export function resolveRunLifecycleState(state: string | undefined): RunLifecycleState | undefined {
  const normalized = state?.trim();
  if (!normalized) {
    return undefined;
  }

  return Object.values(RunLifecycleStates).includes(normalized as RunLifecycleState)
    ? normalized as RunLifecycleState
    : undefined;
}
