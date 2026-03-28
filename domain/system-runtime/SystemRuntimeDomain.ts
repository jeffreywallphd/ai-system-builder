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

export interface SystemExecution {
  readonly executionId: string;
  readonly root: ExecutionAssetRef;
  readonly context: ExecutionContext;
  readonly environment?: ExecutionEnvironmentRef;
  readonly status: ExecutionStatusKind;
  readonly nodes: ReadonlyArray<ExecutionNodeRef>;
  readonly input: ExecutionInputEnvelope;
  readonly output?: ExecutionOutputEnvelope;
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
  readonly startedAt: string;
  readonly updatedAt?: string;
  readonly completedAt?: string;
}): SystemExecution {
  const status = input.status ?? ExecutionStatusKinds.pending;

  return Object.freeze({
    executionId: normalizeRequired(input.executionId, "Execution id"),
    root: normalizeExecutionAssetRef(input.root),
    context: normalizeExecutionContext(input.context),
    environment: normalizeExecutionEnvironmentRef(input.environment),
    status,
    nodes: Object.freeze((input.nodes ?? []).map(normalizeExecutionNodeRef)),
    input: normalizeInputEnvelope(input.input),
    output: input.output ? normalizeOutputEnvelope(input.output) : undefined,
    startedAt: normalizeRequired(input.startedAt, "Execution started timestamp"),
    updatedAt: normalizeRequired(input.updatedAt ?? input.startedAt, "Execution updated timestamp"),
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
