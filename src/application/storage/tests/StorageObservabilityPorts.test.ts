import { describe, expect, it } from "bun:test";
import {
  publishStorageManagementAuditEventBestEffort,
  type StorageManagementAuditEvent,
  type StorageManagementAuditSink,
} from "../ports/StorageObservabilityPorts";

class CapturingStorageManagementAuditSink implements StorageManagementAuditSink {
  public event?: StorageManagementAuditEvent;

  public async recordStorageManagementEvent(event: StorageManagementAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("StorageObservabilityPorts", () => {
  it("redacts sensitive storage management audit details before publishing", async () => {
    const sink = new CapturingStorageManagementAuditSink();
    await publishStorageManagementAuditEventBestEffort(sink, {
      type: "storage-metadata-updated",
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      occurredAt: "2026-04-06T18:00:00.000Z",
      details: Object.freeze({
        backendBindingReferenceId: "backend-binding-secret",
        connectionString: "sensitive-connection-string",
        nested: Object.freeze({
          keyReferenceId: "kms://workspace/key/alpha",
          safeField: "visible",
        }),
      }),
    });

    expect(sink.event).toBeDefined();
    expect((sink.event?.details as Record<string, unknown>)?.backendBindingReferenceId).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.connectionString).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.keyReferenceId)
      .toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.safeField)
      .toBe("visible");
  });
});
