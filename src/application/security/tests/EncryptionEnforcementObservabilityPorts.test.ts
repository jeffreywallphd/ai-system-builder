import { describe, expect, it } from "bun:test";
import {
  publishEncryptionEnforcementEventBestEffort,
  type EncryptionEnforcementEvent,
  type IEncryptionEnforcementObservabilityPort,
} from "../ports/EncryptionEnforcementObservabilityPorts";

class CapturingEncryptionObservabilityPort implements IEncryptionEnforcementObservabilityPort {
  public event?: EncryptionEnforcementEvent;

  public async recordEncryptionEnforcementEvent(event: EncryptionEnforcementEvent): Promise<void> {
    this.event = event;
  }
}

describe("EncryptionEnforcementObservabilityPorts", () => {
  it("redacts sensitive key, content, and filesystem fields in enforcement diagnostics", async () => {
    const sink = new CapturingEncryptionObservabilityPort();

    await publishEncryptionEnforcementEventBestEffort(sink, {
      event: "asset-content.protected-write",
      outcome: "succeeded",
      occurredAt: "2026-04-06T12:00:00.000Z",
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      details: Object.freeze({
        keyReferenceId: "kms://workspace/key",
        plaintextDigest: "abc123",
        objectKey: "workspaces/workspace-alpha/assets/a/input/file.bin",
        objectPath: "C:\\secret\\data.bin",
        nested: Object.freeze({
          tokenValue: "opaque",
          safeReason: "policy-enforced",
        }),
      }),
    });

    expect(sink.event).toBeDefined();
    expect((sink.event?.details as Record<string, unknown>)?.keyReferenceId).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.plaintextDigest).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.objectKey).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.objectPath).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.tokenValue).toBe("[REDACTED]");
    expect(((sink.event?.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.safeReason).toBe("policy-enforced");
  });

  it("swallows observability sink failures for best-effort publication", async () => {
    const throwingSink: IEncryptionEnforcementObservabilityPort = {
      async recordEncryptionEnforcementEvent(): Promise<void> {
        throw new Error("sink unavailable");
      },
    };

    await publishEncryptionEnforcementEventBestEffort(throwingSink, {
      event: "encryption-policy.evaluated",
      outcome: "failed",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });
  });
});
