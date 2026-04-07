import {
  sanitizeRunOrchestrationObservabilityEvent,
} from "./RunOrchestrationObservabilityRedaction";

export interface RunOrchestrationObservabilityLogEvent {
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

  public async record(input: Omit<RunOrchestrationObservabilityLogEvent, "occurredAt"> & {
    readonly occurredAt?: string;
  }): Promise<void> {
    const occurredAt = input.occurredAt?.trim() || new Date().toISOString();
    const event = sanitizeRunOrchestrationObservabilityEvent(Object.freeze({
      ...input,
      occurredAt,
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
