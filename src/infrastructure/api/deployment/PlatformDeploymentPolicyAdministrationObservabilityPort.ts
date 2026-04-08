import type {
  DeploymentPolicyAdministrationObservabilityEvent,
  IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

export interface DeploymentPolicyAdministrationObservabilityLogger {
  info(event: Readonly<Record<string, unknown>>): void;
  warn(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}

export interface DeploymentPolicyAdministrationMetricsEvent {
  readonly name: string;
  readonly value: number;
  readonly occurredAt: string;
  readonly tags?: Readonly<Record<string, string>>;
}

export interface DeploymentPolicyAdministrationMetricsSink {
  emit(event: DeploymentPolicyAdministrationMetricsEvent): void | Promise<void>;
}

export interface PlatformDeploymentPolicyAdministrationObservabilityPortOptions {
  readonly logger?: DeploymentPolicyAdministrationObservabilityLogger;
  readonly metricsSink?: DeploymentPolicyAdministrationMetricsSink;
}

export class PlatformDeploymentPolicyAdministrationObservabilityPort
  implements IDeploymentPolicyAdministrationObservabilityPort {
  private readonly logger: DeploymentPolicyAdministrationObservabilityLogger;
  private readonly metricsSink?: DeploymentPolicyAdministrationMetricsSink;

  public constructor(options: PlatformDeploymentPolicyAdministrationObservabilityPortOptions = {}) {
    this.logger = options.logger ?? new ConsoleDeploymentPolicyAdministrationObservabilityLogger();
    this.metricsSink = options.metricsSink;
  }

  public async recordDeploymentPolicyAdministrationEvent(
    event: DeploymentPolicyAdministrationObservabilityEvent,
  ): Promise<void> {
    const details = Object.freeze({
      operation: event.operation,
      outcome: event.outcome,
      scope: event.scope,
      actorUserIdentityId: event.actorUserIdentityId,
      profileId: event.profileId,
      correlationId: event.correlationId,
      operationKey: event.operationKey,
      details: event.details,
      counters: event.counters,
      occurredAt: event.occurredAt,
    });
    const payload = Object.freeze({
      event: event.event,
      requestId: event.correlationId ?? event.operationKey ?? event.scope?.scopeId ?? event.actorUserIdentityId ?? "deployment-policy-admin",
      details: Object.freeze({
        deploymentPolicyAdministration: details,
      }),
    });

    if (event.severity === "error") {
      this.logger.error(payload);
    } else if (event.severity === "warn") {
      this.logger.warn(payload);
    } else {
      this.logger.info(payload);
    }

    await this.emitMetrics(event);
  }

  private async emitMetrics(event: DeploymentPolicyAdministrationObservabilityEvent): Promise<void> {
    if (!this.metricsSink) {
      return;
    }
    await emitMetricBestEffort(this.metricsSink, Object.freeze({
      name: "deployment_policy_admin_event_total",
      value: 1,
      occurredAt: event.occurredAt,
      tags: Object.freeze({
        operation: event.operation,
        outcome: event.outcome,
      }),
    }));

    for (const [name, value] of Object.entries(event.counters ?? {})) {
      if (!Number.isFinite(value)) {
        continue;
      }
      await emitMetricBestEffort(this.metricsSink, Object.freeze({
        name: `deployment_policy_admin_${name}`,
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

class ConsoleDeploymentPolicyAdministrationObservabilityLogger implements DeploymentPolicyAdministrationObservabilityLogger {
  public info(event: Readonly<Record<string, unknown>>): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: Readonly<Record<string, unknown>>): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: Readonly<Record<string, unknown>>): void {
    console.error(JSON.stringify(event));
  }
}

async function emitMetricBestEffort(
  sink: DeploymentPolicyAdministrationMetricsSink,
  event: DeploymentPolicyAdministrationMetricsEvent,
): Promise<void> {
  try {
    await sink.emit(event);
  } catch {
    // Observability metrics must stay non-blocking.
  }
}
