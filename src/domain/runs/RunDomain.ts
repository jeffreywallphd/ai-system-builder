export const RunSubmissionSources = Object.freeze({
  uiManual: "ui-manual",
  uiRerun: "ui-rerun",
  api: "api",
  scheduleTrigger: "schedule-trigger",
  eventTrigger: "event-trigger",
  internalOrchestrator: "internal-orchestrator",
});

export type RunSubmissionSource = typeof RunSubmissionSources[keyof typeof RunSubmissionSources];

export const RunLifecycleStates = Object.freeze({
  submitted: "submitted",
  queued: "queued",
  assignmentPending: "assignment-pending",
  assigned: "assigned",
  dispatching: "dispatching",
  running: "running",
  cancelling: "cancelling",
  retryPending: "retry-pending",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type RunLifecycleState = typeof RunLifecycleStates[keyof typeof RunLifecycleStates];

export const RunAssignmentStatuses = Object.freeze({
  unassigned: "unassigned",
  pending: "pending",
  assigned: "assigned",
  released: "released",
});

export type RunAssignmentStatus = typeof RunAssignmentStatuses[keyof typeof RunAssignmentStatuses];

export const RunExecutionOutcomeKinds = Object.freeze({
  none: "none",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
});

export type RunExecutionOutcomeKind = typeof RunExecutionOutcomeKinds[keyof typeof RunExecutionOutcomeKinds];

export interface RunIdentity {
  readonly runId: string;
  readonly workflowId: string;
  readonly workspaceId?: string;
}

export interface RunSubmissionContext {
  readonly source: RunSubmissionSource;
  readonly submittedAt: string;
  readonly submittedByActorId?: string;
  readonly clientRequestId?: string;
  readonly correlationId?: string;
}

export interface RunQueueState {
  readonly queueId: string;
  readonly enteredAt: string;
  readonly position: number | null;
  readonly positionAsOf: string;
  readonly dequeuedAt?: string;
}

export interface RunAssignmentState {
  readonly status: RunAssignmentStatus;
  readonly candidateNodeId?: string;
  readonly assignedNodeId?: string;
  readonly assignedAt?: string;
  readonly releasedAt?: string;
  readonly releaseReason?: string;
}

export interface RunExecutionState {
  readonly adapterKind?: string;
  readonly adapterRunId?: string;
  readonly startedAt?: string;
  readonly heartbeatAt?: string;
  readonly finishedAt?: string;
  readonly outcome: RunExecutionOutcomeKind;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface RunCancellationState {
  readonly requestedAt: string;
  readonly requestedByActorId?: string;
  readonly reason?: string;
  readonly acknowledgedAt?: string;
}

export interface RunRetryState {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly previousRunId?: string;
  readonly retryReason?: string;
  readonly queuedAt?: string;
}

export interface CanonicalRunRecord {
  readonly identity: RunIdentity;
  readonly submission: RunSubmissionContext;
  readonly state: RunLifecycleState;
  readonly queue?: RunQueueState;
  readonly assignment: RunAssignmentState;
  readonly execution: RunExecutionState;
  readonly cancellation?: RunCancellationState;
  readonly retry: RunRetryState;
  readonly updatedAt: string;
}

export class RunDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunDomainError";
  }
}

export class RunLifecycleTransitionError extends RunDomainError {
  constructor(from: RunLifecycleState, to: RunLifecycleState) {
    super(`Run lifecycle cannot transition from '${from}' to '${to}'.`);
    this.name = "RunLifecycleTransitionError";
  }
}

const QueueOwnedStates = new Set<RunLifecycleState>([
  RunLifecycleStates.queued,
  RunLifecycleStates.assignmentPending,
]);

const TerminalStates = new Set<RunLifecycleState>([
  RunLifecycleStates.completed,
  RunLifecycleStates.failed,
  RunLifecycleStates.cancelled,
]);

const stateTransitions = {
  [RunLifecycleStates.submitted]: [
    RunLifecycleStates.queued,
    RunLifecycleStates.cancelled,
  ],
  [RunLifecycleStates.queued]: [
    RunLifecycleStates.assignmentPending,
    RunLifecycleStates.cancelling,
    RunLifecycleStates.cancelled,
  ],
  [RunLifecycleStates.assignmentPending]: [
    RunLifecycleStates.assigned,
    RunLifecycleStates.queued,
    RunLifecycleStates.cancelling,
    RunLifecycleStates.cancelled,
  ],
  [RunLifecycleStates.assigned]: [
    RunLifecycleStates.dispatching,
    RunLifecycleStates.queued,
    RunLifecycleStates.cancelling,
  ],
  [RunLifecycleStates.dispatching]: [
    RunLifecycleStates.running,
    RunLifecycleStates.retryPending,
    RunLifecycleStates.failed,
    RunLifecycleStates.cancelling,
  ],
  [RunLifecycleStates.running]: [
    RunLifecycleStates.completed,
    RunLifecycleStates.failed,
    RunLifecycleStates.cancelling,
  ],
  [RunLifecycleStates.cancelling]: [
    RunLifecycleStates.cancelled,
    RunLifecycleStates.failed,
  ],
  [RunLifecycleStates.retryPending]: [
    RunLifecycleStates.queued,
    RunLifecycleStates.cancelled,
  ],
  [RunLifecycleStates.completed]: [],
  [RunLifecycleStates.failed]: [RunLifecycleStates.retryPending],
  [RunLifecycleStates.cancelled]: [RunLifecycleStates.retryPending],
} as const satisfies Record<RunLifecycleState, ReadonlyArray<RunLifecycleState>>;

export const RunLifecycleTransitions: Readonly<Record<RunLifecycleState, ReadonlyArray<RunLifecycleState>>> =
  Object.freeze(Object.fromEntries(Object.entries(stateTransitions).map(([state, next]) => [state, Object.freeze([...next])])) as Record<RunLifecycleState, ReadonlyArray<RunLifecycleState>>);

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new RunDomainError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, label: string): string {
  const normalized = normalizeRequired(value, label);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new RunDomainError(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RunDomainError(`${label} must be a positive integer.`);
  }
  return value;
}

function normalizeSubmissionSource(source: RunSubmissionSource): RunSubmissionSource {
  if (!Object.values(RunSubmissionSources).includes(source)) {
    throw new RunDomainError(`Run submission source '${String(source)}' is invalid.`);
  }
  return source;
}

function normalizeLifecycleState(state: RunLifecycleState): RunLifecycleState {
  if (!Object.values(RunLifecycleStates).includes(state)) {
    throw new RunDomainError(`Run lifecycle state '${String(state)}' is invalid.`);
  }
  return state;
}

function normalizeAssignmentStatus(status: RunAssignmentStatus): RunAssignmentStatus {
  if (!Object.values(RunAssignmentStatuses).includes(status)) {
    throw new RunDomainError(`Run assignment status '${String(status)}' is invalid.`);
  }
  return status;
}

function normalizeOutcomeKind(outcome: RunExecutionOutcomeKind): RunExecutionOutcomeKind {
  if (!Object.values(RunExecutionOutcomeKinds).includes(outcome)) {
    throw new RunDomainError(`Run execution outcome '${String(outcome)}' is invalid.`);
  }
  return outcome;
}

function normalizeQueueState(value?: RunQueueState): RunQueueState | undefined {
  if (!value) {
    return undefined;
  }

  if (value.position !== null && (!Number.isInteger(value.position) || value.position < 1)) {
    throw new RunDomainError("Run queue position must be a positive integer or null.");
  }

  const enteredAt = normalizeIsoTimestamp(value.enteredAt, "Run queue enteredAt");
  const positionAsOf = normalizeIsoTimestamp(value.positionAsOf, "Run queue positionAsOf");
  const dequeuedAt = value.dequeuedAt ? normalizeIsoTimestamp(value.dequeuedAt, "Run queue dequeuedAt") : undefined;

  if (Date.parse(positionAsOf) < Date.parse(enteredAt)) {
    throw new RunDomainError("Run queue positionAsOf cannot be earlier than enteredAt.");
  }
  if (dequeuedAt && Date.parse(dequeuedAt) < Date.parse(enteredAt)) {
    throw new RunDomainError("Run queue dequeuedAt cannot be earlier than enteredAt.");
  }

  return Object.freeze({
    queueId: normalizeRequired(value.queueId, "Run queue id"),
    enteredAt,
    position: value.position,
    positionAsOf,
    dequeuedAt,
  });
}

function normalizeAssignmentState(value: RunAssignmentState): RunAssignmentState {
  const status = normalizeAssignmentStatus(value.status);
  const candidateNodeId = normalizeOptional(value.candidateNodeId);
  const assignedNodeId = normalizeOptional(value.assignedNodeId);
  const assignedAt = value.assignedAt ? normalizeIsoTimestamp(value.assignedAt, "Run assignment assignedAt") : undefined;
  const releasedAt = value.releasedAt ? normalizeIsoTimestamp(value.releasedAt, "Run assignment releasedAt") : undefined;
  const releaseReason = normalizeOptional(value.releaseReason);

  if (status === RunAssignmentStatuses.unassigned) {
    if (candidateNodeId || assignedNodeId || assignedAt || releasedAt) {
      throw new RunDomainError("Unassigned run state cannot include assignment node or timestamp fields.");
    }
  }

  if (status === RunAssignmentStatuses.pending) {
    if (!candidateNodeId || assignedNodeId || assignedAt || releasedAt) {
      throw new RunDomainError("Pending assignment requires candidateNodeId and cannot include assigned/released fields.");
    }
  }

  if (status === RunAssignmentStatuses.assigned) {
    if (!assignedNodeId || !assignedAt || releasedAt) {
      throw new RunDomainError("Assigned run state requires assignedNodeId and assignedAt and cannot include releasedAt.");
    }
  }

  if (status === RunAssignmentStatuses.released) {
    if (!assignedNodeId || !assignedAt || !releasedAt) {
      throw new RunDomainError("Released assignment requires assignedNodeId, assignedAt, and releasedAt.");
    }
    if (Date.parse(releasedAt) < Date.parse(assignedAt)) {
      throw new RunDomainError("Run assignment releasedAt cannot be earlier than assignedAt.");
    }
  }

  return Object.freeze({
    status,
    candidateNodeId,
    assignedNodeId,
    assignedAt,
    releasedAt,
    releaseReason,
  });
}

function normalizeExecutionState(value?: RunExecutionState): RunExecutionState {
  const startedAt = value?.startedAt ? normalizeIsoTimestamp(value.startedAt, "Run execution startedAt") : undefined;
  const heartbeatAt = value?.heartbeatAt ? normalizeIsoTimestamp(value.heartbeatAt, "Run execution heartbeatAt") : undefined;
  const finishedAt = value?.finishedAt ? normalizeIsoTimestamp(value.finishedAt, "Run execution finishedAt") : undefined;
  const outcome = normalizeOutcomeKind(value?.outcome ?? RunExecutionOutcomeKinds.none);

  if (startedAt && heartbeatAt && Date.parse(heartbeatAt) < Date.parse(startedAt)) {
    throw new RunDomainError("Run execution heartbeatAt cannot be earlier than startedAt.");
  }
  if (startedAt && finishedAt && Date.parse(finishedAt) < Date.parse(startedAt)) {
    throw new RunDomainError("Run execution finishedAt cannot be earlier than startedAt.");
  }

  const errorCode = normalizeOptional(value?.errorCode);
  const errorMessage = normalizeOptional(value?.errorMessage);

  if (outcome === RunExecutionOutcomeKinds.failed && !errorMessage) {
    throw new RunDomainError("Failed execution outcomes must include errorMessage.");
  }
  if (outcome !== RunExecutionOutcomeKinds.failed && (errorCode || errorMessage)) {
    throw new RunDomainError("Only failed execution outcomes may include execution error fields.");
  }

  return Object.freeze({
    adapterKind: normalizeOptional(value?.adapterKind),
    adapterRunId: normalizeOptional(value?.adapterRunId),
    startedAt,
    heartbeatAt,
    finishedAt,
    outcome,
    errorCode,
    errorMessage,
  });
}

function normalizeCancellationState(value?: RunCancellationState): RunCancellationState | undefined {
  if (!value) {
    return undefined;
  }

  const requestedAt = normalizeIsoTimestamp(value.requestedAt, "Run cancellation requestedAt");
  const acknowledgedAt = value.acknowledgedAt
    ? normalizeIsoTimestamp(value.acknowledgedAt, "Run cancellation acknowledgedAt")
    : undefined;

  if (acknowledgedAt && Date.parse(acknowledgedAt) < Date.parse(requestedAt)) {
    throw new RunDomainError("Run cancellation acknowledgedAt cannot be earlier than requestedAt.");
  }

  return Object.freeze({
    requestedAt,
    requestedByActorId: normalizeOptional(value.requestedByActorId),
    reason: normalizeOptional(value.reason),
    acknowledgedAt,
  });
}

function normalizeRetryState(value?: Partial<RunRetryState>): RunRetryState {
  const attempt = normalizePositiveInteger(value?.attempt ?? 1, "Run retry attempt");
  const maxAttempts = normalizePositiveInteger(value?.maxAttempts ?? 1, "Run retry maxAttempts");
  if (attempt > maxAttempts) {
    throw new RunDomainError("Run retry attempt cannot exceed maxAttempts.");
  }

  return Object.freeze({
    attempt,
    maxAttempts,
    previousRunId: normalizeOptional(value?.previousRunId),
    retryReason: normalizeOptional(value?.retryReason),
    queuedAt: value?.queuedAt ? normalizeIsoTimestamp(value.queuedAt, "Run retry queuedAt") : undefined,
  });
}

function assertQueueStateCoherence(state: RunLifecycleState, queue: RunQueueState | undefined): void {
  if (QueueOwnedStates.has(state)) {
    if (!queue) {
      throw new RunDomainError(`Run state '${state}' requires queue state.`);
    }
    if (queue.dequeuedAt !== undefined) {
      throw new RunDomainError(`Run state '${state}' cannot include queue.dequeuedAt.`);
    }
    return;
  }

  if (queue && !queue.dequeuedAt) {
    throw new RunDomainError(`Run state '${state}' may include queue state only after dequeue.`);
  }
}

function assertAssignmentCoherence(state: RunLifecycleState, assignment: RunAssignmentState): void {
  if (state === RunLifecycleStates.assignmentPending && assignment.status !== RunAssignmentStatuses.pending) {
    throw new RunDomainError("Assignment-pending run state requires assignment status 'pending'.");
  }
  if ((state === RunLifecycleStates.assigned || state === RunLifecycleStates.dispatching || state === RunLifecycleStates.running)
    && assignment.status !== RunAssignmentStatuses.assigned) {
    throw new RunDomainError(`Run state '${state}' requires assignment status 'assigned'.`);
  }
}

function assertExecutionCoherence(state: RunLifecycleState, execution: RunExecutionState): void {
  if (state === RunLifecycleStates.running && !execution.startedAt) {
    throw new RunDomainError("Running run state requires execution.startedAt.");
  }

  const expectedByState: Partial<Record<RunLifecycleState, RunExecutionOutcomeKind>> = {
    [RunLifecycleStates.completed]: RunExecutionOutcomeKinds.succeeded,
    [RunLifecycleStates.failed]: RunExecutionOutcomeKinds.failed,
    [RunLifecycleStates.cancelled]: RunExecutionOutcomeKinds.cancelled,
  };

  const expected = expectedByState[state];
  if (expected && execution.outcome !== expected) {
    throw new RunDomainError(`Run state '${state}' requires execution outcome '${expected}'.`);
  }
  if (!expected && execution.outcome !== RunExecutionOutcomeKinds.none && !TerminalStates.has(state)) {
    throw new RunDomainError(`Non-terminal run state '${state}' must use execution outcome 'none'.`);
  }
}

function assertCancellationCoherence(state: RunLifecycleState, cancellation?: RunCancellationState): void {
  const permitsCancellation = state === RunLifecycleStates.cancelling || state === RunLifecycleStates.cancelled;
  if (!permitsCancellation && cancellation) {
    throw new RunDomainError(`Run state '${state}' cannot include cancellation state.`);
  }
  if (permitsCancellation && !cancellation) {
    throw new RunDomainError(`Run state '${state}' requires cancellation state.`);
  }
}

function assertRetryCoherence(state: RunLifecycleState, retry: RunRetryState): void {
  if (state !== RunLifecycleStates.retryPending && retry.queuedAt) {
    throw new RunDomainError("Run retry queuedAt can only be set for retry-pending runs.");
  }
  if (state === RunLifecycleStates.retryPending && retry.attempt >= retry.maxAttempts) {
    throw new RunDomainError("Retry-pending runs require remaining retry budget.");
  }
}

export function isRunLifecycleTransitionAllowed(from: RunLifecycleState, to: RunLifecycleState): boolean {
  const normalizedFrom = normalizeLifecycleState(from);
  const normalizedTo = normalizeLifecycleState(to);
  if (normalizedFrom === normalizedTo) {
    return true;
  }
  return RunLifecycleTransitions[normalizedFrom].includes(normalizedTo);
}

export function createCanonicalRunRecord(input: {
  readonly identity: RunIdentity;
  readonly submission: RunSubmissionContext;
  readonly state?: RunLifecycleState;
  readonly queue?: RunQueueState;
  readonly assignment?: RunAssignmentState;
  readonly execution?: RunExecutionState;
  readonly cancellation?: RunCancellationState;
  readonly retry?: Partial<RunRetryState>;
  readonly updatedAt?: string;
}): CanonicalRunRecord {
  const state = normalizeLifecycleState(input.state ?? RunLifecycleStates.submitted);

  const record: CanonicalRunRecord = Object.freeze({
    identity: Object.freeze({
      runId: normalizeRequired(input.identity.runId, "Run id"),
      workflowId: normalizeRequired(input.identity.workflowId, "Workflow id"),
      workspaceId: normalizeOptional(input.identity.workspaceId),
    }),
    submission: Object.freeze({
      source: normalizeSubmissionSource(input.submission.source),
      submittedAt: normalizeIsoTimestamp(input.submission.submittedAt, "Run submittedAt"),
      submittedByActorId: normalizeOptional(input.submission.submittedByActorId),
      clientRequestId: normalizeOptional(input.submission.clientRequestId),
      correlationId: normalizeOptional(input.submission.correlationId),
    }),
    state,
    queue: normalizeQueueState(input.queue),
    assignment: normalizeAssignmentState(input.assignment ?? { status: RunAssignmentStatuses.unassigned }),
    execution: normalizeExecutionState(input.execution),
    cancellation: normalizeCancellationState(input.cancellation),
    retry: normalizeRetryState(input.retry),
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? input.submission.submittedAt, "Run updatedAt"),
  });

  assertQueueStateCoherence(record.state, record.queue);
  assertAssignmentCoherence(record.state, record.assignment);
  assertExecutionCoherence(record.state, record.execution);
  assertCancellationCoherence(record.state, record.cancellation);
  assertRetryCoherence(record.state, record.retry);

  if (Date.parse(record.updatedAt) < Date.parse(record.submission.submittedAt)) {
    throw new RunDomainError("Run updatedAt cannot be earlier than submittedAt.");
  }

  return record;
}

export function transitionCanonicalRunRecord(
  run: CanonicalRunRecord,
  transition: {
    readonly toState: RunLifecycleState;
    readonly occurredAt: string;
    readonly queue?: RunQueueState | null;
    readonly assignment?: RunAssignmentState;
    readonly execution?: RunExecutionState;
    readonly cancellation?: RunCancellationState | null;
    readonly retry?: Partial<RunRetryState>;
  },
): CanonicalRunRecord {
  const toState = normalizeLifecycleState(transition.toState);
  if (!isRunLifecycleTransitionAllowed(run.state, toState)) {
    throw new RunLifecycleTransitionError(run.state, toState);
  }

  const nextRetry = transition.retry
    ? normalizeRetryState({ ...run.retry, ...transition.retry })
    : run.retry;

  return createCanonicalRunRecord({
    identity: run.identity,
    submission: run.submission,
    state: toState,
    queue: transition.queue === undefined ? run.queue : transition.queue ?? undefined,
    assignment: transition.assignment ?? run.assignment,
    execution: transition.execution ?? run.execution,
    cancellation: transition.cancellation === undefined ? run.cancellation : transition.cancellation ?? undefined,
    retry: nextRetry,
    updatedAt: transition.occurredAt,
  });
}
