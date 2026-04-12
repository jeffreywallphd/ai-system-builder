import { describe, expect, it } from "bun:test";
import { GeneratedResultPreviewKinds } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { SharpGeneratedResultPreviewImageProcessor } from "../SharpGeneratedResultPreviewImageProcessor";

const TinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=";

describe("SharpGeneratedResultPreviewImageProcessor", () => {
  it("generates webp preview bytes with bounded dimensions", async () => {
    const processor = new SharpGeneratedResultPreviewImageProcessor();

    const result = await processor.generatePreviewDerivative({
      sourceContent: Buffer.from(TinyPngBase64, "base64"),
      sourceMediaType: "image/png",
      previewKind: GeneratedResultPreviewKinds.displaySafe,
      profile: Object.freeze({
        maxWidth: 1280,
        maxHeight: 1280,
        mediaType: "image/webp",
        quality: 82,
      }),
    });

    expect(result.mediaType).toBe("image/webp");
    expect(result.byteSize).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width).toBeLessThanOrEqual(1280);
    expect(result.height).toBeLessThanOrEqual(1280);
  });
});
