import { describe, expect, it } from "bun:test";
import { SecretOperationalOutcomes, type ISecretOperationalLogger, type SecretOperationalLogEvent } from "@application/security/ports/SecretObservabilityPorts";
import { SecretObservabilityReporter } from "../SecretObservabilityReporter";

class InMemorySecretLogger implements ISecretOperationalLogger {
  public readonly infoEvents: SecretOperationalLogEvent[] = [];
  public readonly warnEvents: SecretOperationalLogEvent[] = [];
  public readonly errorEvents: SecretOperationalLogEvent[] = [];

  public info(event: SecretOperationalLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: SecretOperationalLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: SecretOperationalLogEvent): void {
    this.errorEvents.push(event);
  }
}

describe("SecretObservabilityReporter", () => {
  it("redacts sensitive details before logging", async () => {
    const logger = new InMemorySecretLogger();
    const reporter = new SecretObservabilityReporter({ logger });

    await reporter.recordSecretOperation({
      event: "secret.create",
      outcome: SecretOperationalOutcomes.failed,
      occurredAt: "2026-04-06T15:00:00.000Z",
      actorId: "user:admin",
      secretId: "secret:server:openai",
      scope: "server",
      details: Object.freeze({
        plaintext: "sk-live-123",
        nested: {
          token: "token-456",
        },
      }),
    });

    expect(logger.errorEvents).toHaveLength(1);
    const serialized = JSON.stringify(logger.errorEvents[0]);
    expect(serialized).not.toContain("sk-live-123");
    expect(serialized).not.toContain("token-456");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).toContain("secret:server:openai");
  });
});

