import { describe, expect, it } from "bun:test";
import { AssetId } from "../../../domain/assets/AssetId";
import { ImageAssetReferenceKinds } from "../../../domain/dataset-studio/contracts/ImageAssetReference";
import { validateImageRecord, ZodImageRecordValidator } from "../adapters/validation/ImageRecordValidator";

describe("ImageRecordValidator", () => {
  it("validates canonical image records and returns typed contracts", () => {
    const result = validateImageRecord({
      assetRef: {
        assetId: "asset:image:catalog:1",
        assetVersionId: "asset:image:catalog:1:v2",
      },
      width: 1024,
      height: 768,
      format: "PNG",
      metadata: {
        source: "camera",
      },
      tags: ["hero", "homepage"],
      derived: {
        aspectRatio: 1.3333,
      },
    });

    expect(result.assetRef.assetId).toBeInstanceOf(AssetId);
    expect(result.assetRef.assetId.toString()).toBe("asset:image:catalog:1");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
    expect(result.format).toBe("png");
    expect(result.tags).toEqual(["hero", "homepage"]);
    expect(result.metadata.source).toBe("camera");
  });

  it("normalizes structured local-file and external URI references", () => {
    const local = validateImageRecord({
      assetRef: {
        kind: ImageAssetReferenceKinds.localFile,
        path: "C:\\images\\frame.png",
      },
      width: 120,
      height: 80,
      format: "png",
    });

    expect(local.assetRef.kind).toBe(ImageAssetReferenceKinds.localFile);
    if (local.assetRef.kind === ImageAssetReferenceKinds.localFile) {
      expect(local.assetRef.path).toBe("C:\\images\\frame.png");
    }

    const external = validateImageRecord({
      assetRef: "https://example.com/remote.jpg",
      width: 256,
      height: 256,
      format: "jpeg",
    });
    expect(external.assetRef.kind).toBe(ImageAssetReferenceKinds.externalUri);
  });

  it("rejects invalid image records", () => {
    const validator = new ZodImageRecordValidator();

    expect(() => validator.validateImageRecord({
      assetRef: {
        assetId: "not-canonical",
      },
      width: 0,
      height: 768,
      format: "png",
    })).toThrow();

    expect(() => validator.validateImageRecords([
      {
        assetRef: { assetId: "asset:image:one" },
        width: 512,
        height: 512,
        format: "webp",
      },
      {
        assetRef: { assetId: "asset:image:two" },
        width: -4,
        height: 128,
        format: "jpeg",
      },
    ])).toThrow();
  });
});
