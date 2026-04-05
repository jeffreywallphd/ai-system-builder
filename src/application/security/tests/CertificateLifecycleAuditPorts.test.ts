import { describe, expect, it } from "bun:test";
import {
  publishCertificateLifecycleAuditEventBestEffort,
  type CertificateLifecycleAuditEvent,
  type CertificateLifecycleAuditSink,
} from "../ports/CertificateLifecycleAuditPorts";

class CapturingCertificateLifecycleAuditSink implements CertificateLifecycleAuditSink {
  public event?: CertificateLifecycleAuditEvent;

  public async recordCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("CertificateLifecycleAuditPorts", () => {
  it("redacts sensitive certificate lifecycle details before publishing", async () => {
    const sink = new CapturingCertificateLifecycleAuditSink();
    await publishCertificateLifecycleAuditEventBestEffort(sink, {
      type: "certificate-issuance-failed",
      actorUserIdentityId: "user:admin",
      occurredAt: "2026-04-05T12:00:00.000Z",
      certificateAuthorityId: "ca:internal:root:v1",
      details: Object.freeze({
        certificateMaterialRef: "trust:cert:node:1:v1",
        nested: {
          privateKey: "-----BEGIN PRIVATE KEY-----",
          safe: "visible",
        },
      }),
    });

    expect(sink.event).toBeDefined();
    expect((sink.event?.details as Record<string, unknown>)?.certificateMaterialRef).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.privateKey).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.safe).toBe("visible");
  });
});
