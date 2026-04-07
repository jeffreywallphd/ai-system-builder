import type {
  ComfyAdapterErrorCode,
  ComfyAdapterLifecycleStatus,
  IComfyAdapterError,
  IComfyAdapterExecutionContext,
  IComfyAdapterLifecycleEvent,
} from "@application/execution/comfyui/ComfyAdapterContract";

export type ComfyExecutionFailureStage =
  | "connection"
  | "request-mapping"
  | "execution"
  | "output-normalization"
  | "unknown";

type ComfyFailureClass =
  | "user-correctable"
  | "environment-configuration"
  | "runtime-execution"
  | "partial-completion";

export function mapComfyProgressToLifecycleEvent(progress: {
  readonly promptId: string;
  readonly status: ComfyAdapterLifecycleStatus;
  readonly message?: string;
  readonly queuePosition?: number;
}): IComfyAdapterLifecycleEvent {
  return Object.freeze({
    executionId: progress.promptId,
    status: progress.status,
    percent: toPercent(progress.status),
    message: progress.message,
    queuePosition: progress.queuePosition,
  });
}

export function mapComfyError(
  error: unknown,
  options?: {
    readonly stage?: ComfyExecutionFailureStage;
    readonly context?: IComfyAdapterExecutionContext;
  },
): IComfyAdapterError {
  const message =
    error instanceof Error ? error.message : "Unknown ComfyUI execution error.";

  const normalized = message.toLowerCase();
  const failureClass = classifyFailure(normalized);

  if (options?.stage === "request-mapping") {
    return buildError("request-mapping-failed", message, {
      category: "mapping",
      severity: "error",
      retriable: false,
      context: options.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
  }

  if (options?.stage === "output-normalization") {
    return buildError("output-normalization-failed", message, {
      category: "output",
      severity: "error",
      retriable: false,
      context: options.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
  }

  if (normalized.includes("fetch") || normalized.includes("network") || normalized.includes("econn") || options?.stage === "connection") {
    return buildError("connection-failed", message, {
      category: "connectivity",
      severity: "error",
      retriable: true,
      context: options.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
  }

  if (normalized.includes("timed out")) {
    return buildError("queue-timeout", message, {
      category: "timeout",
      severity: "warning",
      retriable: true,
      context: options?.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
  }

  if (normalized.includes("cancel")) {
    return buildError("execution-cancelled", message, {
      category: "cancellation",
      severity: "info",
      retriable: false,
      context: options?.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
  }

  if (normalized.includes("failed") || normalized.includes("error")) {
    return buildError("execution-failed", message, {
      category: "execution",
      severity: "error",
      retriable: true,
      context: options?.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
  }

  return buildError("unknown", message, {
      category: "unknown",
      severity: "error",
      retriable: false,
      context: options?.context,
      diagnostics: buildDiagnostics(error, options?.stage, failureClass),
    });
}

function toPercent(status: ComfyAdapterLifecycleStatus): number | undefined {
  if (status === "queued") return 5;
  if (status === "running") return 50;
  if (status === "completed") return 100;
  return undefined;
}

function buildError(
  code: ComfyAdapterErrorCode,
  message: string,
  options: {
    readonly category: IComfyAdapterError["category"];
    readonly severity: IComfyAdapterError["severity"];
    readonly retriable: boolean;
    readonly context?: IComfyAdapterExecutionContext;
    readonly diagnostics?: Readonly<Record<string, unknown>>;
  }
): IComfyAdapterError {
  return Object.freeze({
    code,
    message,
    category: options.category,
    severity: options.severity,
    retriable: options.retriable,
    retryable: options.retriable,
    executionRef: Object.freeze({
      executionId: options.context?.identifiers.executionId,
      workflowId: options.context?.identifiers.workflowId,
    }),
    diagnostics: options.diagnostics,
    details: options.diagnostics,
  });
}

function buildDiagnostics(
  error: unknown,
  stage: ComfyExecutionFailureStage | undefined,
  failureClass: ComfyFailureClass,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    stage: stage ?? "unknown",
    failureClass,
    errorType: error instanceof Error ? error.name : typeof error,
    rawMessage: error instanceof Error ? error.message : String(error),
  });
}

function classifyFailure(normalizedMessage: string): ComfyFailureClass {
  if (normalizedMessage.includes("partial output")) {
    return "partial-completion";
  }
  if (
    normalizedMessage.includes("missing model")
    || normalizedMessage.includes("checkpoint")
    || normalizedMessage.includes("missing node")
    || normalizedMessage.includes("invalid prompt")
    || normalizedMessage.includes("invalid parameter")
    || normalizedMessage.includes("validation")
    || normalizedMessage.includes("malformed")
  ) {
    return "user-correctable";
  }
  if (
    normalizedMessage.includes("connection")
    || normalizedMessage.includes("network")
    || normalizedMessage.includes("econn")
    || normalizedMessage.includes("timed out")
  ) {
    return "environment-configuration";
  }
  return "runtime-execution";
}

