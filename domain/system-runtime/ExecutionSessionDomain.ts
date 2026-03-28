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
