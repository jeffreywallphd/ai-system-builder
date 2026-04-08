import { ComfyUiTransportClientError } from "../comfyui/ComfyUiTransportClient";

const timeoutTokens = Object.freeze([
  "timeout",
  "timed out",
  "deadline",
  "request-timeout",
  "gateway timeout",
]);

const connectivityTokens = Object.freeze([
  "econn",
  "network",
  "unreachable",
  "offline",
  "connection",
  "dns",
  "socket",
  "reset by peer",
]);

const capacityTokens = Object.freeze([
  "capacity",
  "queue full",
  "too many requests",
  "rate limit",
  "throttle",
  "overloaded",
  "busy",
]);

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function extractStatusCode(error: unknown): number | undefined {
  if (error instanceof ComfyUiTransportClientError) {
    return typeof error.diagnostics.statusCode === "number" ? error.diagnostics.statusCode : undefined;
  }

  const asRecord = (typeof error === "object" && error !== null)
    ? (error as Record<string, unknown>)
    : undefined;
  const statusCode = asRecord?.statusCode;
  if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
    return statusCode;
  }
  const status = asRecord?.status;
  if (typeof status === "number" && Number.isFinite(status)) {
    return status;
  }
  return undefined;
}

function includesAny(text: string, tokens: ReadonlyArray<string>): boolean {
  for (const token of tokens) {
    if (text.includes(token)) {
      return true;
    }
  }
  return false;
}

function classifyDispatchError(input: {
  readonly message: string;
  readonly code?: string;
  readonly statusCode?: number;
}): {
  readonly code: string;
  readonly retryable: boolean;
} {
  const text = `${input.code ?? ""} ${input.message}`.toLowerCase();
  if (
    input.statusCode === 408
    || input.statusCode === 429
    || input.statusCode === 502
    || input.statusCode === 503
    || input.statusCode === 504
    || includesAny(text, timeoutTokens)
  ) {
    return Object.freeze({
      code: "dispatch-timeout",
      retryable: true,
    });
  }

  if (includesAny(text, connectivityTokens)) {
    return Object.freeze({
      code: "dispatch-connectivity-failed",
      retryable: true,
    });
  }

  if (input.statusCode === 429 || includesAny(text, capacityTokens)) {
    return Object.freeze({
      code: "dispatch-capacity-limited",
      retryable: true,
    });
  }

  return Object.freeze({
    code: "dispatch-execution-failed",
    retryable: false,
  });
}

function resolveMessage(error: unknown): string {
  if (error instanceof Error) {
    return normalizeOptional(error.message) ?? "Dispatch failed with an unknown adapter error.";
  }
  if (typeof error === "string") {
    return normalizeOptional(error) ?? "Dispatch failed with an unknown adapter error.";
  }
  const candidate = (typeof error === "object" && error !== null)
    ? (error as { message?: unknown }).message
    : undefined;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return "Dispatch failed with an unknown adapter error.";
}

function resolveInternalCode(error: unknown): string | undefined {
  const asRecord = (typeof error === "object" && error !== null)
    ? (error as Record<string, unknown>)
    : undefined;
  return typeof asRecord?.code === "string" ? normalizeOptional(asRecord.code) : undefined;
}

export class RunExecutionDispatchAdapterError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  public constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
    readonly cause?: unknown;
  }) {
    super(input.message);
    this.name = "RunExecutionDispatchAdapterError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.cause = input.cause;
  }
}

export function normalizeRunExecutionDispatchAdapterError(error: unknown): RunExecutionDispatchAdapterError {
  if (error instanceof RunExecutionDispatchAdapterError) {
    return error;
  }

  const message = resolveMessage(error);
  const internalCode = resolveInternalCode(error);
  const statusCode = extractStatusCode(error);
  const classified = classifyDispatchError({
    message,
    code: internalCode,
    statusCode,
  });

  return new RunExecutionDispatchAdapterError({
    code: internalCode ?? classified.code,
    message,
    retryable: classified.retryable,
    cause: error,
  });
}
