import { AssetId } from "../assets/AssetId";
import {
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
  type CompositionTaxonomyDescriptor,
} from "../taxonomy/CompositionTaxonomy";

export const ExecutionStatusKinds = Object.freeze({
  pending: "pending",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
});

export type ExecutionStatusKind = typeof ExecutionStatusKinds[keyof typeof ExecutionStatusKinds];

export interface ExecutionEnvironmentRef {
  readonly environmentId: string;
  readonly provider?: string;
  readonly region?: string;
  readonly labels?: ReadonlyArray<string>;
}

export interface ExecutionContext {
  readonly invocationId?: string;
  readonly trigger?: "manual" | "scheduled" | "event" | "api";
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionAssetRef {
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
}

export interface ExecutionNodeRef {
  readonly executionNodeId: string;
  readonly parentExecutionNodeId?: string;
  readonly path: ReadonlyArray<string>;
  readonly target: ExecutionAssetRef;
}

export interface ExecutionInputEnvelope {
  readonly payload: unknown;
  readonly contentType?: string;
  readonly schemaVersion?: string;
  readonly capturedAt: string;
}

export interface ExecutionOutputEnvelope {
  readonly payload?: unknown;
  readonly contentType?: string;
  readonly schemaVersion?: string;
  readonly producedAt?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export const ExecutionNodeStatusKinds = Object.freeze({
  pending: "pending",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
});

export type ExecutionNodeStatusKind = typeof ExecutionNodeStatusKinds[keyof typeof ExecutionNodeStatusKinds];

export const ExecutionDecisionKinds = Object.freeze({
  complete: "complete",
  iterate: "iterate",
  replan: "replan",
  unsupported: "unsupported",
});

export type ExecutionDecisionKind = typeof ExecutionDecisionKinds[keyof typeof ExecutionDecisionKinds];

export interface ExecutionNodeDecisionState {
  readonly kind: ExecutionDecisionKind;
  readonly reason?: string;
  readonly decidedAt: string;
}

export interface ExecutionNodeState {
  readonly executionNodeId: string;
  readonly status: ExecutionNodeStatusKind;
  readonly iterationCount: number;
  readonly planningCycleCount: number;
  readonly startedAt?: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly lastError?: {
    readonly code: string;
    readonly message: string;
  };
  readonly lastDecision?: ExecutionNodeDecisionState;
}

export interface ExecutionProgressSnapshot {
  readonly totalNodeCount: number;
  readonly completedNodeCount: number;
  readonly failedNodeCount: number;
  readonly runningNodeCount: number;
  readonly updatedAt: string;
}

export interface ExecutionRuntimeState {
  readonly snapshot: ExecutionProgressSnapshot;
  readonly nodeStates: ReadonlyArray<ExecutionNodeState>;
  readonly trace: ExecutionTrace;
  readonly errors: ReadonlyArray<RuntimeExecutionError>;
}

export const ExecutionTraceEventKinds = Object.freeze({
  executionCreated: "execution-created",
  executionStatusChanged: "execution-status-changed",
  nodeAttached: "node-attached",
  nodeStatusChanged: "node-status-changed",
  nodeIterationProgressed: "node-iteration-progressed",
  nodePlanningProgressed: "node-planning-progressed",
  loopProgressed: "loop-progressed",
  autonomousPlanningProgressed: "autonomous-planning-progressed",
  nestedSystemEntered: "nested-system-entered",
  nestedSystemCompleted: "nested-system-completed",
  errorRecorded: "error-recorded",
  recoveryDecided: "recovery-decided",
});

export type ExecutionTraceEventKind = typeof ExecutionTraceEventKinds[keyof typeof ExecutionTraceEventKinds];

export const ExecutionLogLevels = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export type ExecutionLogLevel = typeof ExecutionLogLevels[keyof typeof ExecutionLogLevels];

export interface ExecutionLogEntry {
  readonly entryId: string;
  readonly level: ExecutionLogLevel;
  readonly message: string;
  readonly emittedAt: string;
  readonly nodeId?: string;
  readonly diagnostics?: ReadonlyArray<string>;
}

export interface ExecutionTraceEvent {
  readonly eventId: string;
  readonly kind: ExecutionTraceEventKind;
  readonly at: string;
  readonly executionId: string;
  readonly nodeId?: string;
  readonly parentNodeId?: string;
  readonly status?: ExecutionStatusKind | ExecutionNodeStatusKind;
  readonly iteration?: number;
  readonly planningCycle?: number;
  readonly summary?: string;
  readonly diagnostics?: ReadonlyArray<string>;
  readonly errorCode?: string;
}

export interface ExecutionTrace {
  readonly events: ReadonlyArray<ExecutionTraceEvent>;
  readonly logs: ReadonlyArray<ExecutionLogEntry>;
  readonly lastEventAt?: string;
}

export const RuntimeExecutionErrorKinds = Object.freeze({
  stepFailure: "step-failure",
  environmentMismatch: "environment-mismatch",
  dependencyResolutionFailure: "dependency-resolution-failure",
  iterativeProgressionFailure: "iterative-progression-failure",
  autonomousPlanningFailure: "autonomous-planning-failure",
  nestedSystemFailure: "nested-system-failure",
  orchestrationFailure: "orchestration-failure",
});

export type RuntimeExecutionErrorKind = typeof RuntimeExecutionErrorKinds[keyof typeof RuntimeExecutionErrorKinds];

export interface RuntimeExecutionError {
  readonly errorId: string;
  readonly kind: RuntimeExecutionErrorKind;
  readonly code: string;
  readonly message: string;
  readonly at: string;
  readonly executionId: string;
  readonly nodeId?: string;
  readonly parentNodeId?: string;
  readonly retriable: boolean;
  readonly diagnostics?: ReadonlyArray<string>;
}

export const RecoveryActionKinds = Object.freeze({
  failExecution: "fail-execution",
  retryStep: "retry-step",
  retryLoopPass: "retry-loop-pass",
});

export type RecoveryActionKind = typeof RecoveryActionKinds[keyof typeof RecoveryActionKinds];

export interface RecoveryDecision {
  readonly action: RecoveryActionKind;
  readonly reason: string;
  readonly decidedAt: string;
  readonly retryCount: number;
  readonly maxRetries: number;
}

export interface SystemExecution {
  readonly executionId: string;
  readonly root: ExecutionAssetRef;
  readonly context: ExecutionContext;
  readonly environment?: ExecutionEnvironmentRef;
  readonly status: ExecutionStatusKind;
  readonly nodes: ReadonlyArray<ExecutionNodeRef>;
  readonly input: ExecutionInputEnvelope;
  readonly output?: ExecutionOutputEnvelope;
  readonly runtimeState: ExecutionRuntimeState;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((entry) => entry.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeExecutionContext(context?: ExecutionContext): ExecutionContext {
  if (!context) {
    return Object.freeze({});
  }

  return Object.freeze({
    invocationId: normalizeOptional(context.invocationId),
    trigger: context.trigger,
    actorId: normalizeOptional(context.actorId),
    correlationId: normalizeOptional(context.correlationId),
    tags: normalizeStringList(context.tags),
    metadata: context.metadata ? Object.freeze({ ...context.metadata }) : undefined,
  });
}

function normalizeExecutionEnvironmentRef(environment?: ExecutionEnvironmentRef): ExecutionEnvironmentRef | undefined {
  if (!environment) {
    return undefined;
  }

  return Object.freeze({
    environmentId: normalizeRequired(environment.environmentId, "Execution environment id"),
    provider: normalizeOptional(environment.provider),
    region: normalizeOptional(environment.region),
    labels: normalizeStringList(environment.labels),
  });
}

function normalizeExecutionAssetRef(input: ExecutionAssetRef): ExecutionAssetRef {
  const taxonomy = createCompositionTaxonomyDescriptor(input.taxonomy);
  assertAllowedCompositionTaxonomyCombination(taxonomy, "Execution asset taxonomy");

  return Object.freeze({
    assetId: AssetId.from(input.assetId).value,
    versionId: normalizeOptional(input.versionId),
    taxonomy,
  });
}

function normalizeExecutionNodeRef(node: ExecutionNodeRef): ExecutionNodeRef {
  const executionNodeId = normalizeRequired(node.executionNodeId, "Execution node id");
  const path = Object.freeze(node.path.map((entry, index) =>
    normalizeRequired(entry, `Execution node path segment ${index}`)
  ));

  return Object.freeze({
    executionNodeId,
    parentExecutionNodeId: normalizeOptional(node.parentExecutionNodeId),
    path,
    target: normalizeExecutionAssetRef(node.target),
  });
}

function normalizeInputEnvelope(input: ExecutionInputEnvelope): ExecutionInputEnvelope {
  return Object.freeze({
    payload: input.payload,
    contentType: normalizeOptional(input.contentType),
    schemaVersion: normalizeOptional(input.schemaVersion),
    capturedAt: normalizeRequired(input.capturedAt, "Execution input captured timestamp"),
  });
}

function normalizeOutputEnvelope(output: ExecutionOutputEnvelope): ExecutionOutputEnvelope {
  const error = output.error
    ? Object.freeze({
      code: normalizeRequired(output.error.code, "Execution output error code"),
      message: normalizeRequired(output.error.message, "Execution output error message"),
    })
    : undefined;

  return Object.freeze({
    payload: output.payload,
    contentType: normalizeOptional(output.contentType),
    schemaVersion: normalizeOptional(output.schemaVersion),
    producedAt: normalizeOptional(output.producedAt),
    error,
  });
}

function normalizeDecisionState(decision: ExecutionNodeDecisionState): ExecutionNodeDecisionState {
  return Object.freeze({
    kind: decision.kind,
    reason: normalizeOptional(decision.reason),
    decidedAt: normalizeRequired(decision.decidedAt, "Execution node decision timestamp"),
  });
}

function normalizeNodeStatus(value: ExecutionNodeStatusKind): ExecutionNodeStatusKind {
  if (!Object.values(ExecutionNodeStatusKinds).includes(value)) {
    throw new Error(`Execution node status '${value}' is unsupported.`);
  }
  return value;
}

function normalizeNodeState(node: ExecutionNodeState): ExecutionNodeState {
  const iterationCount = Math.max(0, Math.floor(node.iterationCount));
  const planningCycleCount = Math.max(0, Math.floor(node.planningCycleCount));

  return Object.freeze({
    executionNodeId: normalizeRequired(node.executionNodeId, "Execution node state id"),
    status: normalizeNodeStatus(node.status),
    iterationCount,
    planningCycleCount,
    startedAt: normalizeOptional(node.startedAt),
    updatedAt: normalizeRequired(node.updatedAt, "Execution node state updated timestamp"),
    completedAt: normalizeOptional(node.completedAt),
    lastError: node.lastError
      ? Object.freeze({
        code: normalizeRequired(node.lastError.code, "Execution node error code"),
        message: normalizeRequired(node.lastError.message, "Execution node error message"),
      })
      : undefined,
    lastDecision: node.lastDecision ? normalizeDecisionState(node.lastDecision) : undefined,
  });
}

function normalizeProgressSnapshot(snapshot: ExecutionProgressSnapshot): ExecutionProgressSnapshot {
  const totalNodeCount = Math.max(0, Math.floor(snapshot.totalNodeCount));
  const completedNodeCount = Math.max(0, Math.floor(snapshot.completedNodeCount));
  const failedNodeCount = Math.max(0, Math.floor(snapshot.failedNodeCount));
  const runningNodeCount = Math.max(0, Math.floor(snapshot.runningNodeCount));

  return Object.freeze({
    totalNodeCount,
    completedNodeCount,
    failedNodeCount,
    runningNodeCount,
    updatedAt: normalizeRequired(snapshot.updatedAt, "Execution progress snapshot updated timestamp"),
  });
}

function normalizeRuntimeState(runtimeState?: ExecutionRuntimeState, updatedAt?: string): ExecutionRuntimeState {
  if (!runtimeState) {
    return Object.freeze({
      snapshot: Object.freeze({
        totalNodeCount: 0,
        completedNodeCount: 0,
        failedNodeCount: 0,
        runningNodeCount: 0,
        updatedAt: normalizeRequired(updatedAt ?? new Date().toISOString(), "Execution runtime-state updated timestamp"),
      }),
      nodeStates: Object.freeze([]),
      trace: Object.freeze({
        events: Object.freeze([]),
        logs: Object.freeze([]),
      }),
      errors: Object.freeze([]),
    });
  }

  return Object.freeze({
    snapshot: normalizeProgressSnapshot(runtimeState.snapshot),
    nodeStates: Object.freeze(runtimeState.nodeStates.map(normalizeNodeState)),
    trace: Object.freeze({
      events: Object.freeze(runtimeState.trace.events.map((entry) => Object.freeze({
        ...entry,
        eventId: normalizeRequired(entry.eventId, "Execution trace event id"),
        kind: entry.kind,
        at: normalizeRequired(entry.at, "Execution trace event timestamp"),
        executionId: normalizeRequired(entry.executionId, "Execution trace event execution id"),
        nodeId: normalizeOptional(entry.nodeId),
        parentNodeId: normalizeOptional(entry.parentNodeId),
        summary: normalizeOptional(entry.summary),
        diagnostics: normalizeStringList(entry.diagnostics),
        errorCode: normalizeOptional(entry.errorCode),
      }))),
      logs: Object.freeze(runtimeState.trace.logs.map((entry) => Object.freeze({
        ...entry,
        entryId: normalizeRequired(entry.entryId, "Execution log entry id"),
        message: normalizeRequired(entry.message, "Execution log entry message"),
        emittedAt: normalizeRequired(entry.emittedAt, "Execution log entry timestamp"),
        nodeId: normalizeOptional(entry.nodeId),
        diagnostics: normalizeStringList(entry.diagnostics),
      }))),
      lastEventAt: normalizeOptional(runtimeState.trace.lastEventAt),
    }),
    errors: Object.freeze(runtimeState.errors.map((entry) => Object.freeze({
      ...entry,
      errorId: normalizeRequired(entry.errorId, "Runtime execution error id"),
      code: normalizeRequired(entry.code, "Runtime execution error code"),
      message: normalizeRequired(entry.message, "Runtime execution error message"),
      at: normalizeRequired(entry.at, "Runtime execution error timestamp"),
      executionId: normalizeRequired(entry.executionId, "Runtime execution error execution id"),
      nodeId: normalizeOptional(entry.nodeId),
      parentNodeId: normalizeOptional(entry.parentNodeId),
      diagnostics: normalizeStringList(entry.diagnostics),
    }))),
  });
}

function buildSnapshotFromNodeStates(nodeStates: ReadonlyArray<ExecutionNodeState>, totalNodeCount: number, updatedAt: string): ExecutionProgressSnapshot {
  const completedNodeCount = nodeStates.filter((entry) => entry.status === ExecutionNodeStatusKinds.succeeded).length;
  const failedNodeCount = nodeStates.filter((entry) =>
    entry.status === ExecutionNodeStatusKinds.failed || entry.status === ExecutionNodeStatusKinds.cancelled
  ).length;
  const runningNodeCount = nodeStates.filter((entry) => entry.status === ExecutionNodeStatusKinds.running).length;

  return Object.freeze({
    totalNodeCount: Math.max(totalNodeCount, nodeStates.length),
    completedNodeCount,
    failedNodeCount,
    runningNodeCount,
    updatedAt: normalizeRequired(updatedAt, "Execution runtime-state snapshot updated timestamp"),
  });
}

function assertStatusTransitionAllowed(from: ExecutionStatusKind, to: ExecutionStatusKind): void {
  const allowedTransitions: Readonly<Record<ExecutionStatusKind, ReadonlyArray<ExecutionStatusKind>>> = Object.freeze({
    [ExecutionStatusKinds.pending]: Object.freeze([ExecutionStatusKinds.running, ExecutionStatusKinds.cancelled]),
    [ExecutionStatusKinds.running]: Object.freeze([
      ExecutionStatusKinds.succeeded,
      ExecutionStatusKinds.failed,
      ExecutionStatusKinds.cancelled,
    ]),
    [ExecutionStatusKinds.succeeded]: Object.freeze([]),
    [ExecutionStatusKinds.failed]: Object.freeze([]),
    [ExecutionStatusKinds.cancelled]: Object.freeze([]),
  });

  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Execution status cannot transition from '${from}' to '${to}'.`);
  }
}

export function isTerminalExecutionStatus(status: ExecutionStatusKind): boolean {
  return status === ExecutionStatusKinds.succeeded
    || status === ExecutionStatusKinds.failed
    || status === ExecutionStatusKinds.cancelled;
}

export function createSystemExecution(input: {
  readonly executionId: string;
  readonly root: ExecutionAssetRef;
  readonly context?: ExecutionContext;
  readonly environment?: ExecutionEnvironmentRef;
  readonly status?: Extract<ExecutionStatusKind, "pending" | "running">;
  readonly nodes?: ReadonlyArray<ExecutionNodeRef>;
  readonly input: ExecutionInputEnvelope;
  readonly output?: ExecutionOutputEnvelope;
  readonly runtimeState?: ExecutionRuntimeState;
  readonly startedAt: string;
  readonly updatedAt?: string;
  readonly completedAt?: string;
}): SystemExecution {
  const status = input.status ?? ExecutionStatusKinds.pending;
  const updatedAt = normalizeRequired(input.updatedAt ?? input.startedAt, "Execution updated timestamp");
  const executionId = normalizeRequired(input.executionId, "Execution id");
  const runtimeState = normalizeRuntimeState(input.runtimeState, updatedAt);

  let execution = Object.freeze({
    executionId,
    root: normalizeExecutionAssetRef(input.root),
    context: normalizeExecutionContext(input.context),
    environment: normalizeExecutionEnvironmentRef(input.environment),
    status,
    nodes: Object.freeze((input.nodes ?? []).map(normalizeExecutionNodeRef)),
    input: normalizeInputEnvelope(input.input),
    output: input.output ? normalizeOutputEnvelope(input.output) : undefined,
    runtimeState,
    startedAt: normalizeRequired(input.startedAt, "Execution started timestamp"),
    updatedAt,
    completedAt: normalizeOptional(input.completedAt),
  });
  execution = appendExecutionTraceEvent({
    execution,
    event: {
      eventId: `${execution.executionId}:trace:event:0`,
      kind: ExecutionTraceEventKinds.executionCreated,
      at: updatedAt,
      executionId,
      status,
      summary: "Execution created.",
    },
    logEntry: {
      entryId: `${execution.executionId}:trace:log:0`,
      level: ExecutionLogLevels.info,
      message: `Execution '${execution.executionId}' created.`,
      emittedAt: updatedAt,
    },
  });

  return execution;
}

export function transitionSystemExecutionStatus(input: {
  readonly execution: SystemExecution;
  readonly nextStatus: ExecutionStatusKind;
  readonly updatedAt: string;
  readonly output?: ExecutionOutputEnvelope;
  readonly completedAt?: string;
}): SystemExecution {
  assertStatusTransitionAllowed(input.execution.status, input.nextStatus);
  const completedAt = isTerminalExecutionStatus(input.nextStatus)
    ? normalizeRequired(input.completedAt ?? input.updatedAt, "Execution completion timestamp")
    : undefined;

  return Object.freeze({
    ...input.execution,
    status: input.nextStatus,
    updatedAt: normalizeRequired(input.updatedAt, "Execution updated timestamp"),
    runtimeState: Object.freeze({
      ...input.execution.runtimeState,
      snapshot: Object.freeze({
        ...input.execution.runtimeState.snapshot,
        updatedAt: normalizeRequired(input.updatedAt, "Execution runtime-state snapshot updated timestamp"),
      }),
    }),
    output: input.output ? normalizeOutputEnvelope(input.output) : input.execution.output,
    completedAt,
  });
}

export function attachExecutionNode(input: {
  readonly execution: SystemExecution;
  readonly node: ExecutionNodeRef;
  readonly updatedAt: string;
}): SystemExecution {
  const normalizedNode = normalizeExecutionNodeRef(input.node);
  if (input.execution.nodes.some((node) => node.executionNodeId === normalizedNode.executionNodeId)) {
    throw new Error(`Execution node '${normalizedNode.executionNodeId}' already exists.`);
  }

  const nextNodes = Object.freeze([...input.execution.nodes, normalizedNode]);
  return Object.freeze({
    ...input.execution,
    nodes: nextNodes,
    updatedAt: normalizeRequired(input.updatedAt, "Execution updated timestamp"),
  });
}

export function initializeExecutionRuntimeState(input: {
  readonly execution: SystemExecution;
  readonly nodeIds: ReadonlyArray<string>;
  readonly updatedAt: string;
}): SystemExecution {
  const normalizedNodeIds = [...new Set(input.nodeIds.map((entry) => normalizeRequired(entry, "Execution plan node id")))];
  const nodeStates = Object.freeze(normalizedNodeIds.map((nodeId) => Object.freeze({
    executionNodeId: nodeId,
    status: ExecutionNodeStatusKinds.pending,
    iterationCount: 0,
    planningCycleCount: 0,
    updatedAt: normalizeRequired(input.updatedAt, "Execution runtime-state node updated timestamp"),
  })));

  return Object.freeze({
    ...input.execution,
    runtimeState: Object.freeze({
      nodeStates,
      snapshot: buildSnapshotFromNodeStates(nodeStates, normalizedNodeIds.length, input.updatedAt),
      trace: input.execution.runtimeState.trace,
      errors: input.execution.runtimeState.errors,
    }),
    updatedAt: normalizeRequired(input.updatedAt, "Execution updated timestamp"),
  });
}

export function updateExecutionNodeState(input: {
  readonly execution: SystemExecution;
  readonly executionNodeId: string;
  readonly status: ExecutionNodeStatusKind;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly decision?: ExecutionNodeDecisionState;
  readonly incrementIteration?: boolean;
  readonly incrementPlanningCycle?: boolean;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}): SystemExecution {
  const executionNodeId = normalizeRequired(input.executionNodeId, "Execution runtime-state node id");
  const targetStatus = normalizeNodeStatus(input.status);
  const updatedAt = normalizeRequired(input.updatedAt, "Execution runtime-state update timestamp");
  const existing = input.execution.runtimeState.nodeStates.find((entry) => entry.executionNodeId === executionNodeId);
  if (!existing) {
    throw new Error(`Execution runtime state is missing node '${executionNodeId}'.`);
  }

  const nextNode = normalizeNodeState({
    ...existing,
    status: targetStatus,
    startedAt: normalizeOptional(input.startedAt) ?? existing.startedAt,
    updatedAt,
    completedAt: normalizeOptional(input.completedAt),
    iterationCount: existing.iterationCount + (input.incrementIteration ? 1 : 0),
    planningCycleCount: existing.planningCycleCount + (input.incrementPlanningCycle ? 1 : 0),
    lastDecision: input.decision ? normalizeDecisionState(input.decision) : existing.lastDecision,
    lastError: input.error
      ? Object.freeze({
        code: normalizeRequired(input.error.code, "Execution node error code"),
        message: normalizeRequired(input.error.message, "Execution node error message"),
      })
      : existing.lastError,
  });

  const nodeStates = Object.freeze(input.execution.runtimeState.nodeStates.map((entry) =>
    entry.executionNodeId === executionNodeId ? nextNode : entry
  ));

  return Object.freeze({
    ...input.execution,
    runtimeState: Object.freeze({
      nodeStates,
      snapshot: buildSnapshotFromNodeStates(nodeStates, input.execution.runtimeState.snapshot.totalNodeCount, updatedAt),
      trace: input.execution.runtimeState.trace,
      errors: input.execution.runtimeState.errors,
    }),
    updatedAt,
  });
}

export function appendExecutionTraceEvent(input: {
  readonly execution: SystemExecution;
  readonly event: ExecutionTraceEvent;
  readonly logEntry?: ExecutionLogEntry;
}): SystemExecution {
  const event = Object.freeze({
    ...input.event,
    eventId: normalizeRequired(input.event.eventId, "Execution trace event id"),
    at: normalizeRequired(input.event.at, "Execution trace event timestamp"),
    executionId: normalizeRequired(input.event.executionId, "Execution trace event execution id"),
    nodeId: normalizeOptional(input.event.nodeId),
    parentNodeId: normalizeOptional(input.event.parentNodeId),
    summary: normalizeOptional(input.event.summary),
    diagnostics: normalizeStringList(input.event.diagnostics),
    errorCode: normalizeOptional(input.event.errorCode),
  });
  const logs = input.logEntry
    ? Object.freeze([
      ...input.execution.runtimeState.trace.logs,
      Object.freeze({
        ...input.logEntry,
        entryId: normalizeRequired(input.logEntry.entryId, "Execution log entry id"),
        message: normalizeRequired(input.logEntry.message, "Execution log entry message"),
        emittedAt: normalizeRequired(input.logEntry.emittedAt, "Execution log entry timestamp"),
        nodeId: normalizeOptional(input.logEntry.nodeId),
        diagnostics: normalizeStringList(input.logEntry.diagnostics),
      }),
    ])
    : input.execution.runtimeState.trace.logs;

  return Object.freeze({
    ...input.execution,
    runtimeState: Object.freeze({
      ...input.execution.runtimeState,
      trace: Object.freeze({
        events: Object.freeze([...input.execution.runtimeState.trace.events, event]),
        logs,
        lastEventAt: event.at,
      }),
    }),
    updatedAt: event.at,
  });
}

export function createExecutionTraceSnapshot(execution: SystemExecution): ExecutionTrace {
  return Object.freeze({
    events: Object.freeze([...execution.runtimeState.trace.events]),
    logs: Object.freeze([...execution.runtimeState.trace.logs]),
    lastEventAt: execution.runtimeState.trace.lastEventAt,
  });
}

export function appendRuntimeExecutionError(input: {
  readonly execution: SystemExecution;
  readonly error: RuntimeExecutionError;
}): SystemExecution {
  const normalizedError = Object.freeze({
    ...input.error,
    errorId: normalizeRequired(input.error.errorId, "Runtime execution error id"),
    code: normalizeRequired(input.error.code, "Runtime execution error code"),
    message: normalizeRequired(input.error.message, "Runtime execution error message"),
    at: normalizeRequired(input.error.at, "Runtime execution error timestamp"),
    executionId: normalizeRequired(input.error.executionId, "Runtime execution error execution id"),
    nodeId: normalizeOptional(input.error.nodeId),
    parentNodeId: normalizeOptional(input.error.parentNodeId),
    diagnostics: normalizeStringList(input.error.diagnostics),
  });

  return appendExecutionTraceEvent({
    execution: Object.freeze({
      ...input.execution,
      runtimeState: Object.freeze({
        ...input.execution.runtimeState,
        errors: Object.freeze([...input.execution.runtimeState.errors, normalizedError]),
      }),
    }),
    event: {
      eventId: `${input.execution.executionId}:trace:event:error:${input.execution.runtimeState.errors.length}`,
      kind: ExecutionTraceEventKinds.errorRecorded,
      at: normalizedError.at,
      executionId: input.execution.executionId,
      nodeId: normalizedError.nodeId,
      parentNodeId: normalizedError.parentNodeId,
      summary: normalizedError.message,
      diagnostics: normalizedError.diagnostics,
      errorCode: normalizedError.code,
    },
    logEntry: {
      entryId: `${input.execution.executionId}:trace:log:error:${input.execution.runtimeState.errors.length}`,
      level: ExecutionLogLevels.error,
      message: normalizedError.message,
      emittedAt: normalizedError.at,
      nodeId: normalizedError.nodeId,
      diagnostics: normalizedError.diagnostics,
    },
  });
}

export function decideRecoveryAction(input: {
  readonly error: RuntimeExecutionError;
  readonly retryCount: number;
  readonly maxRetries: number;
}): RecoveryDecision {
  const retryCount = Math.max(0, Math.floor(input.retryCount));
  const maxRetries = Math.max(0, Math.floor(input.maxRetries));
  const canRetry = input.error.retriable && retryCount < maxRetries;
  const action = canRetry
    ? (input.error.kind === RuntimeExecutionErrorKinds.iterativeProgressionFailure
      ? RecoveryActionKinds.retryLoopPass
      : RecoveryActionKinds.retryStep)
    : RecoveryActionKinds.failExecution;

  return Object.freeze({
    action,
    reason: canRetry
      ? `bounded-retry-${retryCount + 1}-of-${maxRetries}`
      : "unrecoverable-or-retry-budget-exhausted",
    decidedAt: input.error.at,
    retryCount,
    maxRetries,
  });
}

export function propagateExecutionFailure(input: {
  readonly execution: SystemExecution;
  readonly error: RuntimeExecutionError;
  readonly decision: RecoveryDecision;
  readonly updatedAt: string;
  readonly completedAt?: string;
}): SystemExecution {
  const withError = appendRuntimeExecutionError({
    execution: input.execution,
    error: input.error,
  });
  const withDecision = appendExecutionTraceEvent({
    execution: withError,
    event: {
      eventId: `${input.execution.executionId}:trace:event:recovery:${withError.runtimeState.trace.events.length}`,
      kind: ExecutionTraceEventKinds.recoveryDecided,
      at: input.updatedAt,
      executionId: input.execution.executionId,
      nodeId: input.error.nodeId,
      summary: `Recovery action '${input.decision.action}' selected.`,
      diagnostics: Object.freeze([input.decision.reason]),
      errorCode: input.error.code,
    },
    logEntry: {
      entryId: `${input.execution.executionId}:trace:log:recovery:${withError.runtimeState.trace.logs.length}`,
      level: input.decision.action === RecoveryActionKinds.failExecution ? ExecutionLogLevels.error : ExecutionLogLevels.warning,
      message: `Recovery decision '${input.decision.action}' for error '${input.error.code}'.`,
      emittedAt: input.updatedAt,
      nodeId: input.error.nodeId,
      diagnostics: Object.freeze([input.decision.reason]),
    },
  });

  if (input.decision.action !== RecoveryActionKinds.failExecution) {
    return withDecision;
  }

  return transitionSystemExecutionStatus({
    execution: withDecision,
    nextStatus: ExecutionStatusKinds.failed,
    updatedAt: input.updatedAt,
    completedAt: input.completedAt ?? input.updatedAt,
    output: Object.freeze({
      producedAt: input.updatedAt,
      error: Object.freeze({
        code: input.error.code,
        message: input.error.message,
      }),
    }),
  });
}
