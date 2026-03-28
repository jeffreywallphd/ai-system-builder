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
    });
  }

  return Object.freeze({
    snapshot: normalizeProgressSnapshot(runtimeState.snapshot),
    nodeStates: Object.freeze(runtimeState.nodeStates.map(normalizeNodeState)),
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

  return Object.freeze({
    executionId: normalizeRequired(input.executionId, "Execution id"),
    root: normalizeExecutionAssetRef(input.root),
    context: normalizeExecutionContext(input.context),
    environment: normalizeExecutionEnvironmentRef(input.environment),
    status,
    nodes: Object.freeze((input.nodes ?? []).map(normalizeExecutionNodeRef)),
    input: normalizeInputEnvelope(input.input),
    output: input.output ? normalizeOutputEnvelope(input.output) : undefined,
    runtimeState: normalizeRuntimeState(input.runtimeState, updatedAt),
    startedAt: normalizeRequired(input.startedAt, "Execution started timestamp"),
    updatedAt,
    completedAt: normalizeOptional(input.completedAt),
  });
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
    }),
    updatedAt,
  });
}
