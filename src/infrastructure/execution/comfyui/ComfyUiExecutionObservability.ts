import { sanitizePersistenceDiagnostics } from "@infrastructure/logging/PersistenceRedaction";
import {
  createImageManipulationSliceCorrelation,
  deriveImageManipulationResilienceDiagnostics,
  IMAGE_MANIPULATION_SLICE_NAME,
  type ImageManipulationSliceCorrelation,
  type ImageManipulationSliceResilienceDiagnostic,
} from "@infrastructure/logging/ImageManipulationSliceDiagnostics";
import type {
  ComfyUiTransportLogEvent,
  ComfyUiTransportLogger,
} from "./ComfyUiTransportClient";

export interface ComfyUiExecutionObservabilityEvent {
  readonly slice: typeof IMAGE_MANIPULATION_SLICE_NAME;
  readonly scope: "comfyui-execution-adapter";
  readonly event: string;
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly runId?: string;
  readonly executionJobId?: string;
  readonly backendExecutionId?: string;
  readonly translationRequestId?: string;
  readonly dispatchAttemptId?: string;
  readonly correlationId?: string;
  readonly workspaceId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly correlation: Readonly<ImageManipulationSliceCorrelation>;
  readonly resilience?: ReadonlyArray<ImageManipulationSliceResilienceDiagnostic>;
}

export interface ComfyUiExecutionObservabilityLogger {
  info(event: ComfyUiExecutionObservabilityEvent): void;
  warn(event: ComfyUiExecutionObservabilityEvent): void;
  error(event: ComfyUiExecutionObservabilityEvent): void;
}

export interface ComfyUiExecutionObservabilityOptions {
  readonly logger?: ComfyUiExecutionObservabilityLogger;
  readonly now?: () => Date;
}

export class ComfyUiExecutionObservability {
  private readonly logger: ComfyUiExecutionObservabilityLogger;
  private readonly now: () => Date;

  public constructor(options: ComfyUiExecutionObservabilityOptions = {}) {
    this.logger = options.logger ?? new ConsoleComfyUiExecutionObservabilityLogger();
    this.now = options.now ?? (() => new Date());
  }

  public record(event: Omit<ComfyUiExecutionObservabilityEvent, "scope" | "occurredAt" | "slice" | "correlation"> & {
    readonly occurredAt?: string;
  }): void {
    const correlation = createImageManipulationSliceCorrelation({
      correlationId: normalizeText(event.correlationId),
      workspaceId: normalizeText(event.workspaceId),
      runId: normalizeText(event.runId),
      nodeId: normalizeText(event.dispatchAttemptId),
      executionJobId: normalizeText(event.executionJobId),
      backendExecutionId: normalizeText(event.backendExecutionId),
      requestId: normalizeText(event.translationRequestId)
        ?? normalizeText(event.dispatchAttemptId)
        ?? normalizeText(event.executionJobId)
        ?? normalizeText(event.backendExecutionId)
        ?? normalizeText(event.runId),
    });
    const resilience = event.resilience
      ?? (event.severity === "warn" || event.severity === "error"
        ? deriveImageManipulationResilienceDiagnostics({
          details: event.details,
          defaultCode: `comfyui-${event.event}`,
          defaultSummary: event.severity === "error"
            ? "ComfyUI execution adapter reported an operational failure."
            : "ComfyUI execution adapter reported a degraded or warning condition.",
          defaultCategory: event.severity === "error" ? "operational" : "degraded",
          defaultRetryable: event.severity === "warn",
          defaultDegraded: event.severity !== "info",
        })
        : undefined);
    const safeEvent = sanitizeComfyUiExecutionObservabilityEvent({
      slice: IMAGE_MANIPULATION_SLICE_NAME,
      scope: "comfyui-execution-adapter",
      event: normalizeText(event.event) ?? "comfyui.adapter.event",
      severity: event.severity,
      occurredAt: normalizeText(event.occurredAt) ?? this.now().toISOString(),
      runId: normalizeText(event.runId),
      executionJobId: normalizeText(event.executionJobId),
      backendExecutionId: normalizeText(event.backendExecutionId),
      translationRequestId: normalizeText(event.translationRequestId),
      dispatchAttemptId: normalizeText(event.dispatchAttemptId),
      correlationId: normalizeText(event.correlationId),
      workspaceId: normalizeText(event.workspaceId),
      details: event.details,
      correlation,
      resilience,
    });

    if (safeEvent.severity === "error") {
      this.logger.error(safeEvent);
      return;
    }
    if (safeEvent.severity === "warn") {
      this.logger.warn(safeEvent);
      return;
    }
    this.logger.info(safeEvent);
  }
}

export class NoOpComfyUiExecutionObservabilityLogger implements ComfyUiExecutionObservabilityLogger {
  public info(_event: ComfyUiExecutionObservabilityEvent): void {}
  public warn(_event: ComfyUiExecutionObservabilityEvent): void {}
  public error(_event: ComfyUiExecutionObservabilityEvent): void {}
}

export function sanitizeComfyUiExecutionObservabilityEvent<TValue>(value: TValue): TValue {
  const baseline = sanitizePersistenceDiagnostics(value);
  return deepFreeze(redactComfyExecutionUnsafeFields(baseline)) as TValue;
}

export function createComfyUiTransportLoggerBridge(
  observability: ComfyUiExecutionObservability,
): ComfyUiTransportLogger {
  return {
    log(event: ComfyUiTransportLogEvent): void {
      observability.record({
        event: `transport.${event.event}`,
        severity: event.event === "request-failed" ? "warn" : "info",
        backendExecutionId: normalizeText(event.promptId),
        details: Object.freeze({
          operation: event.operation,
          statusCode: event.statusCode,
          durationMs: event.durationMs,
          errorCode: event.errorCode,
          ...(event.details ?? {}),
        }),
      });
    },
  };
}

class ConsoleComfyUiExecutionObservabilityLogger implements ComfyUiExecutionObservabilityLogger {
  public info(event: ComfyUiExecutionObservabilityEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: ComfyUiExecutionObservabilityEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: ComfyUiExecutionObservabilityEvent): void {
    console.error(JSON.stringify(event));
  }
}

const SensitiveFieldPattern = /(prompt|payload|request|response|token|secret|credential|authorization|cookie|path|file|directory|storage|subfolder|filename|object[-_]?handle|logical[-_]?reference|asset[-_]?references|input[-_]?parameters|comfy\.request)/i;
const AbsolutePathFragmentPattern = /(?:[A-Za-z]:[\\/]|\\\\|\/[^/\s]+)/;
const RedactedValue = "[REDACTED]";

function redactComfyExecutionUnsafeFields(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return AbsolutePathFragmentPattern.test(value) ? RedactedValue : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactComfyExecutionUnsafeFields(entry));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveFieldPattern.test(key)) {
        output[key] = RedactedValue;
        continue;
      }
      output[key] = redactComfyExecutionUnsafeFields(nested);
    }
    return output;
  }
  return String(value);
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const nested of value) {
      deepFreeze(nested);
    }
    return Object.freeze(value);
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}
