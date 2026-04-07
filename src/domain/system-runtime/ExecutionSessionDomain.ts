import {
  createExecutionCallbackRegistration,
  type ExecutionCallbackDeliveryResult,
  type ExecutionCallbackRegistration,
} from "./ExecutionCallbackDomain";

export const ExecutionSessionStatuses = Object.freeze({
  accepted: "accepted",
  running: "running",
  completed: "completed",
  failed: "failed",
});

export type ExecutionSessionStatus = typeof ExecutionSessionStatuses[keyof typeof ExecutionSessionStatuses];

export type ExecutionSessionId = string;

export interface ExecutionSessionContext {
  readonly callerKind: string;
  readonly callerId: string;
  readonly roles?: ReadonlyArray<string>;
  readonly callerSessionId?: string;
  readonly tenantId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionSession {
  readonly sessionId: ExecutionSessionId;
  readonly status: ExecutionSessionStatus;
  readonly context?: ExecutionSessionContext;
  readonly executionIds: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastExecutionId?: string;
  readonly lastError?: {
    readonly code: string;
    readonly message: string;
  };
  readonly callbacks?: ReadonlyArray<ExecutionCallbackRegistration>;
  readonly callbackDeliveries?: ReadonlyArray<ExecutionCallbackDeliveryResult>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeContext(context?: ExecutionSessionContext): ExecutionSessionContext | undefined {
  if (!context) {
    return undefined;
  }
  const callerId = normalizeOptional(context.callerId) ?? "anonymous";
  return Object.freeze({
    callerKind: normalizeOptional(context.callerKind) ?? "anonymous",
    callerId,
    roles: normalizeStringList(context.roles),
    callerSessionId: normalizeOptional(context.callerSessionId),
    tenantId: normalizeOptional(context.tenantId),
    metadata: context.metadata ? Object.freeze({ ...context.metadata }) : undefined,
  });
}

function appendExecutionId(ids: ReadonlyArray<string>, executionId?: string): ReadonlyArray<string> {
  const normalized = normalizeOptional(executionId);
  if (!normalized) {
    return Object.freeze([...ids]);
  }
  return Object.freeze(ids.includes(normalized) ? [...ids] : [...ids, normalized]);
}

export function createExecutionSession(input: {
  readonly sessionId: string;
  readonly context?: ExecutionSessionContext;
  readonly executionId?: string;
  readonly status?: ExecutionSessionStatus;
  readonly now?: string;
}): ExecutionSession {
  const now = normalizeOptional(input.now) ?? new Date().toISOString();
  const sessionId = normalizeOptional(input.sessionId);
  if (!sessionId) {
    throw new Error("Execution session id is required.");
  }

  const status = input.status ?? ExecutionSessionStatuses.accepted;
  return Object.freeze({
    sessionId,
    status,
    context: normalizeContext(input.context),
    executionIds: appendExecutionId([], input.executionId),
    createdAt: now,
    updatedAt: now,
    lastExecutionId: normalizeOptional(input.executionId),
    callbacks: Object.freeze([]),
    callbackDeliveries: Object.freeze([]),
  });
}

export function transitionExecutionSession(input: {
  readonly session: ExecutionSession;
  readonly status: ExecutionSessionStatus;
  readonly executionId?: string;
  readonly now?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}): ExecutionSession {
  const now = normalizeOptional(input.now) ?? new Date().toISOString();
  const executionId = normalizeOptional(input.executionId);
  return Object.freeze({
    ...input.session,
    status: input.status,
    executionIds: appendExecutionId(input.session.executionIds, executionId),
    lastExecutionId: executionId ?? input.session.lastExecutionId,
    updatedAt: now,
    lastError: input.error
      ? Object.freeze({
        code: input.error.code.trim(),
        message: input.error.message.trim(),
      })
      : input.session.lastError,
  });
}

export function registerExecutionSessionCallback(input: {
  readonly session: ExecutionSession;
  readonly callback: {
    readonly callbackId?: string;
    readonly targetUrl: string;
    readonly eventKinds?: ReadonlyArray<ExecutionCallbackRegistration["eventKinds"][number]>;
    readonly secretToken?: string;
    readonly includeResultSummary?: boolean;
    readonly headers?: Readonly<Record<string, string>>;
    readonly maxAttempts?: number;
  };
  readonly now?: string;
}): ExecutionSession {
  const callback = createExecutionCallbackRegistration({
    ...input.callback,
    now: input.now,
  });
  const existing = input.session.callbacks ?? [];
  const filtered = existing.filter((entry) => entry.callbackId !== callback.callbackId && entry.targetUrl !== callback.targetUrl);
  return Object.freeze({
    ...input.session,
    callbacks: Object.freeze([...filtered, callback]),
    updatedAt: input.now?.trim() || new Date().toISOString(),
  });
}

export function appendExecutionSessionCallbackDelivery(input: {
  readonly session: ExecutionSession;
  readonly delivery: ExecutionCallbackDeliveryResult;
  readonly maxEntries?: number;
  readonly now?: string;
}): ExecutionSession {
  const maxEntries = Number.isFinite(input.maxEntries) && (input.maxEntries as number) > 0
    ? Math.floor(input.maxEntries as number)
    : 50;
  const deliveries = [...(input.session.callbackDeliveries ?? []), Object.freeze({ ...input.delivery })];
  const bounded = deliveries.length > maxEntries
    ? deliveries.slice(deliveries.length - maxEntries)
    : deliveries;
  return Object.freeze({
    ...input.session,
    callbackDeliveries: Object.freeze(bounded),
    updatedAt: input.now?.trim() || new Date().toISOString(),
  });
}
