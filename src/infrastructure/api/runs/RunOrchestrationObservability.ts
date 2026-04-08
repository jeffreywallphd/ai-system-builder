import {
  sanitizeRunOrchestrationObservabilityEvent,
} from "./RunOrchestrationObservabilityRedaction";
import {
  createImageManipulationSliceCorrelation,
  deriveImageManipulationResilienceDiagnostics,
  IMAGE_MANIPULATION_SLICE_NAME,
  type ImageManipulationSliceCorrelation,
  type ImageManipulationSliceResilienceDiagnostic,
} from "@infrastructure/logging/ImageManipulationSliceDiagnostics";

export interface RunOrchestrationObservabilityLogEvent {
  readonly slice: typeof IMAGE_MANIPULATION_SLICE_NAME;
  readonly event: string;
  readonly operation:
    | "submission"
    | "scheduling.governance-event"
    | "mutation.cancel"
    | "mutation.retry"
    | "mutation.scheduling-admin.reevaluate-deferred"
    | "mutation.scheduling-admin.release-stale-reservation"
    | "execution-update"
    | "query.list-runs"
    | "query.list-queue-status"
    | "query.list-stale-scheduling-reservations"
    | "query.get-run-detail"
    | "query.get-run-status";
  readonly outcome: "success" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly runId?: string;
  readonly workspaceId?: string;
  readonly nodeId?: string;
  readonly lifecycleState?: string;
  readonly markers?: ReadonlyArray<string>;
  readonly counters?: Readonly<Record<string, number>>;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly correlation: Readonly<ImageManipulationSliceCorrelation>;
  readonly resilience?: ReadonlyArray<ImageManipulationSliceResilienceDiagnostic>;
}

export interface RunOrchestrationMetricsEvent {
  readonly name: string;
  readonly value: number;
  readonly occurredAt: string;
  readonly tags?: Readonly<Record<string, string>>;
}

export interface RunOrchestrationObservabilityLogger {
  info(event: RunOrchestrationObservabilityLogEvent): void;
  warn(event: RunOrchestrationObservabilityLogEvent): void;
  error(event: RunOrchestrationObservabilityLogEvent): void;
}

export interface RunOrchestrationMetricsSink {
  emit(event: RunOrchestrationMetricsEvent): void | Promise<void>;
}

export interface RunOrchestrationObservabilityOptions {
  readonly logger?: RunOrchestrationObservabilityLogger;
  readonly metricsSink?: RunOrchestrationMetricsSink;
}

export class RunOrchestrationObservability {
  private readonly logger: RunOrchestrationObservabilityLogger;
  private readonly metricsSink?: RunOrchestrationMetricsSink;

  public constructor(options: RunOrchestrationObservabilityOptions = {}) {
    this.logger = options.logger ?? new ConsoleRunOrchestrationObservabilityLogger();
    this.metricsSink = options.metricsSink;
  }

  public async record(input: Omit<RunOrchestrationObservabilityLogEvent, "occurredAt" | "slice" | "correlation"> & {
    readonly occurredAt?: string;
  }): Promise<void> {
    const occurredAt = input.occurredAt?.trim() || new Date().toISOString();
    const correlation = createImageManipulationSliceCorrelation({
      requestId: input.requestId,
      correlationId: input.correlationId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      nodeId: input.nodeId,
    });
    const resilience = input.resilience
      ?? (input.outcome === "failure" || input.severity !== "info"
        ? deriveImageManipulationResilienceDiagnostics({
          details: input.details,
          defaultCode: `run-orchestration-${input.operation}-${input.outcome}`,
          defaultSummary: input.outcome === "failure"
            ? "Run orchestration operation failed."
            : "Run orchestration operation completed with degraded or warning posture.",
          defaultCategory: input.outcome === "failure" ? "operational" : "degraded",
          defaultRetryable: input.severity === "warn",
          defaultDegraded: input.outcome !== "success",
        })
        : undefined);
    const event = sanitizeRunOrchestrationObservabilityEvent(Object.freeze({
      slice: IMAGE_MANIPULATION_SLICE_NAME,
      ...input,
      occurredAt,
      correlation,
      resilience,
    })) as RunOrchestrationObservabilityLogEvent;

    if (event.severity === "error") {
      this.logger.error(event);
    } else if (event.severity === "warn") {
      this.logger.warn(event);
    } else {
      this.logger.info(event);
    }

    await this.emitMetrics(event);
  }

  private async emitMetrics(event: RunOrchestrationObservabilityLogEvent): Promise<void> {
    if (!this.metricsSink) {
      return;
    }

    await emitMetricBestEffort(this.metricsSink, Object.freeze({
      name: "run_orchestration_operation_total",
      value: 1,
      occurredAt: event.occurredAt,
      tags: Object.freeze({
        operation: event.operation,
        outcome: event.outcome,
      }),
    }));

    const counters = event.counters;
    if (!counters) {
      return;
    }

    for (const [counterName, counterValue] of Object.entries(counters)) {
      if (!Number.isFinite(counterValue)) {
        continue;
      }
      await emitMetricBestEffort(this.metricsSink, Object.freeze({
        name: `run_orchestration_${counterName}`,
        value: counterValue,
        occurredAt: event.occurredAt,
        tags: Object.freeze({
          operation: event.operation,
          outcome: event.outcome,
        }),
      }));
    }
  }
}

class ConsoleRunOrchestrationObservabilityLogger implements RunOrchestrationObservabilityLogger {
  public info(event: RunOrchestrationObservabilityLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: RunOrchestrationObservabilityLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: RunOrchestrationObservabilityLogEvent): void {
    console.error(JSON.stringify(event));
  }
}

async function emitMetricBestEffort(
  sink: RunOrchestrationMetricsSink,
  event: RunOrchestrationMetricsEvent,
): Promise<void> {
  try {
    await sink.emit(event);
  } catch {
    // Observability metrics must not alter orchestration control flow.
  }
}
