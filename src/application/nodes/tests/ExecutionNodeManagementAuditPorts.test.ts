import { describe, expect, it } from "bun:test";
import {
  ExecutionNodeManagementAuditEventTypes,
  publishExecutionNodeManagementAuditEventBestEffort,
  type ExecutionNodeManagementAuditEvent,
  type ExecutionNodeManagementAuditSink,
} from "../ports/ExecutionNodeManagementAuditPorts";

class CapturingExecutionNodeAuditSink implements ExecutionNodeManagementAuditSink {
  public event?: ExecutionNodeManagementAuditEvent;

  public async recordExecutionNodeManagementAuditEvent(event: ExecutionNodeManagementAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("ExecutionNodeManagementAuditPorts", () => {
  it("publishes sanitized execution-node management audit events with best-effort redaction", async () => {
    const sink = new CapturingExecutionNodeAuditSink();

    await publishExecutionNodeManagementAuditEventBestEffort(sink, {
      type: ExecutionNodeManagementAuditEventTypes.executionNodeRegistered,
      actorUserIdentityId: "  user:admin-node  ",
      occurredAt: " 2026-04-08T15:00:00.000Z ",
      nodeId: " node:west-1 ",
      workspaceId: " workspace:alpha ",
      outcome: "success",
      details: Object.freeze({
        endpointRef: "node://west-1",
        configurationRef: "cfg://west-1",
        readiness: Object.freeze({
          url: "https://example.invalid/internal",
          ok: true,
        }),
        metadata: Object.freeze({
          role: "executor",
        }),
      }),
    });

    expect(sink.event).toBeDefined();
    expect(sink.event?.actorUserIdentityId).toBe("user:admin-node");
    expect(sink.event?.nodeId).toBe("node:west-1");
    expect(sink.event?.workspaceId).toBe("workspace:alpha");
    expect(sink.event?.details?.["endpointRef"]).toBe("[REDACTED]");
    expect(sink.event?.details?.["configurationRef"]).toBe("[REDACTED]");
    expect((sink.event?.details?.["readiness"] as Record<string, unknown>)?.["url"]).toBe("[REDACTED]");
    expect(sink.event?.details?.["metadata"]).toBe("[REDACTED]");
  });

  it("swallows sink failures to keep audit publication non-blocking", async () => {
    const throwingSink: ExecutionNodeManagementAuditSink = {
      async recordExecutionNodeManagementAuditEvent(): Promise<void> {
        throw new Error("audit sink unavailable");
      },
    };

    await publishExecutionNodeManagementAuditEventBestEffort(throwingSink, {
      type: ExecutionNodeManagementAuditEventTypes.executionNodeAvailabilityOverrideUpdated,
      actorUserIdentityId: "user:ops",
      occurredAt: "2026-04-08T15:05:00.000Z",
      nodeId: "node:west-1",
      outcome: "success",
      details: Object.freeze({
        action: "disable",
      }),
    });
  });
});
