import { describe, expect, it } from "bun:test";
import {
  publishGeneratedResultAuditEventBestEffort,
  type GeneratedResultAuditEvent,
  type GeneratedResultAuditSink,
} from "../ports/GeneratedResultAuditPort";

class InMemoryGeneratedResultAuditSink implements GeneratedResultAuditSink {
  public readonly events: GeneratedResultAuditEvent[] = [];

  public async recordGeneratedResultEvent(event: GeneratedResultAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("GeneratedResultAuditPort", () => {
  it("sanitizes sensitive generated-result audit detail fields before sink publication", async () => {
    const sink = new InMemoryGeneratedResultAuditSink();

    await publishGeneratedResultAuditEventBestEffort(sink, {
      type: "generated-result-original-content-accessed",
      occurredAt: "2026-04-09T15:30:00.000Z",
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      outcome: "rejected",
      result: Object.freeze({
        resultAssetId: "gr-001",
      }),
      details: Object.freeze({
        reasonCode: "authorization-denied",
        objectKey: "workspaces/alpha/generated-results/gr-001/original.png",
        backendHandle: "backend-token-123",
      }),
    });

    expect(sink.events).toHaveLength(1);
    const details = sink.events[0]?.details as Record<string, unknown>;
    expect(details.reasonCode).toBe("authorization-denied");
    expect(details.objectKey).toBe("[REDACTED]");
    expect(details.backendHandle).toBe("[REDACTED]");
  });
});
