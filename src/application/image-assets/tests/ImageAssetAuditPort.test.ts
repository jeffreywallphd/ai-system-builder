import { describe, expect, it } from "bun:test";
import {
  publishImageAssetAuditEventBestEffort,
  type ImageAssetAuditEvent,
  type ImageAssetAuditSink,
} from "../ports/ImageAssetAuditPort";

class CapturingImageAssetAuditSink implements ImageAssetAuditSink {
  public event?: ImageAssetAuditEvent;

  public async recordImageAssetEvent(event: ImageAssetAuditEvent): Promise<void> {
    this.event = event;
  }
}

describe("ImageAssetAuditPort", () => {
  it("publishes sanitized image-asset audit events with best-effort redaction", async () => {
    const sink = new CapturingImageAssetAuditSink();

    await publishImageAssetAuditEventBestEffort(sink, {
      type: "image-asset-upload-finalized",
      occurredAt: "2026-04-08T12:00:00.000Z",
      workspaceId: "workspace-a",
      actorUserId: "user-a",
      correlationId: "corr-1",
      operationKey: "image-asset:upload:finalize:1",
      outcome: "rejected",
      asset: {
        assetId: "image-asset:1",
        storageInstanceId: "storage-a",
        visibility: "private",
        lifecycleStatus: "failed",
      },
      details: {
        objectKey: "workspaces/workspace-a/image-assets/image-asset:1/original/source.png",
        previewToken: "sensitive-preview-token",
        safeReason: "checksum-mismatch",
      },
    });

    expect(sink.event).toBeDefined();
    expect(sink.event?.asset.assetId).toBe("image-asset:1");
    expect((sink.event?.details as Record<string, unknown>)?.objectKey).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.previewToken).toBe("[REDACTED]");
    expect((sink.event?.details as Record<string, unknown>)?.safeReason).toBe("checksum-mismatch");
  });

  it("swallows sink errors for best-effort publication", async () => {
    const throwingSink: ImageAssetAuditSink = {
      recordImageAssetEvent: async () => {
        throw new Error("audit sink unavailable");
      },
    };

    await publishImageAssetAuditEventBestEffort(throwingSink, {
      type: "image-asset-creation-initiated",
      occurredAt: "2026-04-08T12:00:00.000Z",
      workspaceId: "workspace-a",
      actorUserId: "user-a",
      outcome: "success",
      asset: {
        assetId: "image-asset:1",
      },
    });
  });
});
