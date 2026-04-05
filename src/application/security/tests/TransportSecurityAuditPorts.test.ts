import { describe, expect, it } from "bun:test";
import {
  publishTransportSecurityAuditEventBestEffort,
  sanitizeTransportSecurityAuditEvent,
  type TransportSecurityAuditEvent,
  type TransportSecurityAuditSink,
} from "../ports/TransportSecurityAuditPorts";

class CapturingTransportSecurityAuditSink implements TransportSecurityAuditSink {
  public event?: TransportSecurityAuditEvent;

  public async recordTransportSecurityAuditEvent(event: TransportSecurityAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("TransportSecurityAuditPorts", () => {
  it("redacts sensitive path/prompt/token/certificate details before publishing", async () => {
    const sink = new CapturingTransportSecurityAuditSink();
    await publishTransportSecurityAuditEventBestEffort(sink, {
      type: "transport-connection-rejected",
      outcome: "rejected",
      occurredAt: "2026-04-05T12:00:00.000Z",
      connectionId: "connection:redaction",
      details: Object.freeze({
        requestPath: "C:\\secrets\\tls\\private.pem",
        prompt: "user provided prompt value",
        token: "loom_secret_token",
        certificatePem: "-----BEGIN CERTIFICATE-----\nABC123\n-----END CERTIFICATE-----",
        nested: Object.freeze({
          unixPath: "/etc/ssl/private/server.key",
          authorizationHeader: "Bearer loom_session_value",
        }),
      }),
    });

    const serialized = JSON.stringify(sink.event);
    expect(serialized.includes("C:\\\\secrets\\\\tls\\\\private.pem")).toBeFalse();
    expect(serialized.includes("user provided prompt value")).toBeFalse();
    expect(serialized.includes("loom_secret_token")).toBeFalse();
    expect(serialized.includes("BEGIN CERTIFICATE")).toBeFalse();
    expect(serialized.includes("/etc/ssl/private/server.key")).toBeFalse();
    expect(serialized.includes("loom_session_value")).toBeFalse();
    expect(serialized.includes("[REDACTED]")).toBeTrue();
  });

  it("sanitizes freeform strings containing bearer tokens and filesystem paths", () => {
    const sanitized = sanitizeTransportSecurityAuditEvent({
      type: "transport-connection-rejected",
      outcome: "rejected",
      occurredAt: "2026-04-05T12:00:00.000Z",
      connectionId: "connection:freeform",
      details: Object.freeze({
        message: "failure at C:\\tmp\\secrets\\key.pem bearer loom_token_abc",
      }),
    });

    const text = JSON.stringify(sanitized);
    expect(text.includes("loom_token_abc")).toBeFalse();
    expect(text.includes("C:\\\\tmp\\\\secrets\\\\key.pem")).toBeFalse();
    expect(text.includes("[REDACTED_PATH]")).toBeTrue();
    expect(text.includes("Bearer [REDACTED]")).toBeTrue();
  });
});
