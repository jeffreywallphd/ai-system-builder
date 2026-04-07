export type RuntimeLogVerbosity = "normal" | "verbose";

export interface RuntimeDiagnosticCause {
  readonly message: string;
  readonly name?: string;
  readonly stack?: string;
}

export interface RuntimeDiagnostics {
  readonly message: string;
  readonly stack?: string;
  readonly name?: string;
  readonly cause?: string;
  readonly causeChain: ReadonlyArray<RuntimeDiagnosticCause>;
  readonly subsystem?: string;
  readonly className?: string;
  readonly methodName?: string;
  readonly target?: string;
  readonly requestMethod?: string;
  readonly operation?: string;
  readonly failedBeforeResponse?: boolean;
  readonly details?: unknown;
  readonly statusCode?: number;
}

export interface RuntimeDiagnosticsContext {
  readonly message?: string;
  readonly subsystem?: string;
  readonly className?: string;
  readonly methodName?: string;
  readonly target?: string;
  readonly requestMethod?: string;
  readonly operation?: string;
  readonly failedBeforeResponse?: boolean;
  readonly details?: unknown;
  readonly statusCode?: number;
}

interface RuntimeDiagnosticsCarrier {
  readonly diagnostics?: RuntimeDiagnostics;
  readonly details?: unknown;
  readonly statusCode?: number;
  readonly cause?: unknown;
  readonly name?: string;
  readonly message?: string;
  readonly stack?: string;
}

const MAX_CAUSE_DEPTH = 8;
const STACK_PREVIEW_LINES = 3;

export function bindSafeFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    Reflect.apply(fetchImpl as unknown as (...args: unknown[]) => Promise<Response>, globalThis, [input, init])) as typeof fetch;
}

export function normalizeRuntimeError(error: unknown, context: RuntimeDiagnosticsContext = {}): RuntimeDiagnostics {
  const carrier = isObject(error) ? (error as RuntimeDiagnosticsCarrier) : undefined;
  const existing = carrier?.diagnostics;
  const message = context.message ?? existing?.message ?? readErrorMessage(error) ?? "Unexpected runtime failure.";
  const stack = existing?.stack ?? readErrorStack(error);
  const causeChain = existing?.causeChain?.length
    ? existing.causeChain
    : collectCauseChain(error, undefined);
  const cause = existing?.cause ?? causeChain.find((entry) => entry.message !== message)?.message ?? readErrorMessage(readErrorCause(error));

  return Object.freeze({
    message,
    stack,
    name: existing?.name ?? readErrorName(error),
    cause,
    causeChain,
    subsystem: context.subsystem ?? existing?.subsystem,
    className: context.className ?? existing?.className,
    methodName: context.methodName ?? existing?.methodName,
    target: context.target ?? existing?.target,
    requestMethod: context.requestMethod ?? existing?.requestMethod,
    operation: context.operation ?? existing?.operation,
    failedBeforeResponse: context.failedBeforeResponse ?? existing?.failedBeforeResponse,
    details: context.details ?? carrier?.details ?? existing?.details,
    statusCode: context.statusCode ?? carrier?.statusCode ?? existing?.statusCode,
  });
}

export function buildRuntimeDiagnosticSummary(diagnostics?: RuntimeDiagnostics): string | undefined {
  if (!diagnostics) {
    return undefined;
  }

  const parts: string[] = [];
  if (diagnostics.statusCode !== undefined) {
    parts.push(`status ${diagnostics.statusCode}`);
  }
  const primaryCause = diagnostics.causeChain.find((entry) => entry.message !== diagnostics.message)?.message
    ?? diagnostics.cause
    ?? diagnostics.message;
  if (primaryCause) {
    parts.push(primaryCause);
  }
  if (diagnostics.operation) {
    parts.push(diagnostics.operation);
  }

  const detailSummary = summarizeUnknown(diagnostics.details);
  if (detailSummary) {
    parts.push(detailSummary);
  }

  return parts.length > 0 ? parts.join(" • ") : undefined;
}

export function buildRuntimeStackPreview(stack?: string): string | undefined {
  if (!stack) {
    return undefined;
  }

  const lines = stack
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, STACK_PREVIEW_LINES);

  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function toRuntimeDiagnosticDetails(
  error: unknown,
  context: RuntimeDiagnosticsContext,
  baseDetails: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...baseDetails,
    diagnostics: normalizeRuntimeError(error, context),
  });
}

function collectCauseChain(
  cause: unknown,
  fallback: ReadonlyArray<RuntimeDiagnosticCause> | undefined,
): ReadonlyArray<RuntimeDiagnosticCause> {
  if (!cause) {
    return fallback ? Object.freeze([...fallback]) : Object.freeze([]);
  }

  const chain: RuntimeDiagnosticCause[] = [];
  let current: unknown = cause;
  let depth = 0;

  while (current !== undefined && current !== null && depth < MAX_CAUSE_DEPTH) {
    if (isRuntimeDiagnosticCause(current)) {
      chain.push(Object.freeze({
        message: current.message,
        name: current.name,
        stack: current.stack,
      }));
      current = isObject(current) && "cause" in current ? current.cause : undefined;
      depth += 1;
      continue;
    }

    const message = readErrorMessage(current);
    if (!message) {
      break;
    }

    chain.push(Object.freeze({
      message,
      name: readErrorName(current),
      stack: readErrorStack(current),
    }));
    current = readErrorCause(current);
    depth += 1;
  }

  if (chain.length === 0 && fallback) {
    return Object.freeze([...fallback]);
  }

  return Object.freeze(chain);
}

function summarizeUnknown(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return undefined;
    }
    return serialized.length > 180 ? `${serialized.slice(0, 177)}…` : serialized;
  } catch {
    return String(value);
  }
}

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }

  return undefined;
}

function readErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }

  if (isObject(error) && typeof error.stack === "string") {
    return error.stack;
  }

  return undefined;
}

function readErrorName(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name;
  }

  if (isObject(error) && typeof error.name === "string") {
    return error.name;
  }

  return undefined;
}

function readErrorCause(error: unknown): unknown {
  if (error instanceof Error) {
    return error.cause;
  }

  if (isObject(error) && "cause" in error) {
    return error.cause;
  }

  return undefined;
}

function isRuntimeDiagnosticCause(value: unknown): value is RuntimeDiagnosticCause {
  return isObject(value) && typeof value.message === "string";
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
