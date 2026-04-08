import {
  OfflineOperationalEventTypes,
  type OfflineOperationalEvent,
} from "@application/common/OfflineOperationalEventPorts";
import { sanitizeOfflineOperationalObservabilityEvent } from "./OfflineOperationalObservabilityRedaction";

export interface OfflineOperationalObservabilityLogEvent {
  readonly event: string;
  readonly operation: "offline-connectivity" | "offline-resynchronization" | "offline-cache" | "offline-local-execution";
  readonly outcome: "success" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly syncAttemptId?: string;
  readonly workspaceId?: string;
  readonly actorUserIdentityId?: string;
  readonly operationId?: string;
  readonly resourceClass?: string;
  readonly resourceId?: string;
  readonly markers?: ReadonlyArray<string>;
  readonly counters?: Readonly<Record<string, number>>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface OfflineOperationalMetricsEvent {
  readonly name: string;
  readonly value: number;
  readonly occurredAt: string;
  readonly tags?: Readonly<Record<string, string>>;
}

export interface OfflineOperationalObservabilityLogger {
  info(event: OfflineOperationalObservabilityLogEvent): void;
  warn(event: OfflineOperationalObservabilityLogEvent): void;
  error(event: OfflineOperationalObservabilityLogEvent): void;
}

export interface OfflineOperationalMetricsSink {
  emit(event: OfflineOperationalMetricsEvent): void | Promise<void>;
}

export interface OfflineOperationalObservabilityOptions {
  readonly logger?: OfflineOperationalObservabilityLogger;
  readonly metricsSink?: OfflineOperationalMetricsSink;
}

export class OfflineOperationalObservability {
  private readonly logger: OfflineOperationalObservabilityLogger;
  private readonly metricsSink: OfflineOperationalMetricsSink | undefined;

  public constructor(options: OfflineOperationalObservabilityOptions = {}) {
    this.logger = options.logger ?? new ConsoleOfflineOperationalObservabilityLogger();
    this.metricsSink = options.metricsSink;
  }

  public async recordOfflineOperationalEvent(event: OfflineOperationalEvent): Promise<void> {
    const logEvent = sanitizeOfflineOperationalObservabilityEvent(this.toLogEvent(event));

    if (logEvent.severity === "error") {
      this.logger.error(logEvent);
    } else if (logEvent.severity === "warn") {
      this.logger.warn(logEvent);
    } else {
      this.logger.info(logEvent);
    }

    await this.emitMetrics(logEvent);
  }

  private toLogEvent(event: OfflineOperationalEvent): OfflineOperationalObservabilityLogEvent {
    const operation = resolveOperation(event.type);
    const markers = buildMarkers(event, operation);
    const counters = buildCounters(event);
    return Object.freeze({
      event: "offline.operational.event.recorded",
      operation,
      outcome: event.outcome === "succeeded" ? "success" : "failure",
      severity: resolveSeverity(event),
      occurredAt: event.occurredAt,
      requestId: event.requestId,
      correlationId: event.correlationId,
      syncAttemptId: event.syncAttemptId,
      workspaceId: event.workspaceId,
      actorUserIdentityId: event.actorUserIdentityId,
      operationId: event.operationId,
      resourceClass: event.resourceClass,
      resourceId: event.resourceId,
      markers,
      counters,
      details: Object.freeze({
        channel: event.channel,
        type: event.type,
        classification: event.classification,
        summary: event.summary,
        details: event.details,
        diagnostics: event.diagnostics,
      }),
    });
  }

  private async emitMetrics(event: OfflineOperationalObservabilityLogEvent): Promise<void> {
    if (!this.metricsSink) {
      return;
    }

    await emitMetricBestEffort(this.metricsSink, Object.freeze({
      name: "offline_operational_event_total",
      value: 1,
      occurredAt: event.occurredAt,
      tags: Object.freeze({
        operation: event.operation,
        outcome: event.outcome,
      }),
    }));

    if (!event.counters) {
      return;
    }
    for (const [name, value] of Object.entries(event.counters)) {
      if (!Number.isFinite(value)) {
        continue;
      }
      await emitMetricBestEffort(this.metricsSink, Object.freeze({
        name: `offline_${name}`,
        value,
        occurredAt: event.occurredAt,
        tags: Object.freeze({
          operation: event.operation,
          outcome: event.outcome,
        }),
      }));
    }
  }
}

class ConsoleOfflineOperationalObservabilityLogger implements OfflineOperationalObservabilityLogger {
  public info(event: OfflineOperationalObservabilityLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: OfflineOperationalObservabilityLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: OfflineOperationalObservabilityLogEvent): void {
    console.error(JSON.stringify(event));
  }
}

function resolveOperation(
  eventType: OfflineOperationalEvent["type"],
): OfflineOperationalObservabilityLogEvent["operation"] {
  if (eventType === OfflineOperationalEventTypes.offlineEntered || eventType === OfflineOperationalEventTypes.offlineExited) {
    return "offline-connectivity";
  }
  if (eventType === OfflineOperationalEventTypes.snapshotRefreshFailed) {
    return "offline-cache";
  }
  if (eventType === OfflineOperationalEventTypes.protectedLocalExecutionRegistered) {
    return "offline-local-execution";
  }
  return "offline-resynchronization";
}

function resolveSeverity(event: OfflineOperationalEvent): OfflineOperationalObservabilityLogEvent["severity"] {
  if (event.type === OfflineOperationalEventTypes.replayFailed || event.type === OfflineOperationalEventTypes.snapshotRefreshFailed) {
    return "error";
  }
  if (event.type === OfflineOperationalEventTypes.conflictDetected || event.outcome === "conflict") {
    return "warn";
  }
  if (event.outcome === "failed") {
    return "warn";
  }
  return "info";
}

function buildMarkers(
  event: OfflineOperationalEvent,
  operation: OfflineOperationalObservabilityLogEvent["operation"],
): ReadonlyArray<string> {
  const markers = [
    "offline-operational-event",
    `offline-operation:${operation}`,
    `offline-type:${event.type}`,
    `offline-outcome:${event.outcome ?? "unspecified"}`,
  ];
  if (event.syncAttemptId) {
    markers.push("sync-attempt-correlated");
  }
  if (event.type === OfflineOperationalEventTypes.replayFailed) {
    markers.push("replay-failure");
  }
  if (event.type === OfflineOperationalEventTypes.conflictDetected) {
    markers.push("replay-conflict");
  }
  if (event.type === OfflineOperationalEventTypes.snapshotRefreshFailed) {
    markers.push("cache-maintenance-failure");
  }
  return Object.freeze(markers);
}

function buildCounters(event: OfflineOperationalEvent): Readonly<Record<string, number>> {
  const counters: Record<string, number> = {
    event_total: 1,
    [`event_type_${sanitizeCounterToken(event.type)}_total`]: 1,
  };
  if (event.type === OfflineOperationalEventTypes.resynchronizationAttemptCompleted) {
    counters.resync_attempt_total = 1;
  }
  if (event.type === OfflineOperationalEventTypes.replayFailed) {
    counters.resync_replay_failure_total = 1;
  }
  if (event.type === OfflineOperationalEventTypes.conflictDetected) {
    counters.resync_conflict_total = 1;
  }
  if (event.type === OfflineOperationalEventTypes.snapshotRefreshFailed) {
    counters.cache_refresh_failure_total = 1;
  }
  return Object.freeze(counters);
}

function sanitizeCounterToken(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

async function emitMetricBestEffort(
  sink: OfflineOperationalMetricsSink,
  event: OfflineOperationalMetricsEvent,
): Promise<void> {
  try {
    await sink.emit(event);
  } catch {
    // Offline observability metrics are best-effort and must not alter replay or connectivity control flow.
  }
}
