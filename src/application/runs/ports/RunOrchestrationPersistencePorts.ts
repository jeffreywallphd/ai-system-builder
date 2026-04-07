import type {
  PlatformAuditEventRecord,
  PlatformRunListQuery,
  PlatformPersistenceMutationContext,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { RunExecutionBackendKind } from "@application/runs/ports/RunExecutionDispatchPorts";
import type { RunLifecycleState } from "@domain/runs/RunDomain";
import type { RunResultRegistrationInput, RunResultSummary } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

export type AuthoritativeRunPersistenceMutationContext = PlatformPersistenceMutationContext;

export interface IAuthoritativeRunPersistenceRepository {
  findRunById(runId: string): Promise<PlatformRunRecord | undefined>;
  listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>>;
  createRun(
    record: PlatformRunRecord,
    mutation: AuthoritativeRunPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult>;
  saveRun(
    record: PlatformRunRecord,
    mutation: AuthoritativeRunPersistenceMutationContext & {
      readonly expectedRevision?: number;
    },
  ): Promise<PlatformRunMutationResult>;
}

export interface IRunOrchestrationIntentRepository {
  appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    mutation: AuthoritativeRunPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }>;
}

export const RunQueueEligibilityMarkers = Object.freeze({
  ready: "ready",
  deferred: "deferred",
  blocked: "blocked",
});

export type RunQueueEligibilityMarker =
  typeof RunQueueEligibilityMarkers[keyof typeof RunQueueEligibilityMarkers];

export interface AuthoritativeRunQueueEntryRecord {
  readonly runId: string;
  readonly queueId: string;
  readonly workspaceId?: string;
  readonly lifecycleState: RunLifecycleState;
  readonly enteredAt: string;
  readonly orderKey: string;
  readonly eligibilityMarker: RunQueueEligibilityMarker;
  readonly eligibleAt: string;
  readonly claimToken?: string;
  readonly claimedBy?: string;
  readonly claimedAt?: string;
  readonly claimExpiresAt?: string;
  readonly assignmentNodeId?: string;
  readonly assignmentClaimedAt?: string;
  readonly dispatchPreparedAt?: string;
  readonly lastDispatchAttemptId?: string;
  readonly dequeuedAt?: string;
  readonly updatedAt: string;
  readonly revision: number;
}

export interface AuthoritativeRunQueueMutationResult {
  readonly changed: boolean;
  readonly record: AuthoritativeRunQueueEntryRecord;
}

export const RunNodeClaimConflictReasons = Object.freeze({
  notFound: "not-found",
  alreadyAssigned: "already-assigned",
  queueStateConflict: "queue-state-conflict",
  reservationConflict: "reservation-conflict",
});

export type RunNodeClaimConflictReason =
  typeof RunNodeClaimConflictReasons[keyof typeof RunNodeClaimConflictReasons];

export interface AuthoritativeRunNodeClaimConflict {
  readonly reason: RunNodeClaimConflictReason;
  readonly runId: string;
  readonly nodeId: string;
  readonly message: string;
  readonly currentEntry?: AuthoritativeRunQueueEntryRecord;
}

export interface AuthoritativeRunDispatchAttemptRecord {
  readonly attemptId: string;
  readonly runId: string;
  readonly queueId: string;
  readonly workspaceId?: string;
  readonly nodeId: string;
  readonly reservationOwner: string;
  readonly claimToken: string;
  readonly preparedAt: string;
  readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  readonly dispatchResult?: AuthoritativeRunDispatchAttemptResult;
}

export const RunDispatchAttemptResultStatuses = Object.freeze({
  accepted: "accepted",
  failedToStart: "failed-to-start",
});

export type RunDispatchAttemptResultStatus =
  typeof RunDispatchAttemptResultStatuses[keyof typeof RunDispatchAttemptResultStatuses];

export interface AuthoritativeRunDispatchAttemptFailure {
  readonly safeCode: string;
  readonly safeMessage: string;
  readonly internalCode?: string;
  readonly internalMessage?: string;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AuthoritativeRunDispatchAttemptResult {
  readonly status: RunDispatchAttemptResultStatus;
  readonly recordedAt: string;
  readonly acceptedAt?: string;
  readonly dispatchId?: string;
  readonly backendKind?: RunExecutionBackendKind;
  readonly backendRunId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly failure?: AuthoritativeRunDispatchAttemptFailure;
}

export interface AuthoritativeRunNodeClaimSuccess {
  readonly outcome: "claimed";
  readonly queueEntry: AuthoritativeRunQueueEntryRecord;
  readonly dispatchAttempt: AuthoritativeRunDispatchAttemptRecord;
}

export interface AuthoritativeRunNodeClaimConflictResult {
  readonly outcome: "conflict";
  readonly conflict: AuthoritativeRunNodeClaimConflict;
}

export type AuthoritativeRunNodeClaimResult =
  | AuthoritativeRunNodeClaimSuccess
  | AuthoritativeRunNodeClaimConflictResult;

export interface IRunOrchestrationQueuePersistenceRepository {
  getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined>;
  listQueueEntries?(query: {
    readonly workspaceId?: string;
    readonly queueId?: string;
    readonly lifecycleStates?: ReadonlyArray<RunLifecycleState>;
    readonly includeDequeued?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>>;
  enqueueRunForAssignment(
    record: Omit<
      AuthoritativeRunQueueEntryRecord,
      "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision"
    >,
    mutation: AuthoritativeRunPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult>;
  listAssignmentReadyRuns(query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>>;
  claimAssignmentReadyRuns(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>>;
  releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean>;
  claimQueuedRunForNodeDispatch(input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult>;
  recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean>;
  finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean>;
  listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>>;
}

export const RunFinalizationOutcomeStatuses = Object.freeze({
  completed: "completed",
  failed: "failed",
});

export type RunFinalizationOutcomeStatus =
  typeof RunFinalizationOutcomeStatuses[keyof typeof RunFinalizationOutcomeStatuses];

export interface AuthoritativeRunFinalizationRecord extends RunResultSummary {
  readonly finalizedAt: string;
  readonly outcome: RunFinalizationOutcomeStatus;
}

export interface RunFinalizationRegistrationRequest {
  readonly runId: string;
  readonly workflowId: string;
  readonly workspaceId?: string;
  readonly finalizedAt: string;
  readonly outcome: RunFinalizationOutcomeStatus;
  readonly result?: RunResultRegistrationInput;
  readonly safeFailureCode?: string;
  readonly safeFailureMessage?: string;
}

export interface RunFinalizationRegistrationResult {
  readonly summary: AuthoritativeRunFinalizationRecord;
  readonly internalDiagnostics?: Readonly<Record<string, unknown>>;
}

export interface IRunFinalizationResultRegistrationPort {
  registerFinalizationResult(request: RunFinalizationRegistrationRequest): Promise<RunFinalizationRegistrationResult>;
}

