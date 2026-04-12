export const ExecutionCallbackEventKinds = Object.freeze({
  executionAccepted: "execution-accepted",
  executionCompleted: "execution-completed",
  executionFailed: "execution-failed",
});

export type ExecutionCallbackEventKind = typeof ExecutionCallbackEventKinds[keyof typeof ExecutionCallbackEventKinds];

export interface ExecutionCallbackRegistration {
  readonly callbackId: string;
  readonly targetUrl: string;
  readonly eventKinds: ReadonlyArray<ExecutionCallbackEventKind>;
  readonly secretToken?: string;
  readonly includeResultSummary: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly registeredAt: string;
  readonly maxAttempts: number;
}

export interface ExecutionCallbackDeliveryResult {
  readonly callbackId: string;
  readonly eventKind: ExecutionCallbackEventKind;
  readonly executionId: string;
  readonly deliveredAt: string;
  readonly attemptCount: number;
  readonly succeeded: boolean;
  readonly statusCode?: number;
  readonly message: string;
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

function normalizeEventKinds(eventKinds?: ReadonlyArray<ExecutionCallbackEventKind>): ReadonlyArray<ExecutionCallbackEventKind> {
  const fallback: ReadonlyArray<ExecutionCallbackEventKind> = Object.freeze([
    ExecutionCallbackEventKinds.executionAccepted,
    ExecutionCallbackEventKinds.executionCompleted,
    ExecutionCallbackEventKinds.executionFailed,
  ]);
  if (!eventKinds || eventKinds.length === 0) {
    return fallback;
  }
  const normalized = [...new Set(eventKinds)];
  return Object.freeze(normalized);
}

function normalizeHeaders(headers?: Readonly<Record<string, string>>): Readonly<Record<string, string>> | undefined {
  if (!headers) {
    return undefined;
  }
  const entries = Object.entries(headers)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => Boolean(key) && Boolean(value));
  return entries.length > 0
    ? Object.freeze(Object.fromEntries(entries))
    : undefined;
}

export function createExecutionCallbackRegistration(input: {
  readonly callbackId?: string;
  readonly targetUrl: string;
  readonly eventKinds?: ReadonlyArray<ExecutionCallbackEventKind>;
  readonly secretToken?: string;
  readonly includeResultSummary?: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly maxAttempts?: number;
  readonly now?: string;
}): ExecutionCallbackRegistration {
  const now = normalizeOptional(input.now) ?? new Date().toISOString();
  const callbackId = normalizeOptional(input.callbackId) ?? `exec-callback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const maxAttempts = Number.isFinite(input.maxAttempts) && (input.maxAttempts as number) > 0
    ? Math.min(3, Math.floor(input.maxAttempts as number))
    : 1;

  return Object.freeze({
    callbackId,
    targetUrl: normalizeRequired(input.targetUrl, "Callback targetUrl"),
    eventKinds: normalizeEventKinds(input.eventKinds),
    secretToken: normalizeOptional(input.secretToken),
    includeResultSummary: input.includeResultSummary ?? true,
    headers: normalizeHeaders(input.headers),
    registeredAt: now,
    maxAttempts,
  });
}
