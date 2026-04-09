import { randomUUID } from "node:crypto";
import pino, { type Logger as PinoLogger, type LoggerOptions as PinoLoggerOptions } from "pino";

const DefaultSensitiveKeyPattern =
  /(authorization|cookie|credential|pass(word|phrase)?|private[-_]?key|secret|session|token|api[-_]?key)/i;
const BearerTokenPattern = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const SecretAssignmentPattern =
  /\b(token|secret|password|passphrase|api[-_]?key|authorization|cookie|credential)\s*[:=]\s*([^\s,;]+)/gi;
const RedactedValue = "[REDACTED]";
const DefaultMaximumRedactionDepth = 8;
const DefaultMaximumArrayLength = 50;

type StartupSpanLogLevel = "info" | "error";

export interface StartupSpanLogger {
  info(payload: Readonly<Record<string, unknown>>): void;
  error(payload: Readonly<Record<string, unknown>>): void;
  warn?(payload: Readonly<Record<string, unknown>>): void;
}

export interface StartupSpanRedactionOptions {
  readonly sensitiveKeyPattern?: RegExp;
  readonly maximumDepth?: number;
  readonly maximumArrayLength?: number;
}

export interface StartupTracerOptions {
  readonly logger?: StartupSpanLogger;
  readonly traceId?: string;
  readonly startupReason?: string;
  readonly slowSpanThresholdMs?: number;
  readonly slowSpanWarnings?: StartupSpanSlowWarningOptions;
  readonly pino?: {
    readonly options?: PinoLoggerOptions;
  };
  readonly redaction?: StartupSpanRedactionOptions;
  readonly clock?: () => number;
}

export interface StartupSpanSlowWarningOptions {
  readonly defaultThresholdMs?: number;
  readonly thresholdsBySpanName?: Readonly<Record<string, number>>;
}

export interface StartupSpanOptions {
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StartupSpan {
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly hierarchy: ReadonlyArray<string>;
  readonly startedAt: string;
  readonly depth: number;
  startChild(name: string, options?: StartupSpanOptions): StartupSpan;
  complete(options?: StartupSpanOptions): void;
  fail(error: unknown, options?: StartupSpanOptions): void;
}

export interface StartupTracer {
  readonly traceId: string;
  startSpan(name: string, options?: StartupSpanOptions): StartupSpan;
  runInSpan<TResult>(
    name: string,
    run: (span: StartupSpan) => Promise<TResult> | TResult,
    options?: StartupSpanOptions,
  ): Promise<TResult>;
}

export interface StartupSpanPinoLoggerOptions {
  readonly traceId: string;
  readonly startupReason?: string;
  readonly pino?: {
    readonly options?: PinoLoggerOptions;
  };
}

const DefaultPinoRedactionPaths = Object.freeze([
  "*.authorization",
  "*.cookie",
  "*.credential",
  "*.password",
  "*.passphrase",
  "*.privateKey",
  "*.private_key",
  "*.secret",
  "*.session",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.authToken",
  "*.auth_token",
  "*.metadata.authorization",
  "*.metadata.cookie",
  "*.metadata.credential",
  "*.metadata.password",
  "*.metadata.passphrase",
  "*.metadata.privateKey",
  "*.metadata.private_key",
  "*.metadata.secret",
  "*.metadata.session",
  "*.metadata.token",
  "*.metadata.apiKey",
  "*.metadata.api_key",
  "*.metadata.authToken",
  "*.metadata.auth_token",
  "*.error.stack",
]);

interface StartupTracerRuntimeState {
  readonly traceId: string;
  readonly startupReason?: string;
  readonly slowSpanThresholdMs: number;
  readonly slowSpanWarnings: Required<StartupSpanSlowWarningOptions>;
  readonly logger: StartupSpanLogger;
  readonly redaction: Required<StartupSpanRedactionOptions>;
  readonly clock: () => number;
  spanCounter: number;
}

class StartupTracerSpan implements StartupSpan {
  public readonly spanId: string;
  public readonly parentSpanId: string | undefined;
  public readonly name: string;
  public readonly hierarchy: ReadonlyArray<string>;
  public readonly startedAt: string;
  public readonly depth: number;

  private readonly startedAtMilliseconds: number;
  private metadata: Readonly<Record<string, unknown>> | undefined;
  private ended = false;

  public constructor(
    private readonly state: StartupTracerRuntimeState,
    private readonly parent: StartupTracerSpan | undefined,
    name: string,
    options?: StartupSpanOptions,
  ) {
    this.spanId = `${state.traceId}:${++state.spanCounter}`;
    this.parentSpanId = parent?.spanId;
    this.name = redactString(normalizeRequired(name, "Startup span name"));
    this.hierarchy = Object.freeze([...(parent?.hierarchy ?? []), this.name]);
    this.depth = this.hierarchy.length - 1;
    this.startedAtMilliseconds = this.state.clock();
    this.startedAt = new Date(this.startedAtMilliseconds).toISOString();
    this.metadata = sanitizeMetadata(options?.metadata, this.state.redaction);
  }

  public startChild(name: string, options?: StartupSpanOptions): StartupSpan {
    return new StartupTracerSpan(this.state, this, name, options);
  }

  public complete(options?: StartupSpanOptions): void {
    this.finalize("info", "completed", undefined, options?.metadata);
  }

  public fail(error: unknown, options?: StartupSpanOptions): void {
    this.finalize("error", "failed", error, options?.metadata);
  }

  private finalize(
    level: StartupSpanLogLevel,
    outcome: "completed" | "failed",
    error: unknown,
    metadata: Readonly<Record<string, unknown>> | undefined,
  ): void {
    if (this.ended) {
      return;
    }
    this.ended = true;

    const endedAtMilliseconds = this.state.clock();
    const endedAt = new Date(endedAtMilliseconds).toISOString();
    const durationMs = Math.max(0, endedAtMilliseconds - this.startedAtMilliseconds);
    const slow = durationMs > this.state.slowSpanThresholdMs;
    const slowWarningThresholdMs = resolveSlowWarningThresholdMs(this.state.slowSpanWarnings, this.name);
    const slowWarning = durationMs > slowWarningThresholdMs;
    const mergedMetadata = mergeMetadata(this.metadata, sanitizeMetadata(metadata, this.state.redaction));
    const event = Object.freeze({
      event: `startup.span.${outcome}`,
      traceId: this.state.traceId,
      startupReason: this.state.startupReason,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      spanName: this.name,
      spanDepth: this.depth,
      spanHierarchy: this.hierarchy,
      spanHierarchyPath: this.hierarchy.join(" > "),
      startedAt: this.startedAt,
      endedAt,
      durationMs,
      slow,
      slowSpanThresholdMs: this.state.slowSpanThresholdMs,
      slowWarning,
      slowWarningThresholdMs,
      metadata: mergedMetadata,
      errorTagged: outcome === "failed",
      error: outcome === "failed" ? sanitizeError(error, this.state.redaction) : undefined,
    } satisfies Readonly<Record<string, unknown>>);

    this.state.logger[level](event);
    if (slowWarning) {
      this.emitSlowWarningEvent({
        outcome,
        endedAt,
        durationMs,
        slowWarningThresholdMs,
        metadata: mergedMetadata,
        error,
      });
    }
  }

  private emitSlowWarningEvent(input: {
    readonly outcome: "completed" | "failed";
    readonly endedAt: string;
    readonly durationMs: number;
    readonly slowWarningThresholdMs: number;
    readonly metadata: Readonly<Record<string, unknown>> | undefined;
    readonly error: unknown;
  }): void {
    const event = Object.freeze({
      event: "startup.span.slow",
      traceId: this.state.traceId,
      startupReason: this.state.startupReason,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      spanName: this.name,
      spanDepth: this.depth,
      spanHierarchy: this.hierarchy,
      spanHierarchyPath: this.hierarchy.join(" > "),
      startedAt: this.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      slowWarningThresholdMs: input.slowWarningThresholdMs,
      thresholdExceededByMs: input.durationMs - input.slowWarningThresholdMs,
      spanOutcome: input.outcome,
      metadata: input.metadata,
      errorTagged: input.outcome === "failed",
      error: input.outcome === "failed" ? sanitizeError(input.error, this.state.redaction) : undefined,
    } satisfies Readonly<Record<string, unknown>>);

    if (this.state.logger.warn) {
      this.state.logger.warn(event);
      return;
    }
    this.state.logger.info(event);
  }
}

export function createStartupSpanPinoLogger(options: StartupSpanPinoLoggerOptions): StartupSpanLogger {
  const logger = pino({
    level: "info",
    name: "ai-loom.startup",
    base: undefined,
    redact: {
      paths: [...DefaultPinoRedactionPaths],
      censor: RedactedValue,
    },
    ...(options.pino?.options ?? {}),
  });
  const childLogger = logger.child(Object.freeze({
    component: "startup-tracer",
    traceId: options.traceId,
    startupReason: options.startupReason,
  }));
  return new StartupSpanPinoLoggerBridge(childLogger);
}

export function createStartupTracer(options: StartupTracerOptions = {}): StartupTracer {
  const traceId = normalizeRequired(options.traceId ?? randomUUID(), "Startup tracer traceId");
  const normalizedStartupReason = normalizeOptional(options.startupReason);
  const startupReason = normalizedStartupReason ? redactString(normalizedStartupReason) : undefined;
  const logger = options.logger ?? createStartupSpanPinoLogger({
    traceId,
    startupReason,
    pino: options.pino,
  });
  const redaction = resolveRedactionOptions(options.redaction);
  const state: StartupTracerRuntimeState = {
    traceId,
    startupReason,
    slowSpanThresholdMs: resolveSlowSpanThresholdMs(options.slowSpanThresholdMs),
    logger,
    redaction,
    clock: options.clock ?? (() => Date.now()),
    slowSpanWarnings: resolveSlowSpanWarningOptions(options.slowSpanWarnings, options.slowSpanThresholdMs),
    spanCounter: 0,
  };

  return Object.freeze({
    traceId: state.traceId,
    startSpan(name: string, spanOptions?: StartupSpanOptions): StartupSpan {
      return new StartupTracerSpan(state, undefined, name, spanOptions);
    },
    async runInSpan<TResult>(
      name: string,
      run: (span: StartupSpan) => Promise<TResult> | TResult,
      spanOptions?: StartupSpanOptions,
    ): Promise<TResult> {
      const span = new StartupTracerSpan(state, undefined, name, spanOptions);
      try {
        const result = await run(span);
        span.complete();
        return result;
      } catch (error) {
        span.fail(error);
        throw error;
      }
    },
  });
}

class StartupSpanPinoLoggerBridge implements StartupSpanLogger {
  public constructor(private readonly logger: PinoLogger) {}

  public info(payload: Readonly<Record<string, unknown>>): void {
    this.logger.info(payload);
  }

  public error(payload: Readonly<Record<string, unknown>>): void {
    this.logger.error(payload);
  }

  public warn(payload: Readonly<Record<string, unknown>>): void {
    this.logger.warn(payload);
  }
}

function resolveRedactionOptions(options: StartupSpanRedactionOptions | undefined): Required<StartupSpanRedactionOptions> {
  return Object.freeze({
    sensitiveKeyPattern: options?.sensitiveKeyPattern ?? DefaultSensitiveKeyPattern,
    maximumDepth: options?.maximumDepth ?? DefaultMaximumRedactionDepth,
    maximumArrayLength: options?.maximumArrayLength ?? DefaultMaximumArrayLength,
  });
}

function mergeMetadata(
  base: Readonly<Record<string, unknown>> | undefined,
  additional: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!base && !additional) {
    return undefined;
  }
  return Object.freeze({
    ...(base ?? {}),
    ...(additional ?? {}),
  });
}

function sanitizeMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  redaction: Required<StartupSpanRedactionOptions>,
): Readonly<Record<string, unknown>> | undefined {
  if (!metadata) {
    return undefined;
  }
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    output[key] = sanitizeEntry(key, value, redaction, 0);
  }
  return Object.freeze(output);
}

function sanitizeEntry(
  key: string,
  value: unknown,
  redaction: Required<StartupSpanRedactionOptions>,
  depth: number,
): unknown {
  if (redaction.sensitiveKeyPattern.test(key)) {
    return RedactedValue;
  }
  return sanitizeUnknown(value, redaction, depth);
}

function sanitizeUnknown(
  value: unknown,
  redaction: Required<StartupSpanRedactionOptions>,
  depth: number,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (depth >= redaction.maximumDepth) {
    return "[REDACTION_DEPTH_LIMIT]";
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return Object.freeze(
      value
        .slice(0, redaction.maximumArrayLength)
        .map((entry) => sanitizeUnknown(entry, redaction, depth + 1)),
    );
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      output[entryKey] = sanitizeEntry(entryKey, entryValue, redaction, depth + 1);
    }
    return Object.freeze(output);
  }
  return String(value);
}

function sanitizeError(
  error: unknown,
  redaction: Required<StartupSpanRedactionOptions>,
): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    return Object.freeze({
      name: error.name,
      message: redactString(error.message),
      stack: error.stack ? redactString(error.stack) : undefined,
      details: sanitizeUnknown(error, redaction, 0),
    });
  }
  if (typeof error === "string") {
    return Object.freeze({
      name: "Error",
      message: redactString(error),
    });
  }
  return Object.freeze({
    name: "Error",
    message: redactString(String(error)),
    details: sanitizeUnknown(error, redaction, 0),
  });
}

function redactString(value: string): string {
  let output = value;
  output = output.replace(BearerTokenPattern, "Bearer [REDACTED]");
  output = output.replace(SecretAssignmentPattern, "$1=[REDACTED]");
  return output;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveSlowSpanThresholdMs(value: number | undefined): number {
  if (value === undefined) {
    return 5_000;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Startup tracer slowSpanThresholdMs must be a positive finite number.");
  }
  return Math.floor(value);
}

function resolveSlowSpanWarningOptions(
  options: StartupSpanSlowWarningOptions | undefined,
  fallbackThresholdMs: number | undefined,
): Required<StartupSpanSlowWarningOptions> {
  const thresholdBaseline = resolveSlowSpanThresholdMs(fallbackThresholdMs);
  const defaultThresholdMs = resolveSlowSpanThresholdMs(options?.defaultThresholdMs ?? thresholdBaseline);
  const thresholdsBySpanName: Record<string, number> = {};
  for (const [rawSpanName, rawThreshold] of Object.entries(options?.thresholdsBySpanName ?? {})) {
    const spanName = normalizeRequired(rawSpanName, "Startup tracer slowSpanWarnings spanName");
    thresholdsBySpanName[spanName] = resolveSlowSpanThresholdMs(rawThreshold);
  }
  return Object.freeze({
    defaultThresholdMs,
    thresholdsBySpanName: Object.freeze(thresholdsBySpanName),
  });
}

function resolveSlowWarningThresholdMs(
  slowSpanWarnings: Required<StartupSpanSlowWarningOptions>,
  spanName: string,
): number {
  return slowSpanWarnings.thresholdsBySpanName[spanName] ?? slowSpanWarnings.defaultThresholdMs;
}
