import { describe, expect, it } from "bun:test";
import { AuthenticatedTrustStates, TransportSecurityScenarios } from "@domain/security/TransportSecurityDomain";
import type { TransportSecurityAuditEvent, TransportSecurityAuditSink, TransportSecurityLogEvent, TransportSecurityLogger } from "@application/security/ports/TransportSecurityAuditPorts";
import { TransportSecurityObservabilityReporter } from "../TransportSecurityObservabilityReporter";

class CapturingLogger implements TransportSecurityLogger {
  public readonly infoEvents: TransportSecurityLogEvent[] = [];
  public readonly warnEvents: TransportSecurityLogEvent[] = [];
  public readonly errorEvents: TransportSecurityLogEvent[] = [];

  public info(event: TransportSecurityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: TransportSecurityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: TransportSecurityLogEvent): void {
    this.errorEvents.push(event);
  }
}

class CapturingAuditSink implements TransportSecurityAuditSink {
  public readonly events: TransportSecurityAuditEvent[] = [];

  public async recordTransportSecurityAuditEvent(event: TransportSecurityAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("TransportSecurityObservabilityReporter", () => {
  it("maps trusted-device accepted connections to device-bound session events", async () => {
    const logger = new CapturingLogger();
    const auditSink = new CapturingAuditSink();
    const reporter = new TransportSecurityObservabilityReporter({
      logger,
      auditSink,
    });

    await reporter.recordTransportConnectionPolicyDecision({
      event: "transport-connection-accepted",
      connectionId: "conn:device:accepted",
      scenario: TransportSecurityScenarios.desktopClientToControlPlane,
      policyId: "policy:desktop",
      actorType: "user-session",
      localPeerType: "authoritative-server",
      remotePeerType: "desktop-client",
      channelType: "https",
      rejectionReasons: Object.freeze([]),
      resolvedTrustState: Object.freeze({
        userSessionAuthenticated: true,
        trustedDevice: Object.freeze({
          trustedDeviceId: "device:trusted",
          trustState: AuthenticatedTrustStates.trusted,
        }),
      }),
      occurredAt: "2026-04-05T12:00:00.000Z",
    });

    expect(logger.infoEvents).toHaveLength(1);
    expect(logger.infoEvents[0]?.details.type).toBe("transport-device-bound-session-channel-established");
    expect(auditSink.events).toHaveLength(1);
    expect(auditSink.events[0]?.type).toBe("transport-device-bound-session-channel-established");
  });

  it("maps policy peer rejection and redacts sensitive details", async () => {
    const logger = new CapturingLogger();
    const auditSink = new CapturingAuditSink();
    const reporter = new TransportSecurityObservabilityReporter({
      logger,
      auditSink,
    });

    await reporter.recordTransportSecurityEvent({
      type: "transport-policy-peer-rejected",
      outcome: "rejected",
      occurredAt: "2026-04-05T12:00:00.000Z",
      connectionId: "conn:peer:rejected",
      scenario: TransportSecurityScenarios.serviceToService,
      details: Object.freeze({
        prompt: "do not leak this prompt",
        token: "token-value",
      }),
    });

    expect(logger.warnEvents).toHaveLength(1);
    const serializedWarn = JSON.stringify(logger.warnEvents[0]);
    expect(serializedWarn.includes("do not leak this prompt")).toBeFalse();
    expect(serializedWarn.includes("token-value")).toBeFalse();
    expect(serializedWarn.includes("[REDACTED]")).toBeTrue();

    expect(auditSink.events).toHaveLength(1);
    const serializedAudit = JSON.stringify(auditSink.events[0]);
    expect(serializedAudit.includes("do not leak this prompt")).toBeFalse();
    expect(serializedAudit.includes("token-value")).toBeFalse();
  });
});

