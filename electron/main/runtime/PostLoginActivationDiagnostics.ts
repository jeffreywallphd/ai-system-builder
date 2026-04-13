type PostLoginActivationDiagnosticLogger = {
  readonly info: (message?: unknown, ...optionalParams: unknown[]) => void;
  readonly error: (message?: unknown, ...optionalParams: unknown[]) => void;
};

type PostLoginActivationDiagnosticLevel = "info" | "error";

type PostLoginActivationDiagnosticPayload = {
  readonly event: string;
  readonly stageId?: string;
  readonly durationMs?: number;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly triggerSource?: string;
  readonly activationMode?: string;
  readonly requestedAt?: string;
  readonly retryable?: boolean;
  readonly preserveControlPlaneListener?: boolean;
  readonly blockingDependency?: string;
  readonly blockingStageId?: string;
  readonly detail?: string;
  readonly dependencies?: ReadonlyArray<string>;
  readonly errorName?: string;
  readonly errorMessage?: string;
  readonly errorCause?: string;
};

type PostLoginActivationDiagnosticInput = {
  readonly logger?: PostLoginActivationDiagnosticLogger;
  readonly level?: PostLoginActivationDiagnosticLevel;
  readonly payload: PostLoginActivationDiagnosticPayload;
};

export function logPostLoginActivationDiagnostic(input: PostLoginActivationDiagnosticInput): void {
  const logger = input.logger ?? console;
  const level = input.level ?? "info";
  const message = formatPostLoginActivationDiagnosticMessage(input.payload);
  if (level === "error") {
    logger.error(message);
    return;
  }
  logger.info(message);
}

export function formatPostLoginActivationDiagnosticMessage(payload: PostLoginActivationDiagnosticPayload): string {
  const output: string[] = ["[ai-loom][startup]"];
  pushField(output, "event", payload.event);
  pushField(output, "stageId", payload.stageId);
  pushField(output, "durationMs", payload.durationMs);
  pushField(output, "startedAt", payload.startedAt);
  pushField(output, "endedAt", payload.endedAt);
  pushField(output, "triggerSource", payload.triggerSource);
  pushField(output, "activationMode", payload.activationMode);
  pushField(output, "requestedAt", payload.requestedAt);
  pushField(output, "retryable", payload.retryable);
  pushField(output, "preserveControlPlaneListener", payload.preserveControlPlaneListener);
  pushField(output, "blockingDependency", payload.blockingDependency);
  pushField(output, "blockingStageId", payload.blockingStageId);
  pushField(output, "detail", payload.detail);
  pushField(output, "dependencies", payload.dependencies);
  pushField(output, "errorName", payload.errorName);
  pushField(output, "errorMessage", payload.errorMessage);
  pushField(output, "errorCause", payload.errorCause);
  return output.join(" ");
}

export function summarizeActivationError(error: unknown): Readonly<{
  errorName: string;
  errorMessage: string;
  errorCause?: string;
}> {
  if (error instanceof Error) {
    return Object.freeze({
      errorName: error.name || "Error",
      errorMessage: error.message || "Post-login activation failed.",
      errorCause: summarizeErrorCause(error.cause),
    });
  }
  if (typeof error === "string") {
    return Object.freeze({
      errorName: "Error",
      errorMessage: error,
    });
  }
  return Object.freeze({
    errorName: "Error",
    errorMessage: String(error),
  });
}

function summarizeErrorCause(cause: unknown): string | undefined {
  if (!cause) {
    return undefined;
  }
  if (cause instanceof Error) {
    return cause.message || cause.name || "Error";
  }
  if (typeof cause === "string") {
    return cause;
  }
  return String(cause);
}

function pushField(output: string[], key: string, value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (typeof value === "string") {
    output.push(`${key}=${JSON.stringify(value)}`);
    return;
  }
  output.push(`${key}=${JSON.stringify(value)}`);
}
