import { describe, expect, it } from "bun:test";
import {
  publishNodeTrustAuditEventBestEffort,
  type NodeTrustAuditEvent,
  type NodeTrustAuditSink,
} from "../ports/NodeTrustAuditPorts";

class CapturingNodeTrustAuditSink implements NodeTrustAuditSink {
  public event?: NodeTrustAuditEvent;

  public async recordNodeTrustAuditEvent(event: NodeTrustAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("NodeTrustAuditPorts", () => {
  it("redacts sensitive trust-material fields before publishing to sinks", async () => {
    const sink = new CapturingNodeTrustAuditSink();
    await publishNodeTrustAuditEventBestEffort(sink, {
      type: "node-enrollment-requested",
      actorUserIdentityId: "node:bootstrap:1",
      occurredAt: "2026-04-05T18:00:00.000Z",
      details: Object.freeze({
        trustMaterialRef: "raw-trust-material-value",
        nested: {
          privateKey: "raw-private-key",
          safe: "ok",
        },
      }),
    });

    expect(sink.event).toBeDefined();
    expect((sink.event?.details as Record<string, unknown>)?.trustMaterialRef).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.privateKey).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.safe).toBe("ok");
  });
});
