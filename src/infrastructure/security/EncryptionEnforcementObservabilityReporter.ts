import {
  EncryptionEnforcementOutcomes,
  publishEncryptionEnforcementEventBestEffort,
  sanitizeEncryptionEnforcementEvent,
  type EncryptionEnforcementEvent,
  type IEncryptionEnforcementObservabilityPort,
} from "@application/security/ports/EncryptionEnforcementObservabilityPorts";

export interface EncryptionEnforcementOperationalLogger {
  info(event: EncryptionEnforcementEvent): void;
  warn(event: EncryptionEnforcementEvent): void;
  error(event: EncryptionEnforcementEvent): void;
}

export interface EncryptionEnforcementObservabilityReporterOptions {
  readonly logger?: EncryptionEnforcementOperationalLogger;
  readonly auditSink?: IEncryptionEnforcementObservabilityPort;
}

export class EncryptionEnforcementObservabilityReporter implements IEncryptionEnforcementObservabilityPort {
  private readonly logger: EncryptionEnforcementOperationalLogger;
  private readonly auditSink?: IEncryptionEnforcementObservabilityPort;

  public constructor(options: EncryptionEnforcementObservabilityReporterOptions = {}) {
    this.logger = options.logger ?? new ConsoleEncryptionEnforcementOperationalLogger();
    this.auditSink = options.auditSink;
  }

  public async recordEncryptionEnforcementEvent(event: EncryptionEnforcementEvent): Promise<void> {
    const sanitized = sanitizeEncryptionEnforcementEvent(event);

    if (sanitized.outcome === EncryptionEnforcementOutcomes.succeeded) {
      this.logger.info(sanitized);
    } else if (
      sanitized.outcome === EncryptionEnforcementOutcomes.denied
      || sanitized.outcome === EncryptionEnforcementOutcomes.rejected
      || sanitized.outcome === EncryptionEnforcementOutcomes.missing
    ) {
      this.logger.warn(sanitized);
    } else {
      this.logger.error(sanitized);
    }

    await publishEncryptionEnforcementEventBestEffort(this.auditSink, sanitized);
  }
}

class ConsoleEncryptionEnforcementOperationalLogger implements EncryptionEnforcementOperationalLogger {
  public info(event: EncryptionEnforcementEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: EncryptionEnforcementEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: EncryptionEnforcementEvent): void {
    console.error(JSON.stringify(event));
  }
}

