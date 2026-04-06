import { describe, expect, it } from "bun:test";
import { EncryptionEnforcementObservabilityReporter } from "../EncryptionEnforcementObservabilityReporter";
import type { EncryptionEnforcementEvent } from "../../../application/security/ports/EncryptionEnforcementObservabilityPorts";

class RecordingLogger {
  public readonly infoEvents: EncryptionEnforcementEvent[] = [];
  public readonly warnEvents: EncryptionEnforcementEvent[] = [];
  public readonly errorEvents: EncryptionEnforcementEvent[] = [];

  public info(event: EncryptionEnforcementEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: EncryptionEnforcementEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: EncryptionEnforcementEvent): void {
    this.errorEvents.push(event);
  }
}

describe("EncryptionEnforcementObservabilityReporter", () => {
  it("routes succeeded outcomes to info and denied outcomes to warn", async () => {
    const logger = new RecordingLogger();
    const reporter = new EncryptionEnforcementObservabilityReporter({
      logger,
    });

    await reporter.recordEncryptionEnforcementEvent({
      event: "asset-content.decryption",
      outcome: "succeeded",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });
    await reporter.recordEncryptionEnforcementEvent({
      event: "asset-content.decryption",
      outcome: "denied",
      occurredAt: "2026-04-06T12:00:01.000Z",
    });

    expect(logger.infoEvents).toHaveLength(1);
    expect(logger.warnEvents).toHaveLength(1);
    expect(logger.errorEvents).toHaveLength(0);
  });

  it("routes failed outcomes to error", async () => {
    const logger = new RecordingLogger();
    const reporter = new EncryptionEnforcementObservabilityReporter({
      logger,
    });

    await reporter.recordEncryptionEnforcementEvent({
      event: "encryption-key.resolve",
      outcome: "failed",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    expect(logger.errorEvents).toHaveLength(1);
  });
});
