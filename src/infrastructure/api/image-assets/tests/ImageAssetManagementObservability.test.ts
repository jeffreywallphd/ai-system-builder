import { describe, expect, it } from "bun:test";
import { ImageAssetManagementObservability, ImageAssetManagementObservabilityFlows } from "../ImageAssetManagementObservability";
import type { ImageAssetManagementObservabilityLogEvent, ImageAssetManagementObservabilityLogger } from "../ImageAssetManagementObservability";

class CapturingImageAssetManagementObservabilityLogger implements ImageAssetManagementObservabilityLogger {
  public readonly infoEvents: ImageAssetManagementObservabilityLogEvent[] = [];
  public readonly warnEvents: ImageAssetManagementObservabilityLogEvent[] = [];
  public readonly errorEvents: ImageAssetManagementObservabilityLogEvent[] = [];

  public info(event: ImageAssetManagementObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: ImageAssetManagementObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: ImageAssetManagementObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

describe("ImageAssetManagementObservability", () => {
  it("logs redacted diagnostics without exposing upload tokens or storage paths", async () => {
    const logger = new CapturingImageAssetManagementObservabilityLogger();
    const observability = new ImageAssetManagementObservability({ logger });

    await observability.recordApiOutcome({
      flow: ImageAssetManagementObservabilityFlows.uploadIngest,
      request: Object.freeze({
        actorUserIdentityId: "user-a",
        workspaceId: "workspace-a",
        assetId: "image-asset:123",
        uploadSessionId: "img-upload-v1.payload.signature",
        contentType: "image/png",
        content: "unsafe-bytes",
      }),
      response: Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "invalid-request" as const,
          message: "uploadSessionId is invalid.",
          details: Object.freeze({
            objectKey: "workspaces/workspace-a/image-assets/image-asset-123/original/image.png",
            validationCode: "upload-session-invalid",
          }),
        }),
      }),
      trace: Object.freeze({
        actorUserIdentityId: "user-a",
        workspaceId: "workspace-a",
        assetId: "image-asset:123",
      }),
    });

    expect(logger.warnEvents).toHaveLength(1);
    const event = logger.warnEvents[0];
    expect(event.outcome).toBe("rejected");
    const serialized = JSON.stringify(event);
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("img-upload-v1.payload.signature");
    expect(serialized).not.toContain("workspaces/workspace-a/image-assets/image-asset-123/original/image.png");
    expect(serialized).not.toContain("unsafe-bytes");
  });

  it("maps internal API failures to error severity", async () => {
    const logger = new CapturingImageAssetManagementObservabilityLogger();
    const observability = new ImageAssetManagementObservability({ logger });

    await observability.recordApiOutcome({
      flow: ImageAssetManagementObservabilityFlows.uploadFinalize,
      request: Object.freeze({
        actorUserIdentityId: "user-a",
        workspaceId: "workspace-a",
        assetId: "image-asset:123",
      }),
      response: Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "internal" as const,
          message: "Unexpected storage backend error",
        }),
      }),
      trace: Object.freeze({
        actorUserIdentityId: "user-a",
        workspaceId: "workspace-a",
        assetId: "image-asset:123",
        operationKey: "image-asset:upload:finalize:image-asset:123:op-1",
      }),
    });

    expect(logger.errorEvents).toHaveLength(1);
    expect(logger.errorEvents[0]?.outcome).toBe("failure");
    expect(logger.errorEvents[0]?.severity).toBe("error");
    expect(logger.errorEvents[0]?.requestId).toBe("image-asset:upload:finalize:image-asset:123:op-1");
  });
});
