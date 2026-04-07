import {
  SecretOperationalOutcomes,
  sanitizeSecretOperationalEvent,
  type ISecretObservabilityPort,
  type ISecretOperationalLogger,
  type SecretOperationalLogEvent,
} from "@application/security/ports/SecretObservabilityPorts";

export interface SecretObservabilityReporterOptions {
  readonly logger?: ISecretOperationalLogger;
}

export class SecretObservabilityReporter implements ISecretObservabilityPort {
  private readonly logger: ISecretOperationalLogger;

  public constructor(options: SecretObservabilityReporterOptions = {}) {
    this.logger = options.logger ?? new ConsoleSecretOperationalLogger();
  }

  public async recordSecretOperation(event: SecretOperationalLogEvent): Promise<void> {
    const sanitized = sanitizeSecretOperationalEvent(event);
    if (sanitized.outcome === SecretOperationalOutcomes.failed) {
      this.logger.error(sanitized);
      return;
    }
    if (sanitized.outcome === SecretOperationalOutcomes.denied || sanitized.outcome === SecretOperationalOutcomes.rejected) {
      this.logger.warn(sanitized);
      return;
    }
    this.logger.info(sanitized);
  }
}

class ConsoleSecretOperationalLogger implements ISecretOperationalLogger {
  public info(event: SecretOperationalLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: SecretOperationalLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: SecretOperationalLogEvent): void {
    console.error(JSON.stringify(event));
  }
}

