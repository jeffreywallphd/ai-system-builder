import { describe, expect, it } from "bun:test";
import {
  publishAssetAuditEventBestEffort,
  type AssetAuditEvent,
  type AssetAuditSink,
} from "../ports/AssetAuditPort";

class CapturingAssetAuditSink implements AssetAuditSink {
  public event?: AssetAuditEvent;

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("AssetAuditPort", () => {
  it("publishes sanitized asset audit events with best-effort redaction", async () => {
    const sink = new CapturingAssetAuditSink();

    await publishAssetAuditEventBestEffort(sink, {
      type: "asset-upload-finalized",
      occurredAt: "2026-04-06T12:00:00.000Z",
      workspaceId: "workspace-a",
      actorUserId: "user-a",
      correlationId: "corr-1",
      operationKey: "asset:upload:finalize:1",
      outcome: "success",
      asset: {
        assetId: "asset-a",
        kind: "uploaded-file",
        visibility: "private",
        lifecycleState: "active",
        versionId: "asset-a:v2",
      },
      details: {
        uploadSessionId: "upload-session-1",
        objectKey: "workspaces/workspace-a/assets/asset-a/input/file.png",
        contentToken: "sensitive-token",
        checksumDigest: "a".repeat(64),
        safeReason: "ok",
      },
    });

    expect(sink.event).toBeDefined();
    expect(sink.event?.asset.assetId).toBe("asset-a");
    expect((sink.event?.details as Record<string, unknown>)?.uploadSessionId).toBe("upload-session-1");
    expect((sink.event?.details as Record<string, unknown>)?.objectKey).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.contentToken).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.checksumDigest).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.safeReason).toBe("ok");
  });

  it("swallows sink errors for best-effort audit publication", async () => {
    const throwingSink: AssetAuditSink = {
      recordAssetEvent: async () => {
        throw new Error("audit down");
      },
    };

    await publishAssetAuditEventBestEffort(throwingSink, {
      type: "asset-download-authorized",
      occurredAt: "2026-04-06T12:00:00.000Z",
      workspaceId: "workspace-a",
      actorUserId: "user-a",
      asset: {
        assetId: "asset-a",
      },
    });
  });
});
